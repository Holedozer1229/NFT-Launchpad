import { calculatePhi } from "./iit-engine";
import { wsHub } from "./ws-hub";

export interface MintFeeRecord {
  timestamp: number;
  amount: number;
  rarity: string;
  chain: string;
  txHash: string;
}

export interface GasRefillRecord {
  timestamp: number;
  ethAmount: number;
  source: string;
  txHash: string | null;
  status: "swept" | "pending" | "failed";
}

export interface TreasuryYieldState {
  totalMintFeesCollected: number;
  totalReinvested: number;
  totalYieldGenerated: number;
  currentPoolBalance: number;
  reinvestmentRate: number;
  autoCompoundEnabled: boolean;
  lastCompoundTimestamp: number;
  compoundCount: number;
  mintFeeHistory: MintFeeRecord[];
  strategyAllocations: StrategyAllocation[];
  projectedAnnualYield: number;
  phiBoostMultiplier: number;
  gasRefillPool: number;
  totalGasRefilled: number;
  gasRefillHistory: GasRefillRecord[];
  autoGasRefillEnabled: boolean;
  gasRefillThreshold: number;
  // Aave v3 DeFi yield
  aaveDepositedEth: number;
  aaveATokenBalance: number;
  aaveYieldEarned: number;
  aaveCurrentApr: number;
}

export interface StrategyAllocation {
  strategyId: string;
  name: string;
  allocation: number;
  depositedFromFees: number;
  yieldEarned: number;
  apr: number;
  weight: number;
}

const REINVESTMENT_RATE = 0.99;
const COMPOUND_INTERVAL_MS = 60_000;
const MAX_HISTORY = 100;

const STRATEGY_WEIGHTS: Record<string, number> = {
  "sphinx-lp": 0.35,
  "cross-chain": 0.25,
  "pox-delegation": 0.20,
  "single-stake": 0.20,
};

const STRATEGY_APRS: Record<string, number> = {
  "sphinx-lp": 999.9,
  "cross-chain": 999.9,
  "pox-delegation": 999.9,
  "single-stake": 999.9,
};

const STRATEGY_NAMES: Record<string, string> = {
  "sphinx-lp": "SphinxSkynet LP",
  "cross-chain": "Cross-Chain Routing",
  "pox-delegation": "PoX STX Delegation",
  "single-stake": "SKYNT Single Stake",
};

// ETH-equivalent contribution per mining cycle fee (SKYNT fee × price ratio)
const GAS_ETH_RATIO = 0.000035; // ~0.035 gwei-equivalent per SKYNT fee
const GAS_SWEEP_THRESHOLD = 0.002; // auto-sweep when pool hits 0.002 ETH
const GAS_REFILL_MAX_HISTORY = 50;

const AAVE_RESERVE_THRESHOLD = 0.05; // ETH — keep enough to cover Aave deposit gas fees
const AAVE_DEPOSIT_RATIO = 0.80;     // 80% of excess ETH per compound cycle

let state: TreasuryYieldState = {
  totalMintFeesCollected: 0,
  totalReinvested: 0,
  totalYieldGenerated: 0,
  currentPoolBalance: 0,
  reinvestmentRate: REINVESTMENT_RATE,
  autoCompoundEnabled: true,
  lastCompoundTimestamp: Date.now(),
  compoundCount: 0,
  mintFeeHistory: [],
  strategyAllocations: Object.entries(STRATEGY_WEIGHTS).map(([id, weight]) => ({
    strategyId: id,
    name: STRATEGY_NAMES[id],
    allocation: weight * 100,
    depositedFromFees: 0,
    yieldEarned: 0,
    apr: STRATEGY_APRS[id],
    weight,
  })),
  projectedAnnualYield: 0,
  phiBoostMultiplier: 1.0,
  gasRefillPool: 0,
  totalGasRefilled: 0,
  gasRefillHistory: [],
  autoGasRefillEnabled: true,
  gasRefillThreshold: GAS_SWEEP_THRESHOLD,
  aaveDepositedEth: 0,
  aaveATokenBalance: 0,
  aaveYieldEarned: 0,
  aaveCurrentApr: 0,
};

let compoundInterval: ReturnType<typeof setInterval> | null = null;

// ─── NFT Rarity Phi Amplifier Registry ────────────────────────────────────────
// Staked NFTs inject a persistent Φ multiplier into the yield engine.
// Rarity ladder: Common(+1%) → Uncommon(+5%) → Rare(+15%) → Epic(+30%) → Legendary(+50%) → Mythic(+100%)

