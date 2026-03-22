/**
 * SKYNT Price Driver Engine
 *
 * Uses live on-chain prices from Uniswap v3 to execute buybacks and burns.
 * All price data comes directly from the Uniswap v3 pool — no oracles, no CEX.
 *
 * Flow:
 *  1. Read live SKYNT/ETH price from Uniswap v3 Quoter (quoteExactInputSingle)
 *  2. Decide buy pressure based on price vs. target
 *  3. Execute ETH → SKYNT swap via Uniswap v3 SwapRouter02
 *  4. Burn BURN_RATIO of purchased SKYNT to dead address
 *  5. Keep the rest in treasury to build token reserves
 */

import { createHash } from "crypto";
import { wsHub } from "./ws-hub";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  formatUnits,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── Contract Addresses (Ethereum Mainnet) ──────────────────────────────────
const WETH: Address          = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_QUOTER_V2: Address  = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_ROUTER02: Address   = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const BURN_ADDRESS: Address       = "0x000000000000000000000000000000000000dEaD";

// SKYNT token — env override or default contract address
const SKYNT_ADDRESS: Address = (
  process.env.SKYNT_CONTRACT_ADDRESS || "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20"
) as Address;

// ── Engine Config ──────────────────────────────────────────────────────────
const POOL_FEES            = [3000, 10000, 500] as const;  // 0.3%, 1%, 0.05%
const BURN_RATIO           = 0.30;       // 30% of each buyback gets burned
const MIN_TREASURY_RESERVE = 0.01;       // ETH — never spend below this
const MAX_ETH_PER_EPOCH    = 0.005;      // max ETH per buyback cycle
const EPOCH_INTERVAL_MS    = 5 * 60_000; // 5 minutes between cycles
const SLIPPAGE_BPS         = 200;        // 2% max slippage
const PRICE_TARGET_USD     = parseFloat(process.env.SKYNT_PRICE_TARGET_USD ?? "0.65");

// ── ABIs (minimal) ─────────────────────────────────────────────────────────
const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",            type: "address" },
          { name: "tokenOut",           type: "address" },
          { name: "amountIn",           type: "uint256" },
          { name: "fee",                type: "uint24"  },
          { name: "sqrtPriceLimitX96",  type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut",               type: "uint256" },
      { name: "sqrtPriceX96After",       type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32"  },
      { name: "gasEstimate",             type: "uint256" },
    ],
  },
] as const;

const ROUTER02_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "fee",               type: "uint24"  },
          { name: "recipient",         type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "amountOutMinimum",  type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "value",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// ── State ──────────────────────────────────────────────────────────────────
export interface BuybackEvent {
  id: string;
  timestamp: number;
  ethSpent: number;
  skyntBought: number;
  skyntBurned: number;
  priceBeforeUsd: number;
  priceAfterUsd: number;
  priceImpactBps: number;
  txHashSwap: string | null;
  txHashBurn: string | null;
  poolFee: number;
  status: "success" | "failed" | "skipped";
  reason?: string;
}

export interface PriceDriverState {
  running: boolean;
  configured: boolean;
  liveSkyntPriceEth: number;
  liveSkyntPriceUsd: number;
  targetPriceUsd: number;
  pricePressureMode: "aggressive" | "moderate" | "idle" | "target_reached";
  treasuryEthBalance: number;
  totalSkyntBought: number;
  totalSkyntBurned: number;
  totalEthSpent: number;
  epochCount: number;
  lastBuybackAt: number | null;
  nextBuybackAt: number | null;
  buybackHistory: BuybackEvent[];
  activeFee: number | null;
  currentEthPrice: number;
}

let _state: PriceDriverState = {
  running: false,
  configured: false,
  liveSkyntPriceEth: 0,
  liveSkyntPriceUsd: 0,
  targetPriceUsd: PRICE_TARGET_USD,
  pricePressureMode: "idle",
  treasuryEthBalance: 0,
  totalSkyntBought: 0,
  totalSkyntBurned: 0,
  totalEthSpent: 0,
  epochCount: 0,
  lastBuybackAt: null,
  nextBuybackAt: null,
  buybackHistory: [],
  activeFee: null,
  currentEthPrice: 3200,
};

let _timer: ReturnType<typeof setTimeout> | null = null;

// ── Viem Clients ───────────────────────────────────────────────────────────
function getRpcUrl(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (key) return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  return "https://ethereum.publicnode.com";
}

function getPublicClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(getRpcUrl(), { timeout: 10_000 }),
  });
}

