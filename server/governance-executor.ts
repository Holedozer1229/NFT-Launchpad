import { db } from "./db";
import { governanceProposals, protocolSettings } from "@shared/schema";
import { eq, and, lte, sql as drizzleSql } from "drizzle-orm";
import { wsHub } from "./ws-hub";

interface ExecutionResult {
  proposalId: number;
  title: string;
  category: string;
  settingsWritten: string[];
  executedAt: string;
}

const EXECUTION_LOG_MAX = 50;
let executionLog: ExecutionResult[] = [];
let executorInterval: ReturnType<typeof setInterval> | null = null;

function parsePayload(description: string, category: string): Record<string, string> | null {
  const params: Record<string, string> = {};

  if (category === "parameter") {
    const patterns: [RegExp, string][] = [
      [/mining[_\s]reward[s]?\s*[=:]\s*([\d.]+)/i, "mining_reward"],
      [/halving[_\s]interval\s*[=:]\s*([\d,]+)/i, "halving_interval"],
      [/reinvestment[_\s]rate\s*[=:]\s*([\d.]+%?)/i, "reinvestment_rate"],
      [/gas[_\s]refill[_\s]threshold\s*[=:]\s*([\d.]+)/i, "gas_refill_threshold"],
      [/bridge[_\s]fee[_\s]bps\s*[=:]\s*([\d]+)/i, "bridge_fee_bps"],
      [/quorum[_\s]required\s*[=:]\s*([\d]+)/i, "quorum_required"],
      [/timelock[_\s]hours\s*[=:]\s*([\d]+)/i, "timelock_hours"],
      [/max[_\s]supply\s*[=:]\s*([\d,_]+)/i, "max_supply"],
    ];
    for (const [re, key] of patterns) {
      const m = description.match(re);
      if (m) params[key] = m[1].replace(/,|_/g, "");
    }
    if (Object.keys(params).length === 0) {
      params["parameter_update"] = `proposal_executed_${Date.now()}`;
    }
    return params;
  }

  if (category === "treasury") {
    const patterns: [RegExp, string][] = [
      [/allocate\s+([\d.]+)\s*%?\s*(?:of\s+treasury\s+)?to\s+([\w\s]+)/i, "treasury_allocation"],
      [/buyback[_\s]budget\s*[=:]\s*([\d.]+)/i, "buyback_budget_eth"],
      [/aave[_\s]deposit\s*[=:]\s*([\d.]+)/i, "aave_deposit_eth"],
    ];
    for (const [re, key] of patterns) {
      const m = description.match(re);
      if (m) params[key] = m[1];
    }
    if (Object.keys(params).length === 0) {
      params["treasury_decision"] = `executed_${Date.now()}`;
    }
    return params;
  }

  if (category === "protocol") {
    params["protocol_update"] = `gip_executed_${Date.now()}`;
    return params;
  }

  if (category === "upgrade") {
    params["upgrade_executed"] = `${Date.now()}`;
    return params;
  }

  if (category === "community") {
    params["community_decision"] = `executed_${Date.now()}`;
    return params;
  }

  return { generic_execution: `${Date.now()}` };
}

async function executeProposal(proposal: {
  id: number;
  title: string;
  category: string;
  description: string;
  votesFor: number;
  quorumRequired: number;
  endsAt: Date | string;
}): Promise<ExecutionResult | null> {
  const params = parsePayload(proposal.description, proposal.category);
  if (!params) return null;

  const settingsWritten: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    const existing = await db
      .select()
      .from(protocolSettings)
      .where(eq(protocolSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(protocolSettings)
        .set({
          value,
          updatedBy: `governance:gip-${proposal.id}`,
          updatedAt: new Date(),
        })
        .where(eq(protocolSettings.key, key));
    } else {
      await db.insert(protocolSettings).values({
        key,
        value,
        updatedBy: `governance:gip-${proposal.id}`,
      });
    }
    settingsWritten.push(`${key}=${value}`);
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
    settingsWritten,
    executedAt: new Date().toISOString(),
  };

  executionLog.unshift(result);
  if (executionLog.length > EXECUTION_LOG_MAX) executionLog.pop();

  wsHub.broadcast("governance:executed", {
    proposalId: proposal.id,
    title: proposal.title,
    settingsWritten,
    executionHash,
  });

  console.log(`[GovernanceExecutor] GIP-${String(proposal.id).padStart(3, "0")} executed — settings: [${settingsWritten.join(", ")}]`);

  return result;
}

async function runExecutionCycle(): Promise<void> {
  try {
    const now = new Date();

    const expired = await db
      .select()
      .from(governanceProposals)
      .where(
        and(
          eq(governanceProposals.status, "active"),
          lte(governanceProposals.endsAt, now)
        )
      );

    for (const proposal of expired) {
      const total = (proposal.votesFor ?? 0) + (proposal.votesAgainst ?? 0) + (proposal.votesAbstain ?? 0);
      const quorumMet = total >= (proposal.quorumRequired ?? 100);
      const forWins = (proposal.votesFor ?? 0) > (proposal.votesAgainst ?? 0);

      if (quorumMet && forWins) {
        await executeProposal({
          id: proposal.id,
          title: proposal.title,
          category: proposal.category,
          description: proposal.description,
          votesFor: proposal.votesFor ?? 0,
          quorumRequired: proposal.quorumRequired ?? 100,
          endsAt: proposal.endsAt!,
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

export function getProtocolSettingsList(): Promise<{ key: string; value: string; updatedBy: string; updatedAt: Date | null }[]> {
  return db
    .select({
      key: protocolSettings.key,
      value: protocolSettings.value,
      updatedBy: protocolSettings.updatedBy,
      updatedAt: protocolSettings.updatedAt,
    })
    .from(protocolSettings)
    .orderBy(protocolSettings.updatedAt);
}

export function startGovernanceExecutor(): void {
  if (executorInterval) return;
  console.log("[GovernanceExecutor] Starting (poll every 5min)");

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