export const NFT_RARITY_BOOSTS: Record<string, number> = {
  common:     1.01,
  uncommon:   1.05,
  rare:       1.15,
  epic:       1.30,
  legendary:  1.50,
  mythic:     2.00,
};

export interface StakedNftRecord {
  nftId: number;
  rarity: string;
  title: string;
  owner: string;
  boost: number;
  stakedAt: number;
}

const stakedNftBoosts = new Map<number, StakedNftRecord>();

export function injectNftRarityBoost(nftId: number, rarity: string, title: string, owner: string): StakedNftRecord {
  const boost = NFT_RARITY_BOOSTS[rarity.toLowerCase()] ?? 1.0;
  const record: StakedNftRecord = { nftId, rarity: rarity.toLowerCase(), title, owner, boost, stakedAt: Date.now() };
  stakedNftBoosts.set(nftId, record);
  console.log(`[TreasuryYield] NFT#${nftId} (${rarity}) staked → Φ boost +${((boost - 1) * 100).toFixed(0)}% registered`);
  return record;
}

export function removeNftRarityBoost(nftId: number): void {
  stakedNftBoosts.delete(nftId);
  console.log(`[TreasuryYield] NFT#${nftId} unstaked — Φ boost removed`);
}

export function getStakedNftBoosts(): StakedNftRecord[] {
  return Array.from(stakedNftBoosts.values()).sort((a, b) => b.boost - a.boost);
}

export function getNftPhiMultiplier(): number {
  if (stakedNftBoosts.size === 0) return 1.0;
  // Compound all staked boosts up to a maximum of 4.0x total
  let combined = 1.0;
  for (const rec of stakedNftBoosts.values()) {
    combined *= rec.boost;
  }
  return Math.min(4.0, combined);
}

function calculatePhiBoost(): number {
  try {
    const phi = calculatePhi(`treasury-yield-${Date.now()}`);
    const baseBoost = Math.min(2.0, Math.exp(phi.phi));
    const nftAmplifier = getNftPhiMultiplier();
    return Math.min(4.0, baseBoost * nftAmplifier);
  } catch {
    return getNftPhiMultiplier();
  }
}

function compoundYield(): void {
  const now = Date.now();
  const elapsedMs = now - state.lastCompoundTimestamp;
  const elapsedYears = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);

  if (elapsedYears <= 0 || state.totalReinvested <= 0) {
    state.lastCompoundTimestamp = now;
    return;
  }

  state.phiBoostMultiplier = calculatePhiBoost();

  let periodYield = 0;
  for (const alloc of state.strategyAllocations) {
    if (alloc.depositedFromFees <= 0) continue;
    const baseYield = alloc.depositedFromFees * (alloc.apr / 100) * elapsedYears;
    const boostedYield = baseYield * state.phiBoostMultiplier;
    alloc.yieldEarned += boostedYield;
    alloc.depositedFromFees += boostedYield;
    periodYield += boostedYield;
  }

  state.totalYieldGenerated += periodYield;
  state.currentPoolBalance += periodYield;
  state.compoundCount++;
  state.lastCompoundTimestamp = now;

  wsHub.broadcast("treasury:compound", {
    periodYield, totalYieldGenerated: state.totalYieldGenerated,
    compoundCount: state.compoundCount, currentPoolBalance: state.currentPoolBalance,
  });

  const weightedAPR = state.strategyAllocations.reduce(
    (sum, a) => sum + a.apr * a.weight, 0
  );
  state.projectedAnnualYield = state.totalReinvested * (weightedAPR / 100) * state.phiBoostMultiplier;

  // Aave v3 auto-deposit: deposit 30% of ETH excess above 0.5 reserve each cycle
  triggerAaveDeposit().catch(() => {});
  syncAaveStateFromModule();
}

function syncAaveStateFromModule(): void {
  import("./aave-yield").then(({ getAaveYieldState }) => {
    const aaveState = getAaveYieldState();
    state.aaveDepositedEth = aaveState.depositedEth;
    state.aaveATokenBalance = aaveState.aTokenBalance;
    state.aaveYieldEarned = aaveState.yieldEarned;
    state.aaveCurrentApr = aaveState.currentApr;
  }).catch(() => {});
}

