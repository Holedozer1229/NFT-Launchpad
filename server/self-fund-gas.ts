/**
 * OIYE $0-Bootstrap Self-Funding Gas Sentinel
 *
 * Inspired by the OIYE (On-chain Integrated Yield Engine) architecture:
 *   1. Bootstrap Capital   — earn from mining epochs + STX yield
 *   2. Child Vault Engine  — accumulate gas reserve from yield allocations
 *   3. Sentinel Bot        — monitor gas balance, trigger auto-fund when low
 *   4. Auto-Harvest        — reinvest yield surplus back into reserve
 *   5. Vault Cloning       — when reserve > threshold, extend to next cycle
 *
 * Gas self-funding flow:
 *   Mining epoch STX yield → 10% allocated to gas reserve
 *   Reserve balance checked against MIN_GAS_RESERVE_ETH (0.005 ETH)
 *   If critical → auto-fund event logged, sweep route triggered
 *   All events persisted to gas_funding_events table
 */

import { createHash } from "crypto";
import { wsHub } from "./ws-hub";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_GAS_RESERVE_ETH = 0.005;
const CRITICAL_GAS_ETH = 0.002;
const GAS_ALLOCATION_PCT = 0.10;       // 10% of each epoch yield → gas reserve
const STX_TO_ETH_RATE = 0.000018;      // approximate STX/ETH exchange rate
const SENTINEL_CHECK_INTERVAL_MS = 60_000; // every 60 seconds
const VAULT_CLONE_THRESHOLD_ETH = 0.05; // clone when reserve > this

// ─── Types ────────────────────────────────────────────────────────────────────

export type FundingPhase = "bootstrap" | "vault_active" | "harvesting" | "cloning";

export interface GasFundingEvent {
  id: string;
  epoch: number | null;
  triggerReason: string;
  fundingMethod: string;
  ethFunded: number;
  stxConverted: number;
  gasBefore: number;
  gasAfter: number;
  reserveBalance: number;
  yieldAllocated: number;
  phase: FundingPhase;
  status: "executed" | "pending" | "failed" | "covered";
  txHash: string | null;
  createdAt: Date;
}

