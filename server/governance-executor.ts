import { db } from "./db";
import { governanceProposals, protocolSettings } from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { wsHub } from "./ws-hub";

interface ExecutionResult {
  proposalId: number;
  title: string;
  category: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  executedAt: string;
}

const ALLOWED_PD_KEYS = new Set([
  "price_driver.target_price_usd",
  "price_driver.burn_ratio",
  "price_driver.max_eth_per_epoch",
  "price_driver.epoch_interval_ms",
]);

const EXECUTION_LOG_MAX = 50;
let executionLog: ExecutionResult[] = [];
let executorInterval: ReturnType<typeof setInterval> | null = null;

async function executePriceDriverProposal(proposal: {
  id: number;
  title: string;
  category: string;
  executionPayload: any;
}): Promise<ExecutionResult | null> {
  const payload = proposal.executionPayload as { parameter: string; newValue: string; currentValue?: string } | null;
  if (!payload || !payload.parameter || payload.newValue === undefined) {
    console.warn(`[GovernanceExecutor] GIP-${proposal.id}: missing executionPayload — skipping`);
    return null;
  }

  const key = payload.parameter;
  if (!ALLOWED_PD_KEYS.has(key)) {
    console.warn(`[GovernanceExecutor] GIP-${proposal.id}: disallowed parameter key "${key}" — skipping`);
    return null;
  }

  const newValue = String(payload.newValue);

  // Read old value
  const existing = await db
    .select()
    .from(protocolSettings)
    .where(eq(protocolSettings.key, key))
    .limit(1);

  const oldValue = existing.length > 0 ? existing[0].value : "(not set)";

  // Write the exact price_driver.* key
  if (existing.length > 0) {
    await db
      .update(protocolSettings)
      .set({
        value: newValue,
        updatedBy: `governance:gip-${proposal.id}`,
        updatedAt: new Date(),
      })
      .where(eq(protocolSettings.key, key));
  } else {
    await db.insert(protocolSettings).values({
      key,
      value: newValue,
      updatedBy: `governance:gip-${proposal.id}`,
    });
  }

  // Reload price driver settings from DB
  try {
    const { reloadSettingsFromDb } = await import("./skynt-price-driver");
    await reloadSettingsFromDb();
    console.log(`[GovernanceExecutor] Price driver settings reloaded after GIP-${proposal.id}`);
  } catch (err: any) {
    console.warn("[GovernanceExecutor] reloadSettingsFromDb failed:", err?.message?.slice(0, 60));
  }

  const executionHash = `0x${Buffer.from(`gip-${proposal.id}-${Date.now()}`).toString("hex").slice(0, 64).padEnd(64, "0")}`;

  await db
    .update(governanceProposals)
    .set({
      status: "executed",
      executedAt: new Date(),
      executionHash,
    })
    .where(eq(governanceProposals.id, proposal.id));

  const result: ExecutionResult = {
    proposalId: proposal.id,
    title: proposal.title,
    category: proposal.category,
    parameter: key,
    oldValue,
    newValue,
    executedAt: new Date().toISOString(),
  };

  executionLog.unshift(result);
  if (executionLog.length > EXECUTION_LOG_MAX) executionLog.pop();

  wsHub.broadcast("governance:executed", {
    proposalId: proposal.id,
    title: proposal.title,
    parameter: key,
    oldValue,
    newValue,
    executionHash,
  });

  console.log(`[GovernanceExecutor] GIP-${String(proposal.id).padStart(3, "0")} executed — ${key}: ${oldValue} → ${newValue}`);

  return result;
}

async function runExecutionCycle(): Promise<void> {
  try {
    const now = new Date();

    // Only select price_driver_params proposals that are active and ended
    const expired = await db
      .select()
      .from(governanceProposals)
      .where(
        and(
          eq(governanceProposals.status, "active"),
          eq(governanceProposals.category, "price_driver_params"),
          lte(governanceProposals.endsAt, now)
        )
      );

    for (const proposal of expired) {
      const votesFor = proposal.votesFor ?? 0;
      const votesAgainst = proposal.votesAgainst ?? 0;
      const votesAbstain = proposal.votesAbstain ?? 0;
      const total = votesFor + votesAgainst + votesAbstain;
      const quorumMet = total >= (proposal.quorumRequired ?? 100);
      const forWins = votesFor > votesAgainst;

      if (quorumMet && forWins) {
        await executePriceDriverProposal({
          id: proposal.id,
          title: proposal.title,
          category: proposal.category,
          executionPayload: proposal.executionPayload,
        });
      } else {
        await db
          .update(governanceProposals)
          .set({ status: "rejected" })
          .where(eq(governanceProposals.id, proposal.id));

        wsHub.broadcast("governance:rejected", {
          proposalId: proposal.id,
          title: proposal.title,
          reason: quorumMet ? "for_votes_insufficient" : "quorum_not_met",
        });

        console.log(`[GovernanceExecutor] GIP-${String(proposal.id).padStart(3, "0")} rejected (quorum: ${quorumMet}, forWins: ${forWins})`);
      }
    }
  } catch (err: any) {
    console.error("[GovernanceExecutor] cycle error:", err?.message?.slice(0, 120));
  }
}

export function getExecutionLog(): ExecutionResult[] {
  return [...executionLog];
}

export async function getProtocolSettingsList(): Promise<{ key: string; value: string; updatedBy: string; updatedAt: Date | null }[]> {
  const rows = await db
    .select({
      key: protocolSettings.key,
      value: protocolSettings.value,
      updatedBy: protocolSettings.updatedBy,
      updatedAt: protocolSettings.updatedAt,
    })
    .from(protocolSettings)
    .orderBy(protocolSettings.updatedAt);
  // Return only price_driver.* settings
  return rows.filter(r => r.key.startsWith("price_driver."));
}

export async function adminExecuteProposal(proposalId: number): Promise<{ success: boolean; message: string; result?: ExecutionResult }> {
  const [proposal] = await db
    .select()
    .from(governanceProposals)
    .where(eq(governanceProposals.id, proposalId))
    .limit(1);

  if (!proposal) return { success: false, message: "Proposal not found" };
  if (proposal.category !== "price_driver_params") return { success: false, message: "Only price_driver_params proposals can be executed" };
  if (proposal.status === "executed") return { success: false, message: "Already executed" };

  const result = await executePriceDriverProposal({
    id: proposal.id,
    title: proposal.title,
    category: proposal.category,
    executionPayload: proposal.executionPayload,
  });

  if (!result) return { success: false, message: "Execution failed — check executionPayload" };
  return { success: true, message: `Executed: ${result.parameter} = ${result.newValue}`, result };
}

export function startGovernanceExecutor(): void {
  if (executorInterval) return;
  console.log("[GovernanceExecutor] Starting — price_driver_params executor (poll every 5min)");

  runExecutionCycle().catch(() => {});

  executorInterval = setInterval(() => {
    runExecutionCycle().catch(() => {});
  }, 5 * 60 * 1000);

  process.on("SIGTERM", () => stopGovernanceExecutor());
  process.on("SIGINT", () => stopGovernanceExecutor());
}

export function stopGovernanceExecutor(): void {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
    console.log("[GovernanceExecutor] Stopped");
  }
}

export function isGovernanceExecutorRunning(): boolean {
  return executorInterval !== null;
}