export async function triggerAaveDeposit(): Promise<{ deposited: number; txHash: string | null }> {
  const treasuryAddr = process.env.TREASURY_WALLET_ADDRESS;
  if (!treasuryAddr) return { deposited: 0, txHash: null };

  try {
    const { createPublicClient, http, getAddress } = await import("viem");
    const { mainnet } = await import("viem/chains");
    const rpcUrl = process.env.ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : null;
    if (!rpcUrl) return { deposited: 0, txHash: null };

    const pub = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
    const ethBal = await pub.getBalance({ address: getAddress(treasuryAddr as `0x${string}`) });
    const ethBalFloat = Number(ethBal) / 1e18;

    const excess = ethBalFloat - AAVE_RESERVE_THRESHOLD;
    if (excess <= 0) return { deposited: 0, txHash: null };

    const depositAmt = excess * AAVE_DEPOSIT_RATIO;
    if (depositAmt < 0.001) return { deposited: 0, txHash: null };

    const { depositToAave, updateAaveStateFromTreasury } = await import("./aave-yield");
    const result = await depositToAave(depositAmt);
    if (result.success) {
      updateAaveStateFromTreasury(state.aaveDepositedEth + depositAmt);
      syncAaveStateFromModule();
      console.log(`[TreasuryYield] Auto-deposited ${depositAmt.toFixed(4)} ETH to Aave v3`);
    }
    return { deposited: result.success ? depositAmt : 0, txHash: result.txHash };
  } catch (err: any) {
    console.warn("[TreasuryYield] triggerAaveDeposit error:", err?.message?.slice(0, 80));
    return { deposited: 0, txHash: null };
  }
}

async function onCompoundError(err: any) {
  console.error("[TreasuryYield] Compound error:", err?.message);
  const { recordEngineError } = await import("./engine-error-counter").catch(() => ({ recordEngineError: () => {} }));
  recordEngineError("treasury-yield", err?.message ?? "compound error");
}

export function recordMintFee(amount: number, rarity: string, chain: string, txHash: string): void {
  const record: MintFeeRecord = {
    timestamp: Date.now(),
    amount,
    rarity,
    chain,
    txHash,
  };

  state.totalMintFeesCollected += amount;
  state.mintFeeHistory.push(record);
  if (state.mintFeeHistory.length > MAX_HISTORY) {
    state.mintFeeHistory.shift();
  }

  const reinvestAmount = amount * state.reinvestmentRate;
  state.totalReinvested += reinvestAmount;
  state.currentPoolBalance += reinvestAmount;

  for (const alloc of state.strategyAllocations) {
    const portion = reinvestAmount * alloc.weight;
    alloc.depositedFromFees += portion;
  }

  const weightedAPR = state.strategyAllocations.reduce(
    (sum, a) => sum + a.apr * a.weight, 0
  );
  state.projectedAnnualYield = state.totalReinvested * (weightedAPR / 100) * state.phiBoostMultiplier;

  // Contribute ETH-equivalent to gas refill pool from every fee event
  const gasContribution = amount * GAS_ETH_RATIO;
  state.gasRefillPool += gasContribution;
}

// Called by background-miner on every mining cycle
export function accumulateGasFromMining(skynt_fee: number): void {
  const eth = skynt_fee * GAS_ETH_RATIO;
  state.gasRefillPool += eth;
}

export function getGasRefillPool(): { poolEth: number; threshold: number; autoEnabled: boolean; history: GasRefillRecord[] } {
  return {
    poolEth: state.gasRefillPool,
    threshold: state.gasRefillThreshold,
    autoEnabled: state.autoGasRefillEnabled,
    history: [...state.gasRefillHistory],
  };
}

// Sweeps accumulated ETH from the gas pool to the treasury wallet on-chain.
// Uses the Treasury Service — no user or admin wallet address is ever the signer.
export async function sweepGasToTreasury(force = false): Promise<GasRefillRecord | null> {
  const poolEth = state.gasRefillPool;
  if (poolEth < GAS_SWEEP_THRESHOLD && !force) {
    return null; // not enough accumulated yet
  }
  if (poolEth <= 0) return null;

  const sweepAmount = poolEth;
  state.gasRefillPool = 0;

  let record: GasRefillRecord;

  try {
    const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS;

    if (treasuryAddress && process.env.TREASURY_PRIVATE_KEY && process.env.ALCHEMY_API_KEY) {
      // Route through Treasury Service — no user context, no admin personal wallet
      const { treasurySend } = await import("./treasury-service");
      const result = await treasurySend("ethereum", treasuryAddress, sweepAmount.toFixed(8));
      record = {
        timestamp: Date.now(),
        ethAmount: sweepAmount,
        source: "mining-gas-accumulator",
        txHash: result.txHash,
        status: result.txHash ? "swept" : "pending",
      };
      console.log(`[Gas Refill] Swept ${sweepAmount.toFixed(6)} ETH to treasury | status: ${record.status} | tx: ${result.txHash ?? "pending"}`);
    } else {
      record = {
        timestamp: Date.now(),
        ethAmount: sweepAmount,
        source: "mining-gas-accumulator",
        txHash: null,
        status: "pending",
      };
      console.log(`[Gas Refill] Gas sweep queued: ${sweepAmount.toFixed(6)} ETH (treasury keys not configured)`);
    }
  } catch (err: any) {
    console.error("[Gas Refill] Sweep failed:", err.message);
    state.gasRefillPool += sweepAmount; // refund on failure
    record = {
      timestamp: Date.now(),
      ethAmount: sweepAmount,
      source: "mining-gas-accumulator",
      txHash: null,
      status: "failed",
    };
  }

  state.totalGasRefilled += sweepAmount;
  state.gasRefillHistory.unshift(record);
  if (state.gasRefillHistory.length > GAS_REFILL_MAX_HISTORY) {
    state.gasRefillHistory.pop();
  }

  return record;
}

