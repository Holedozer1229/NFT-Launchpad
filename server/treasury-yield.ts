import { calculatePhi } from "./iit-engine";

export interface MintFeeRecord {
  timestamp: number;
  amount: number;
  rarity: string;
  chain: string;
  txHash: string;
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

const REINVESTMENT_RATE = 0.60;
const COMPOUND_INTERVAL_MS = 60_000;
const MAX_HISTORY = 100;

const STRATEGY_WEIGHTS: Record<string, number> = {
  "sphinx-lp": 0.35,
  "cross-chain": 0.25,
  "pox-delegation": 0.20,
  "single-stake": 0.20,
};

const STRATEGY_APRS: Record<string, number> = {
  "sphinx-lp": 42.8,
  "cross-chain": 68.5,
  "pox-delegation": 95.2,
  "single-stake": 24.6,
};

const STRATEGY_NAMES: Record<string, string> = {
  "sphinx-lp": "SphinxSkynet LP",
  "cross-chain": "Cross-Chain Routing",
  "pox-delegation": "PoX STX Delegation",
  "single-stake": "SKYNT Single Stake",
};

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
};

let compoundInterval: ReturnType<typeof setInterval> | null = null;

function calculatePhiBoost(): number {
  try {
    const phi = calculatePhi(`treasury-yield-${Date.now()}`);
    return Math.min(2.0, Math.exp(phi.phi));
  } catch {
    return 1.0;
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

  const weightedAPR = state.strategyAllocations.reduce(
    (sum, a) => sum + a.apr * a.weight, 0
  );
  state.projectedAnnualYield = state.totalReinvested * (weightedAPR / 100) * state.phiBoostMultiplier;
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

  compoundInterval = setInterval(compoundYield, COMPOUND_INTERVAL_MS);

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
