/**
 * BTC Dust UTXO Sweeper — OIYE Bootstrap Layer
 *
 * Automatically collects and consolidates all unspent outputs on the
 * treasury Bitcoin address using the BlockCypher API (same provider used
 * for DOGE). Runs every SWEEP_INTERVAL_MS and broadcasts a consolidation
 * transaction whenever spendable UTXOs are found.
 *
 * Required env secrets:
 *   BTC_TREASURY_ADDRESS  — P2PKH mainnet address (1...)
 *   BTC_TREASURY_WIF      — Wallet Import Format private key (5... or K.../L...)
 *
 * Optional:
 *   BLOCKCYPHER_TOKEN     — Higher rate limits (300 req/hr free, 2000/hr with token)
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { base58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { wsHub } from "./ws-hub";
import { updateTreasuryBtcBalance } from "./treasury-yield";

const BTC_API = "https://api.blockcypher.com/v1/btc/main";
const SATOSHI = 1e8;
const DUST_THRESHOLD_SATOSHIS = 546;       // BTC relay dust limit
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const MIN_UTXO_VALUE_SATOSHIS = 1000;      // skip UTXOs below 1000 sat (fee would exceed value)
const SWEEP_FEE_SATOSHIS = 5000;           // conservative fee for consolidation tx

interface Utxo {
  tx_hash: string;
  tx_output_n: number;
  value: number;        // satoshis
  confirmations: number;
  script: string;
}

interface BlockCypherAddrResp {
  txrefs?: Utxo[];
  unconfirmed_txrefs?: Utxo[];
  balance?: number;
  final_balance?: number;
}

interface BlockCypherTemplate {
  tx: object;
  tosign: string[];
  errors?: { error: string }[];
}

interface BlockCypherSendResult {
  tx: { hash: string; fees: number };
}

interface SweepResult {
  swept: boolean;
  txHash: string | null;
  utxoCount: number;
  totalBtc: number;
  feeBtc: number;
  netBtc: number;
  explorerUrl: string | null;
  error: string | null;
}

let totalSweptBtc = 0;
let sweepCount = 0;
let lastSweepAt: number | null = null;
let lastUtxoCount = 0;
let running = false;

export function getBtcSweeperState() {
  return { totalSweptBtc, sweepCount, lastSweepAt, lastUtxoCount };
}

function tokenParam(): string {
  const t = process.env.BLOCKCYPHER_TOKEN;
  return t ? `?token=${t}` : "";
}

function decodeBtcWif(wif: string): Uint8Array {
  // Base58check decode, strip version byte (0x80), optional compression flag
  const decoded = base58check(sha256).decode(wif);
  // decoded[0] is version (0x80 mainnet), last byte may be 0x01 (compressed flag)
  const isCompressed = decoded.length === 34 && decoded[33] === 0x01;
  return isCompressed ? decoded.slice(1, 33) : decoded.slice(1);
}

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const token = process.env.BLOCKCYPHER_TOKEN ? `?token=${process.env.BLOCKCYPHER_TOKEN}&` : "?";
  const url = `${BTC_API}/addrs/${address}${token}unspentOnly=true&includeScript=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BlockCypher addr fetch failed: ${res.status} ${await res.text()}`);
  const data: BlockCypherAddrResp = await res.json();
  return (data.txrefs ?? []).filter(u => u.confirmations >= 1 && u.value >= MIN_UTXO_VALUE_SATOSHIS);
}

async function sweepUtxos(address: string, wif: string, utxos: Utxo[]): Promise<SweepResult> {
  const totalSatoshis = utxos.reduce((s, u) => s + u.value, 0);
  const netSatoshis = totalSatoshis - SWEEP_FEE_SATOSHIS;

  if (netSatoshis <= DUST_THRESHOLD_SATOSHIS) {
    return { swept: false, txHash: null, utxoCount: utxos.length, totalBtc: totalSatoshis / SATOSHI, feeBtc: SWEEP_FEE_SATOSHIS / SATOSHI, netBtc: 0, explorerUrl: null, error: "Net value after fee is dust — skipping" };
  }

  const privKey = decodeBtcWif(wif);
  const pubKeyHex = Buffer.from(secp256k1.getPublicKey(privKey, true)).toString("hex");

  // Build consolidation tx: all UTXOs → back to same treasury address
  const newTxPayload = {
    inputs: utxos.map(u => ({ addresses: [address], output_index: u.tx_output_n, prev_hash: u.tx_hash, script_type: "pay-to-pubkey-hash" })),
    outputs: [{ addresses: [address], value: netSatoshis }],
  };

  const tmplRes = await fetch(`${BTC_API}/txs/new${tokenParam()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTxPayload),
    signal: AbortSignal.timeout(20000),
  });
  if (!tmplRes.ok) throw new Error(`BlockCypher BTC tx/new failed: ${tmplRes.status} ${await tmplRes.text()}`);
  const tmpl: BlockCypherTemplate = await tmplRes.json();
  if (tmpl.errors?.length) throw new Error(`BTC tx errors: ${tmpl.errors.map(e => e.error).join(", ")}`);

  const signatures = (tmpl.tosign ?? []).map(h =>
    secp256k1.sign(Buffer.from(h, "hex"), privKey, { lowS: true }).toDERHex()
  );

  const sendRes = await fetch(`${BTC_API}/txs/send${tokenParam()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx: tmpl.tx, tosign: tmpl.tosign, signatures, pubkeys: tmpl.tosign.map(() => pubKeyHex) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!sendRes.ok) throw new Error(`BlockCypher BTC broadcast failed: ${sendRes.status} ${await sendRes.text()}`);

  const result: BlockCypherSendResult = await sendRes.json();
  const txHash = result.tx?.hash ?? null;
  if (!txHash) throw new Error("BTC broadcast returned no tx hash");

  return {
    swept: true,
    txHash,
    utxoCount: utxos.length,
    totalBtc: totalSatoshis / SATOSHI,
    feeBtc: SWEEP_FEE_SATOSHIS / SATOSHI,
    netBtc: netSatoshis / SATOSHI,
    explorerUrl: `https://mempool.space/tx/${txHash}`,
    error: null,
  };
}

async function runSweepCycle(): Promise<void> {
  const address = process.env.BTC_TREASURY_ADDRESS;
  const wif = process.env.BTC_TREASURY_WIF;

  if (!address || !wif) {
    console.log("[BtcDustSweeper] Skipping — BTC_TREASURY_ADDRESS or BTC_TREASURY_WIF not configured");
    return;
  }

  let utxos: Utxo[];
  try {
    utxos = await fetchUtxos(address);
  } catch (err: any) {
    console.warn("[BtcDustSweeper] UTXO fetch failed:", err.message);
    return;
  }

  lastUtxoCount = utxos.length;
  lastSweepAt = Date.now();

  if (utxos.length === 0) {
    console.log(`[BtcDustSweeper] No spendable UTXOs on ${address}`);
    return;
  }

  const totalSat = utxos.reduce((s, u) => s + u.value, 0);
  console.log(`[BtcDustSweeper] Found ${utxos.length} UTXOs totaling ${(totalSat / SATOSHI).toFixed(8)} BTC — consolidating`);

  let result: SweepResult;
  try {
    result = await sweepUtxos(address, wif, utxos);
  } catch (err: any) {
    console.error("[BtcDustSweeper] Sweep failed:", err.message);
    return;
  }

  if (!result.swept) {
    console.log(`[BtcDustSweeper] ${result.error}`);
    return;
  }

  totalSweptBtc += result.netBtc;
  sweepCount++;

  console.log(`[BtcDustSweeper] Swept ${result.utxoCount} UTXOs | ${result.netBtc.toFixed(8)} BTC net → ${address} | tx: ${result.txHash}`);
  console.log(`[BtcDustSweeper] Explorer: ${result.explorerUrl}`);

  // Notify treasury yield engine that BTC balance was consolidated
  try {
    updateTreasuryBtcBalance(result.netBtc);
  } catch {}

  wsHub.broadcast("btc:sweep", {
    txHash: result.txHash,
    utxoCount: result.utxoCount,
    totalBtc: result.totalBtc,
    netBtc: result.netBtc,
    feeBtc: result.feeBtc,
    explorerUrl: result.explorerUrl,
    totalSweptBtc,
    sweepCount,
  });
}

export function startBtcDustSweeper(): void {
  if (running) return;
  running = true;
  console.log(`[BtcDustSweeper] Starting BTC UTXO dust sweeper — interval: ${SWEEP_INTERVAL_MS / 3600000}h`);

  // First sweep after 30s (give server time to fully start)
  setTimeout(() => {
    runSweepCycle().catch(err => console.error("[BtcDustSweeper] Cycle error:", err.message));
    setInterval(() => {
      runSweepCycle().catch(err => console.error("[BtcDustSweeper] Cycle error:", err.message));
    }, SWEEP_INTERVAL_MS);
  }, 30_000);
}