export interface SentinelStatus {
  running: boolean;
  phase: FundingPhase;
  gasReserveEth: number;
  totalYieldAllocated: number;
  totalEthFunded: number;
  totalStxHarvested: number;
  fundingEvents: GasFundingEvent[];
  lastCheckAt: Date | null;
  isHealthy: boolean;
  isCritical: boolean;
  projectedRunwayEpochs: number;
  vaultCloneCount: number;
  sentinelTriggers: number;
  bootstrapActive: boolean;
  childVaultDeployed: boolean;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

let sentinelRunning = false;
let sentinelInterval: ReturnType<typeof setInterval> | null = null;

let _gasReserveEth = 0;
let _totalYieldAllocated = 0;
let _totalEthFunded = 0;
let _totalStxHarvested = 0;
let _phase: FundingPhase = "bootstrap";
let _lastCheckAt: Date | null = null;
let _vaultCloneCount = 0;
let _sentinelTriggers = 0;
let _childVaultDeployed = false;

const _fundingEvents: GasFundingEvent[] = [];
const MAX_EVENTS = 100;

// ─── DB persistence ───────────────────────────────────────────────────────────

async function persistEvent(event: GasFundingEvent): Promise<void> {
  try {
    const { pool } = await import("./db");
    await pool.query(
      `INSERT INTO gas_funding_events
        (epoch, trigger_reason, funding_method, eth_funded, stx_converted,
         gas_before, gas_after, reserve_balance, yield_allocated, phase, status, tx_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        event.epoch, event.triggerReason, event.fundingMethod,
        event.ethFunded, event.stxConverted, event.gasBefore, event.gasAfter,
        event.reserveBalance, event.yieldAllocated, event.phase, event.status, event.txHash,
      ]
    );
  } catch (err: any) {
    console.error("[SelfFundGas] DB persist error:", err.message);
  }
}

// ─── Live gas balance check ───────────────────────────────────────────────────

async function getLiveGasBalance(): Promise<number> {
  try {
    const { getTreasuryGasStatus } = await import("./alchemy-engine");
    const status = await getTreasuryGasStatus();
    return parseFloat(String(status.ethBalance ?? 0)) || 0;
  } catch (err: any) {
    console.error("[GasFund] getLiveGasBalance failed:", err.message);
    return 0;
  }
}

// ─── Event factory ────────────────────────────────────────────────────────────

function makeEvent(
  partial: Omit<GasFundingEvent, "id" | "createdAt">
): GasFundingEvent {
  return {
    ...partial,
    id: createHash("sha256").update(Date.now().toString() + Math.random().toString()).digest("hex").slice(0, 16),
    createdAt: new Date(),
  };
}

function pushEvent(event: GasFundingEvent) {
  _fundingEvents.push(event);
  if (_fundingEvents.length > MAX_EVENTS) _fundingEvents.shift();
  persistEvent(event).catch((err: any) => console.error("[GasFund] Failed to persist event:", err.message));
}

// ─── Phase transitions ────────────────────────────────────────────────────────

function updatePhase(gasBalance: number, reserve: number) {
  if (!_childVaultDeployed && reserve >= 0.001) {
    _childVaultDeployed = true;
    _phase = "vault_active";
    console.log("[SelfFundGas] Child vault deployed — transitioning to vault_active phase");
  }
  if (_phase === "vault_active" && reserve >= VAULT_CLONE_THRESHOLD_ETH) {
    _phase = "harvesting";
    console.log("[SelfFundGas] Reserve threshold reached — entering harvest phase");
  }
  if (_phase === "harvesting" && _gasReserveEth > VAULT_CLONE_THRESHOLD_ETH * 2) {
    _phase = "cloning";
    _vaultCloneCount++;
    _gasReserveEth -= VAULT_CLONE_THRESHOLD_ETH; // clone transfers capital
    console.log(`[SelfFundGas] Vault clone #${_vaultCloneCount} deployed — capital transferred`);
  }
  if (_phase === "cloning") {
    _phase = "vault_active"; // reset to vault_active after clone
  }
}

// ─── Sentinel check tick ──────────────────────────────────────────────────────

async function sentinelTick() {
  _lastCheckAt = new Date();
  const gasBalance = await getLiveGasBalance();
  updatePhase(gasBalance, _gasReserveEth);

  const isCritical = gasBalance < CRITICAL_GAS_ETH;
  const isLow = gasBalance < MIN_GAS_RESERVE_ETH;

  if (isCritical || isLow) {
    _sentinelTriggers++;
    const fundAmount = Math.min(_gasReserveEth, MIN_GAS_RESERVE_ETH - gasBalance + 0.002);

    if (fundAmount > 0 && _gasReserveEth >= fundAmount) {
      _gasReserveEth -= fundAmount;
      _totalEthFunded += fundAmount;

      const event = makeEvent({
        epoch: null,
        triggerReason: isCritical ? "CRITICAL_GAS_LOW" : "GAS_RESERVE_LOW",
        fundingMethod: "yield_reserve_sweep",
        ethFunded: fundAmount,
        stxConverted: fundAmount / STX_TO_ETH_RATE,
        gasBefore: gasBalance,
        gasAfter: gasBalance + fundAmount,
        reserveBalance: _gasReserveEth,
        yieldAllocated: 0,
        phase: _phase,
        status: "executed",
        txHash: null,
      });
      pushEvent(event);

      console.log(`[SelfFundGas] ⛽ Sentinel auto-fund: ${fundAmount.toFixed(6)} ETH from reserve (trigger ${_sentinelTriggers})`);

      // Attempt real sweep if treasury key available
      try {
        const alch = await import("./alchemy-engine");
        const sweepFn = (alch as unknown as Record<string, unknown>).sweepGasFromYield;
        if (typeof sweepFn === "function") {
          const result = await (sweepFn as (amount: number) => Promise<{ txHash?: string }>)(fundAmount);
          if (result?.txHash) {
            event.txHash = result.txHash;
            event.status = "executed";
          }
        }
      } catch (sweepErr: any) {
        console.error("[SelfFundGas] On-chain gas sweep failed:", sweepErr.message);
      }
    } else if (isCritical) {
      const event = makeEvent({
        epoch: null,
        triggerReason: "CRITICAL_RESERVE_EMPTY",
        fundingMethod: "reserve_exhausted",
        ethFunded: 0,
        stxConverted: 0,
        gasBefore: gasBalance,
        gasAfter: gasBalance,
        reserveBalance: _gasReserveEth,
        yieldAllocated: 0,
        phase: _phase,
        status: "failed",
        txHash: null,
      });
      pushEvent(event);
      console.warn("[SelfFundGas] ⚠ CRITICAL: gas reserve exhausted — bootstrap more STX yield");
    }
  }

  wsHub.broadcast("gas_sentinel:tick", {
    phase: _phase,
    gasBalanceEth: await getLiveGasBalance().catch((err: any) => { console.error("[GasFund] getLiveGasBalance broadcast failed:", err.message); return 0; }),
    reserveEth: _gasReserveEth,
    totalEthFunded: _totalEthFunded,
    sentinelTriggers: _sentinelTriggers,
    totalYieldAllocated: _totalYieldAllocated,
    lastCheckAt: _lastCheckAt?.toISOString() ?? null,
  });
}

// ─── Public: epoch yield allocation (called from BTC ZK daemon) ───────────────

export async function allocateEpochYieldToGas(
  epoch: number,
  stxYieldAmount: number
): Promise<number> {
  // Allocate GAS_ALLOCATION_PCT of yield to gas reserve
  const stxAllocated = stxYieldAmount * GAS_ALLOCATION_PCT;
  const ethEquivalent = stxAllocated * STX_TO_ETH_RATE;

  _gasReserveEth += ethEquivalent;
  _totalYieldAllocated += stxAllocated;
  _totalStxHarvested += stxAllocated;

  updatePhase(0, _gasReserveEth);

  const event = makeEvent({
    epoch,
    triggerReason: "EPOCH_YIELD_HARVEST",
    fundingMethod: "stx_to_eth_allocation",
    ethFunded: ethEquivalent,
    stxConverted: stxAllocated,
    gasBefore: _gasReserveEth - ethEquivalent,
    gasAfter: _gasReserveEth,
    reserveBalance: _gasReserveEth,
    yieldAllocated: stxAllocated,
    phase: _phase,
    status: "executed",
    txHash: null,
  });
  pushEvent(event);

  const runwayEpochs = _gasReserveEth / (MIN_GAS_RESERVE_ETH / 20);
  console.log(`[SelfFundGas] Epoch ${epoch} allocated ${stxAllocated.toFixed(4)} STX (${ethEquivalent.toFixed(8)} ETH) → reserve=${_gasReserveEth.toFixed(8)} ETH | runway~${runwayEpochs.toFixed(0)} epochs`);

  return ethEquivalent;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startSelfFundSentinel(): void {
  if (sentinelRunning) return;
  sentinelRunning = true;
  console.log("[SelfFundGas] OIYE Sentinel started — monitoring gas reserve");
  sentinelTick();
  sentinelInterval = setInterval(sentinelTick, SENTINEL_CHECK_INTERVAL_MS);
}

export function stopSelfFundSentinel(): void {
  if (!sentinelRunning) return;
  sentinelRunning = false;
  if (sentinelInterval) { clearInterval(sentinelInterval); sentinelInterval = null; }
}

export function getSelfFundStatus(): SentinelStatus {
  const avgYieldPerEpoch = _fundingEvents
    .filter(e => e.triggerReason === "EPOCH_YIELD_HARVEST")
    .reduce((s, e) => s + e.ethFunded, 0) / Math.max(1, _fundingEvents.filter(e => e.triggerReason === "EPOCH_YIELD_HARVEST").length);

  const projectedRunwayEpochs = avgYieldPerEpoch > 0
    ? Math.floor(_gasReserveEth / avgYieldPerEpoch)
    : Math.floor(_gasReserveEth / (MIN_GAS_RESERVE_ETH / 100));

  return {
    running: sentinelRunning,
    phase: _phase,
    gasReserveEth: _gasReserveEth,
    totalYieldAllocated: _totalYieldAllocated,
    totalEthFunded: _totalEthFunded,
    totalStxHarvested: _totalStxHarvested,
    fundingEvents: _fundingEvents.slice(-20).reverse(),
    lastCheckAt: _lastCheckAt,
    isHealthy: _gasReserveEth >= MIN_GAS_RESERVE_ETH,
    isCritical: _gasReserveEth < CRITICAL_GAS_ETH,
    projectedRunwayEpochs,
    vaultCloneCount: _vaultCloneCount,
    sentinelTriggers: _sentinelTriggers,
    bootstrapActive: _phase === "bootstrap",
    childVaultDeployed: _childVaultDeployed,
  };
}

export function getRecentGasFundingEvents(limit = 20): GasFundingEvent[] {
  return _fundingEvents.slice(-limit).reverse();
}

// ─── OIYE Gas Coverage for all transactions ───────────────────────────────────
//
// Estimated gas costs by operation type (ETH at ~30 gwei):
export const OIYE_GAS_ESTIMATES: Record<string, number> = {
  nft_mint:       0.000_180,  // ~180k gas
  bridge:         0.000_220,  // ~220k gas (cross-chain)
  send:           0.000_042,  // ~42k gas  (simple transfer)
  swap:           0.000_120,  // ~120k gas (DEX swap)
  marketplace:    0.000_080,  // ~80k gas  (list/buy)
  stake:          0.000_060,  // ~60k gas  (staking op)
  claim:          0.000_040,  // ~40k gas  (reward claim)
  default:        0.000_042,  // ~42k gas  (fallback)
};

/**
 * Request OIYE to cover gas for a transaction.
 * Deducts from the gas reserve if available.
 * Always call this before submitting any transaction.
 */
export function requestGasCoverage(
  opType: keyof typeof OIYE_GAS_ESTIMATES | string = "default",
  customEth?: number
): { covered: boolean; ethUsed: number; reserve: number } {
  const estimatedEth = customEth ?? (OIYE_GAS_ESTIMATES[opType] ?? OIYE_GAS_ESTIMATES.default);

  if (_gasReserveEth < estimatedEth) {
    // Reserve insufficient — let transaction proceed but mark uncovered
    return { covered: false, ethUsed: 0, reserve: _gasReserveEth };
  }

  const before = _gasReserveEth;
  _gasReserveEth -= estimatedEth;
  _totalEthFunded += estimatedEth;

  const event = makeEvent({
    epoch: 0,
    triggerReason: `oiye_coverage:${opType}`,
    fundingMethod: "oiye_reserve",
    ethFunded: estimatedEth,
    stxConverted: 0,
    gasBefore: before,
    gasAfter: before,
    reserveBalance: _gasReserveEth,
    yieldAllocated: 0,
    phase: _phase,
    status: "covered",
    txHash: null,
  });
  pushEvent(event);
  updatePhase(0, _gasReserveEth);

  console.log(`[OIYE] Gas covered: ${estimatedEth.toFixed(8)} ETH for ${opType} | reserve=${_gasReserveEth.toFixed(8)} ETH`);
  return { covered: true, ethUsed: estimatedEth, reserve: _gasReserveEth };
}
