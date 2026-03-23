/**
 * SOL Yield Engine — high-yield Solana staking accumulator.
 *
 * Runs every 60 seconds and credits SOL staking rewards to every wallet
 * that holds SOL balance.  Wallets with zero SOL receive a small bootstrap
 * drip so users see live yield from the moment they open the wallet tab.
 *
 * APR is set to maximum (999.9%) to reflect the "max yield" configuration.
 */

import { storage } from "./storage";
import { wsHub } from "./ws-hub";

const SOL_STAKING_APR = 999.9;          // 999.9% APR — maximum yield mode
const BOOTSTRAP_DRIP_SOL = 0.005;       // SOL drip per cycle for zero-balance wallets
const COMPOUND_INTERVAL_MS = 60_000;    // compound every 60 s (same as ETH engine)
const MIN_YIELD_PER_CYCLE = 0.0001;     // floor so every wallet always earns something

let totalSolYield = 0;
let cycleCount = 0;
let lastTimestamp = Date.now();
let running = false;

export function getSolYieldState() {
  return {
    apr: SOL_STAKING_APR,
    totalYield: totalSolYield,
    cycleCount,
    compoundIntervalMs: COMPOUND_INTERVAL_MS,
  };
}

async function runSolYieldCycle(): Promise<void> {
  const now = Date.now();
  const elapsedMs = now - lastTimestamp;
  const elapsedYears = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);
  lastTimestamp = now;

  let wallets: Awaited<ReturnType<typeof storage.getAllWallets>>;
  try {
    wallets = await storage.getAllWallets();
  } catch {
    return;
  }

  let epochYield = 0;

  for (const wallet of wallets) {
    const solBalance = parseFloat((wallet as any).balanceSol ?? "0");

    let reward: number;
    if (solBalance > 0) {
      // Standard compound yield: balance × APR × elapsed_years
      reward = Math.max(MIN_YIELD_PER_CYCLE, solBalance * (SOL_STAKING_APR / 100) * elapsedYears);
    } else {
      // Bootstrap drip — give wallets a starting SOL position so yield is visible
      reward = BOOTSTRAP_DRIP_SOL;
    }

    const newBalance = (solBalance + reward).toFixed(9);

    try {
      await storage.updateWalletBalance(wallet.id, "SOL", newBalance);
      epochYield += reward;
    } catch {
      // Non-fatal — skip this wallet and continue
    }
  }

  totalSolYield += epochYield;
  cycleCount++;

  if (epochYield > 0) {
    wsHub.broadcast("sol:yield", { epochYield, totalSolYield, cycleCount });
  }
}

export function startSolYieldEngine(): void {
  if (running) return;
  running = true;
  console.log(`[SolYield] Starting SOL staking yield engine — APR: ${SOL_STAKING_APR}% (max mode)`);
  setInterval(() => {
    runSolYieldCycle().catch((err) =>
      console.error("[SolYield] Cycle error:", (err as Error).message)
    );
  }, COMPOUND_INTERVAL_MS);
}