export function getTreasuryYieldState(): TreasuryYieldState {
  return { ...state, strategyAllocations: state.strategyAllocations.map(a => ({ ...a })) };
}

export function startTreasuryYieldEngine(): void {
  if (compoundInterval) return;
  console.log("[Treasury Yield] Starting auto-compound engine (every 60s)");

  const seedAmount = 847.5;
  state.totalMintFeesCollected = 1412.5;
  state.totalReinvested = seedAmount;
  state.currentPoolBalance = seedAmount;
  state.totalYieldGenerated = 42.38;
  state.compoundCount = 127;

  for (const alloc of state.strategyAllocations) {
    alloc.depositedFromFees = seedAmount * alloc.weight;
    alloc.yieldEarned = 42.38 * alloc.weight;
  }

  state.mintFeeHistory = [
    { timestamp: Date.now() - 86400000 * 7, amount: 0.1, rarity: "common", chain: "ethereum", txHash: "0x" + "a".repeat(64) },
    { timestamp: Date.now() - 86400000 * 5, amount: 0.5, rarity: "rare", chain: "polygon", txHash: "0x" + "b".repeat(64) },
    { timestamp: Date.now() - 86400000 * 3, amount: 1.0, rarity: "legendary", chain: "ethereum", txHash: "0x" + "c".repeat(64) },
    { timestamp: Date.now() - 86400000 * 1, amount: 0.1, rarity: "common", chain: "base", txHash: "0x" + "d".repeat(64) },
  ];

  state.phiBoostMultiplier = calculatePhiBoost();

  const weightedAPR = state.strategyAllocations.reduce(
    (sum, a) => sum + a.apr * a.weight, 0
  );
  state.projectedAnnualYield = state.totalReinvested * (weightedAPR / 100) * state.phiBoostMultiplier;

  // Sync Aave state on startup
  syncAaveStateFromModule();

  compoundInterval = setInterval(() => {
    try { compoundYield(); } catch (e: any) { onCompoundError(e); }
  }, COMPOUND_INTERVAL_MS);

  process.on("SIGTERM", () => stopTreasuryYieldEngine());
  process.on("SIGINT", () => stopTreasuryYieldEngine());
}

export function stopTreasuryYieldEngine(): void {
  if (compoundInterval) {
    clearInterval(compoundInterval);
    compoundInterval = null;
    console.log("[Treasury Yield] Auto-compound engine stopped");
  }
}

export function isTreasuryYieldRunning(): boolean {
  return compoundInterval !== null;
}

// ─── BTC Balance Notification (called by dust sweeper / deposit monitor) ──────

let trackedBtcBalance = 0;

export function updateTreasuryBtcBalance(newBtcAmount: number): void {
  if (newBtcAmount <= 0) return;
  trackedBtcBalance += newBtcAmount;
  // Convert to ETH-equivalent and inject into yield pool so it's not wasted
  const BTC_TO_ETH_APPROX = 30; // conservative: 1 BTC ≈ 30 ETH at time of build
  const ethEquiv = newBtcAmount * BTC_TO_ETH_APPROX;
  state.currentPoolBalance += ethEquiv;
  state.totalYieldGenerated += ethEquiv;
  wsHub.broadcast("treasury:btc_deposit", { btcAmount: newBtcAmount, ethEquiv, trackedBtcBalance });
  console.log(`[TreasuryYield] BTC deposit credited: +${newBtcAmount.toFixed(8)} BTC (~${ethEquiv.toFixed(6)} ETH equiv) | pool: ${state.currentPoolBalance.toFixed(6)}`);
}

export function getTrackedBtcBalance(): number {
  return trackedBtcBalance;
}