function getWalletClient() {
  const key = process.env.TREASURY_PRIVATE_KEY;
  if (!key) return null;
  const account = privateKeyToAccount(
    (key.startsWith("0x") ? key : `0x${key}`) as Hex
  );
  return createWalletClient({
    account,
    chain: mainnet,
    transport: http(getRpcUrl(), { timeout: 30_000 }),
  });
}

// ── Live Price from Uniswap v3 Quoter ─────────────────────────────────────
async function getOnChainPrice(ethAmountIn: bigint = parseEther("0.01")): Promise<{
  skyntOut: bigint;
  fee: number;
  priceEth: number;
} | null> {
  const client = getPublicClient();
  for (const fee of POOL_FEES) {
    try {
      const result = await client.simulateContract({
        address: UNISWAP_QUOTER_V2,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn:           WETH,
          tokenOut:          SKYNT_ADDRESS,
          amountIn:          ethAmountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const [skyntOut] = result.result as [bigint, bigint, number, bigint];
      if (skyntOut > 0n) {
        const priceEth = parseFloat(formatEther(ethAmountIn)) / parseFloat(formatUnits(skyntOut, 18));
        return { skyntOut, fee, priceEth };
      }
    } catch {
      // try next fee tier
    }
  }
  return null; // no pool found or all fee tiers failed
}

// ── Fetch live ETH/USD price from CoinGecko (for USD conversion) ──────────
async function fetchEthPriceUsd(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await res.json();
    return data?.ethereum?.usd ?? 3200;
  } catch {
    return _state.currentEthPrice || 3200;
  }
}

// ── Treasury ETH balance ───────────────────────────────────────────────────
async function getTreasuryEthBalance(): Promise<number> {
  const addr = process.env.TREASURY_WALLET_ADDRESS as Address | undefined;
  if (!addr) return 0;
  try {
    const client = getPublicClient();
    const balance = await client.getBalance({ address: addr });
    return parseFloat(formatEther(balance));
  } catch {
    return 0;
  }
}

// ── Determine buy pressure given current vs. target price ──────────────────
function calcBuyPressure(currentUsd: number, targetUsd: number, ethBalance: number): {
  mode: PriceDriverState["pricePressureMode"];
  ethToSpend: number;
} {
  if (currentUsd >= targetUsd) {
    return { mode: "target_reached", ethToSpend: 0 };
  }
  const pctBelow = (targetUsd - currentUsd) / targetUsd;

  // Scale spend: more aggressive the further below target
  let ethToSpend: number;
  let mode: PriceDriverState["pricePressureMode"];
  if (pctBelow > 0.30) {
    mode = "aggressive";
    ethToSpend = MAX_ETH_PER_EPOCH;
  } else if (pctBelow > 0.10) {
    mode = "moderate";
    ethToSpend = MAX_ETH_PER_EPOCH * 0.5;
  } else {
    mode = "idle";
    ethToSpend = MAX_ETH_PER_EPOCH * 0.2;
  }

  // Never spend more than what's above the safety reserve
  const available = Math.max(0, ethBalance - MIN_TREASURY_RESERVE);
  ethToSpend = Math.min(ethToSpend, available);
  return { mode, ethToSpend };
}

// ── Execute buyback: ETH → SKYNT via Uniswap v3 ───────────────────────────
async function executeBuyback(
  ethAmount: number,
  fee: number,
  expectedSkyntOut: bigint,
): Promise<{ swapHash: string; skyntReceived: bigint } | null> {
  const walletClient = getWalletClient();
  if (!walletClient) {
    console.warn("[PriceDriver] No TREASURY_PRIVATE_KEY — skipping on-chain swap");
    return null;
  }
  const account = walletClient.account!;
  const ethIn = parseEther(ethAmount.toFixed(6));
  const slippageFactor = 10000n - BigInt(SLIPPAGE_BPS);
  const minOut = (expectedSkyntOut * slippageFactor) / 10000n;

  try {
    const hash = await walletClient.writeContract({
      address: UNISWAP_ROUTER02,
      abi: ROUTER02_ABI,
      functionName: "exactInputSingle",
      args: [{
        tokenIn:           WETH,
        tokenOut:          SKYNT_ADDRESS,
        fee,
        recipient:         account.address,
        amountIn:          ethIn,
        amountOutMinimum:  minOut,
        sqrtPriceLimitX96: 0n,
      }],
      value: ethIn,
    });

    // Wait for receipt and read actual SKYNT received
    const client = getPublicClient();
    await client.waitForTransactionReceipt({ hash, timeout: 60_000 });

    const skyntBalance = await client.readContract({
      address: SKYNT_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    return { swapHash: hash, skyntReceived: skyntBalance };
  } catch (err: any) {
    console.error("[PriceDriver] Swap failed:", err.message?.slice(0, 120));
    return null;
  }
}

// ── Burn SKYNT by sending to dead address ─────────────────────────────────
async function burnSkynt(amount: bigint): Promise<string | null> {
  const walletClient = getWalletClient();
  if (!walletClient) return null;
  try {
    const hash = await walletClient.writeContract({
      address: SKYNT_ADDRESS,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [BURN_ADDRESS, amount],
    });
    return hash;
  } catch (err: any) {
    console.error("[PriceDriver] Burn failed:", err.message?.slice(0, 120));
    return null;
  }
}

// ── Single epoch run ───────────────────────────────────────────────────────
async function runEpoch(): Promise<void> {
  _state.epochCount++;
  const epoch = _state.epochCount;

  // 1. Read live on-chain price
  const quote = await getOnChainPrice();
  const ethPriceUsd = await fetchEthPriceUsd();
  _state.currentEthPrice = ethPriceUsd;

  if (!quote) {
    console.log(`[PriceDriver] Epoch ${epoch} — no SKYNT/WETH pool found on Uniswap v3. Skipping.`);
    _state.pricePressureMode = "idle";
    const ethBalFallback = await getTreasuryEthBalance().catch(() => _state.treasuryEthBalance);
    await savePriceSnapshot(0, 0, ethPriceUsd, 0, ethBalFallback, epoch, 0, 0);
    wsHub.broadcast("price_driver:epoch", {
      epoch, mode: "idle", priceUsd: 0, targetPriceUsd: PRICE_TARGET_USD,
      treasuryEthBalance: ethBalFallback, ethSpent: 0, skyntBought: 0, status: "no_pool",
    });
    return;
  }

  const priceEth = quote.priceEth;
  const priceUsd = priceEth * ethPriceUsd;
  _state.liveSkyntPriceEth = priceEth;
  _state.liveSkyntPriceUsd = priceUsd;
  _state.activeFee = quote.fee;

  console.log(`[PriceDriver] Epoch ${epoch} | Live SKYNT: $${priceUsd.toFixed(4)} (${priceEth.toFixed(8)} ETH) | Pool fee: ${quote.fee / 10000}%`);

  // 2. Get treasury balance
  const ethBalance = await getTreasuryEthBalance();
  _state.treasuryEthBalance = ethBalance;

  // 3. Determine buy pressure
  const { mode, ethToSpend } = calcBuyPressure(priceUsd, PRICE_TARGET_USD, ethBalance);
  _state.pricePressureMode = mode;

  if (ethToSpend <= 0 || mode === "target_reached" || mode === "idle") {
    console.log(`[PriceDriver] Epoch ${epoch} — mode=${mode}, no buy action needed`);
    await savePriceSnapshot(priceEth, priceUsd, ethPriceUsd, quote.fee, ethBalance, epoch, 0, 0);
    wsHub.broadcast("price_driver:epoch", {
      epoch, mode, priceUsd, targetPriceUsd: PRICE_TARGET_USD,
      treasuryEthBalance: ethBalance, ethSpent: 0, skyntBought: 0, status: "no_action",
    });
    return;
  }

  console.log(`[PriceDriver] Epoch ${epoch} — mode=${mode}, buying ${ethToSpend.toFixed(6)} ETH of SKYNT via Uniswap v3 fee=${quote.fee}`);

  // 4. Get a fresh quote for the exact amount we'll spend
  const exactQuote = await getOnChainPrice(parseEther(ethToSpend.toFixed(6)));
  if (!exactQuote) {
    console.warn("[PriceDriver] Could not get exact quote — aborting epoch");
    await savePriceSnapshot(priceEth, priceUsd, ethPriceUsd, quote.fee, ethBalance, epoch, 0, 0);
    wsHub.broadcast("price_driver:epoch", {
      epoch, mode, priceUsd, targetPriceUsd: PRICE_TARGET_USD,
      treasuryEthBalance: ethBalance, ethSpent: 0, skyntBought: 0, status: "quote_failed",
    });
    return;
  }

  // 5. Execute buyback
  const buyResult = await executeBuyback(ethToSpend, exactQuote.fee, exactQuote.skyntOut);

  const eventId = createHash("sha256")
    .update(`${epoch}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  if (!buyResult) {
    const failedEv: BuybackEvent = {
      id: eventId,
      timestamp: Date.now(),
      ethSpent: ethToSpend,
      skyntBought: 0,
      skyntBurned: 0,
      priceBeforeUsd: priceUsd,
      priceAfterUsd: priceUsd,
      priceImpactBps: 0,
      txHashSwap: null,
      txHashBurn: null,
      poolFee: quote.fee,
      status: "failed",
      reason: "Swap execution failed",
    };
    _state.buybackHistory.unshift(failedEv);
    await savePriceSnapshot(priceEth, priceUsd, ethPriceUsd, quote.fee, ethBalance, epoch, 0, 0);
    wsHub.broadcast("price_driver:buyback", { ...failedEv });
    wsHub.broadcast("price_driver:epoch", {
      epoch, mode, priceUsd, targetPriceUsd: PRICE_TARGET_USD,
      treasuryEthBalance: ethBalance, ethSpent: 0, skyntBought: 0, status: "buyback_failed",
    });
    return;
  }

  // 6. Calculate how much SKYNT to burn (BURN_RATIO of purchased)
  const skyntReceived = exactQuote.skyntOut; // use expected for burn calc
  const burnAmount = BigInt(Math.floor(Number(skyntReceived) * BURN_RATIO));
  const keepAmount = skyntReceived - burnAmount;

  let burnHash: string | null = null;
  if (burnAmount > 0n) {
    burnHash = await burnSkynt(burnAmount);
    if (burnHash) {
      const burnFloat = parseFloat(formatUnits(burnAmount, 18));
      console.log(`[PriceDriver] Burned ${burnFloat.toFixed(6)} SKYNT → 0x000dead`);
      wsHub.broadcast("price_driver:burn_completed", {
        epoch, txHash: burnHash, skyntBurned: burnFloat,
        burnRatio: BURN_RATIO, priceUsd,
      });
    }
  }

  // 7. Get updated price for impact measurement
  const afterQuote = await getOnChainPrice();
  const priceAfterUsd = afterQuote ? afterQuote.priceEth * ethPriceUsd : priceUsd;
  const impactBps = Math.round(((priceAfterUsd - priceUsd) / priceUsd) * 10000);

  const skyntBoughtFloat = parseFloat(formatUnits(skyntReceived, 18));
  const skyntBurnedFloat = parseFloat(formatUnits(burnAmount, 18));

  _state.totalSkyntBought += skyntBoughtFloat;
  _state.totalSkyntBurned += skyntBurnedFloat;
  _state.totalEthSpent += ethToSpend;
  _state.lastBuybackAt = Date.now();
  _state.liveSkyntPriceUsd = priceAfterUsd;

  const ev: BuybackEvent = {
    id: eventId,
    timestamp: Date.now(),
    ethSpent: ethToSpend,
    skyntBought: skyntBoughtFloat,
    skyntBurned: skyntBurnedFloat,
    priceBeforeUsd: priceUsd,
    priceAfterUsd,
    priceImpactBps: impactBps,
    txHashSwap: buyResult.swapHash,
    txHashBurn: burnHash,
    poolFee: exactQuote.fee,
    status: "success",
  };
  _state.buybackHistory.unshift(ev);
  if (_state.buybackHistory.length > 50) _state.buybackHistory.pop();

  console.log(
    `[PriceDriver] ✓ Bought ${skyntBoughtFloat.toFixed(2)} SKYNT | Burned ${skyntBurnedFloat.toFixed(2)} | ` +
    `Impact: +${impactBps}bps | $${priceUsd.toFixed(4)} → $${priceAfterUsd.toFixed(4)}`
  );

  wsHub.broadcast("price_driver:buyback", { ...ev });
  wsHub.broadcast("price_driver:epoch", {
    epoch, mode, priceUsd: priceAfterUsd, targetPriceUsd: PRICE_TARGET_USD,
    treasuryEthBalance: ethBalance, ethSpent: ethToSpend, skyntBought: skyntBoughtFloat,
    status: "buyback_success",
  });

  // Persist snapshot with actual buyback amounts
  await savePriceSnapshot(priceAfterUsd / ethPriceUsd, priceAfterUsd, ethPriceUsd, exactQuote.fee, ethBalance, epoch, ethToSpend, skyntBoughtFloat);
}

// ── Persist price snapshot to DB ──────────────────────────────────────────
async function savePriceSnapshot(
  priceEth: number,
  priceUsd: number,
  ethPriceUsd: number,
  poolFee: number,
  treasuryEthBalance: number,
  epochNumber: number,
  ethSpent: number = 0,
  skyntBought: number = 0,
): Promise<void> {
  try {
    const { pool: dbPool } = await import("./db");
    await dbPool.query(
      `INSERT INTO skynt_price_snapshots
         (price_eth, price_usd, eth_price_usd, pool_fee, treasury_eth_balance, epoch_number, eth_spent, skynt_bought)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [priceEth, priceUsd, ethPriceUsd, poolFee, treasuryEthBalance, epochNumber, ethSpent, skyntBought]
    );
  } catch (err: any) {
    console.warn("[PriceDriver] Failed to save price snapshot:", err.message?.slice(0, 80));
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────
async function scheduleNext(): Promise<void> {
  if (!_state.running) return;
  _state.nextBuybackAt = Date.now() + EPOCH_INTERVAL_MS;
  _timer = setTimeout(async () => {
    try { await runEpoch(); } catch (e: any) {
      console.error("[PriceDriver] Epoch error:", e.message);
    }
    scheduleNext();
  }, EPOCH_INTERVAL_MS);
}

// ── Public API ─────────────────────────────────────────────────────────────
export function startPriceDriver(): void {
  if (_state.running) return;
  const hasKey = !!process.env.TREASURY_PRIVATE_KEY;
  const hasAlchemy = !!process.env.ALCHEMY_API_KEY;
  _state.configured = hasKey && hasAlchemy;
  _state.running = true;
  console.log(
    `[PriceDriver] SKYNT Price Driver started — target: $${PRICE_TARGET_USD} | ` +
    `wallet: ${_state.configured ? "configured" : "READ-ONLY (no TREASURY_PRIVATE_KEY)"}`
  );
  // Run first epoch immediately then schedule
  runEpoch().catch(e => console.error("[PriceDriver] Initial epoch error:", e.message));
  scheduleNext();
}

export function stopPriceDriver(): void {
  _state.running = false;
  if (_timer) { clearTimeout(_timer); _timer = null; }
  console.log("[PriceDriver] Stopped");
}

export function getPriceDriverState(): PriceDriverState {
  return { ..._state, buybackHistory: [..._state.buybackHistory] };
}

export async function triggerManualBuyback(): Promise<BuybackEvent | null> {
  if (!_state.running) return null;
  try { await runEpoch(); } catch (e: any) {
    console.error("[PriceDriver] Manual trigger error:", e.message);
  }
  return _state.buybackHistory[0] ?? null;
}
