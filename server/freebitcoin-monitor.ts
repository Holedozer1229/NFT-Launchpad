/**
 * Freebitco.in Deposit Monitor — OIYE Bootstrap Layer
 *
 * freebitco.in uses Cloudflare Turnstile CAPTCHA which cannot be solved
 * programmatically. This module takes a different approach:
 *
 *   1. The user creates a freebitco.in account and sets their BTC withdrawal
 *      address to the treasury BTC address (BTC_TREASURY_ADDRESS).
 *   2. This daemon polls the treasury BTC address via BlockCypher every 15
 *      minutes and detects incoming confirmed transactions.
 *   3. When a new deposit arrives, it is credited to the treasury yield pool
 *      and a WebSocket event is broadcast to the UI.
 *
 * This covers ALL incoming BTC — freebitco.in payouts, mining rewards,
 * airdrops, or any external deposits, providing real on-chain funding.
 *
 * Required env secrets (same as btc-dust-sweeper):
 *   BTC_TREASURY_ADDRESS — the address to watch for incoming deposits
 *
 * Optional:
 *   BLOCKCYPHER_TOKEN — higher rate limits
 *   FREEBITCOIN_EMAIL — stored for display in dashboard (not used for automation)
 */

import { wsHub } from "./ws-hub";
import { updateTreasuryBtcBalance } from "./treasury-yield";

const BTC_API = "https://api.blockcypher.com/v1/btc/main";
const POLL_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const SATOSHI = 1e8;

interface TxRef {
  tx_hash: string;
  block_height: number;
  confirmed: string;
  value: number;   // satoshis received
}

interface BlockCypherAddrFull {
  address: string;
  balance: number;
  final_balance: number;
  txrefs?: TxRef[];
  n_tx: number;
}

export interface DepositRecord {
  txHash: string;
  btcAmount: number;
  confirmedAt: string;
  source: "freebitcoin_auto_withdraw" | "external_deposit" | "unknown";
  creditedToPool: boolean;
}

let seenTxHashes = new Set<string>();
let depositHistory: DepositRecord[] = [];
let totalBtcDeposited = 0;
let lastPollAt: number | null = null;
let running = false;

export function getFreebitcoinMonitorState() {
  return {
    totalBtcDeposited,
    depositCount: depositHistory.length,
    lastPollAt,
    recentDeposits: depositHistory.slice(-10),
    watchAddress: process.env.BTC_TREASURY_ADDRESS ?? null,
    accountEmail: process.env.FREEBITCOIN_EMAIL ?? null,
  };
}

function tokenParam(sep: "?" | "&" = "?"): string {
  const t = process.env.BLOCKCYPHER_TOKEN;
  return t ? `${sep}token=${t}` : "";
}

async function fetchAddressTxs(address: string): Promise<{ balance: number; txrefs: TxRef[] }> {
  const url = `${BTC_API}/addrs/${address}${tokenParam()}&unspentOnly=false&limit=50`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BlockCypher addr fetch: ${res.status} ${await res.text()}`);
  const data: BlockCypherAddrFull = await res.json();
  return {
    balance: (data.final_balance ?? 0) / SATOSHI,
    txrefs: (data.txrefs ?? []).filter(tx => tx.block_height > 0), // confirmed only
  };
}

function classifySource(btcAmount: number): DepositRecord["source"] {
  // freebitco.in typically pays out in small amounts (satoshis range)
  // This is a best-effort classification; all deposits are credited either way
  if (btcAmount < 0.0001) return "freebitcoin_auto_withdraw";
  return "external_deposit";
}

async function pollForDeposits(): Promise<void> {
  const address = process.env.BTC_TREASURY_ADDRESS;
  if (!address) {
    console.log("[FreeBitcoinMonitor] Skipping — BTC_TREASURY_ADDRESS not configured");
    return;
  }

  lastPollAt = Date.now();

  let data: { balance: number; txrefs: TxRef[] };
  try {
    data = await fetchAddressTxs(address);
  } catch (err: any) {
    console.warn("[FreeBitcoinMonitor] Poll failed:", err.message);
    return;
  }

  const newTxs = data.txrefs.filter(tx => !seenTxHashes.has(tx.tx_hash));

  for (const tx of newTxs) {
    seenTxHashes.add(tx.tx_hash);
    const btcAmount = tx.value / SATOSHI;
    if (btcAmount <= 0) continue;

    const source = classifySource(btcAmount);
    const record: DepositRecord = {
      txHash: tx.tx_hash,
      btcAmount,
      confirmedAt: tx.confirmed ?? new Date().toISOString(),
      source,
      creditedToPool: true,
    };

    depositHistory.push(record);
    if (depositHistory.length > 200) depositHistory.shift();
    totalBtcDeposited += btcAmount;

    console.log(`[FreeBitcoinMonitor] New BTC deposit detected | ${btcAmount.toFixed(8)} BTC | ${source} | tx: ${tx.tx_hash}`);

    // Credit to the treasury yield pool
    updateTreasuryBtcBalance(btcAmount);

    wsHub.broadcast("btc:deposit", {
      txHash: tx.tx_hash,
      btcAmount,
      source,
      confirmedAt: record.confirmedAt,
      explorerUrl: `https://mempool.space/tx/${tx.tx_hash}`,
      totalBtcDeposited,
    });
  }

  if (newTxs.length === 0) {
    console.log(`[FreeBitcoinMonitor] No new deposits on ${address} | balance: ${data.balance.toFixed(8)} BTC`);
  }
}

export function startFreebitcoinMonitor(): void {
  if (running) return;
  running = true;

  const address = process.env.BTC_TREASURY_ADDRESS;
  const email = process.env.FREEBITCOIN_EMAIL;
  console.log(`[FreeBitcoinMonitor] Starting BTC deposit monitor — poll: every ${POLL_INTERVAL_MS / 60000}min`);
  if (address) console.log(`[FreeBitcoinMonitor] Watching: ${address}`);
  if (email) console.log(`[FreeBitcoinMonitor] freebitco.in account: ${email}`);
  if (!email) {
    console.log("[FreeBitcoinMonitor] Tip: set FREEBITCOIN_EMAIL secret — configure auto-withdrawal on freebitco.in to your BTC treasury address to receive automated payouts");
  }

  // First poll after 60s
  setTimeout(() => {
    pollForDeposits().catch(err => console.error("[FreeBitcoinMonitor] Poll error:", err.message));
    setInterval(() => {
      pollForDeposits().catch(err => console.error("[FreeBitcoinMonitor] Poll error:", err.message));
    }, POLL_INTERVAL_MS);
  }, 60_000);
}
