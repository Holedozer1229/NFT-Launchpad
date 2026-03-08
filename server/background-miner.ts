import { createHash, randomBytes } from "crypto";
import { calculatePhi } from "./iit-engine";
import { recordMintFee } from "./treasury-yield";
import { storage } from "./storage";

const MINE_INTERVAL_MS = 15_000;
const MINING_FEE_PER_CYCLE = 0.01;
const BASE_REWARD_PER_CYCLE = 0.25;
const MAX_CONCURRENT_SESSIONS = 200;

const STREAK_THRESHOLDS = [3, 5, 10, 25, 50, 100];
const STREAK_MULTIPLIERS = [1.1, 1.25, 1.5, 2.0, 2.5, 3.0];

const MILESTONES = [
  { blocks: 1, reward: 0.5, title: "First Strike", desc: "Mine your first block" },
  { blocks: 5, reward: 1.0, title: "Pickaxe Apprentice", desc: "Mine 5 blocks" },
  { blocks: 10, reward: 2.5, title: "Hashrate Hunter", desc: "Mine 10 blocks" },
  { blocks: 25, reward: 5.0, title: "Block Baron", desc: "Mine 25 blocks" },
  { blocks: 50, reward: 10.0, title: "Quantum Forger", desc: "Mine 50 blocks" },
  { blocks: 100, reward: 25.0, title: "Oracle Miner", desc: "Mine 100 blocks" },
  { blocks: 250, reward: 50.0, title: "Consensus Architect", desc: "Mine 250 blocks" },
  { blocks: 500, reward: 100.0, title: "Genesis Titan", desc: "Mine 500 blocks" },
];

const PREMIUM_MINING_PASS_FEE = 5.0;
const PREMIUM_PASS_DURATION_MS = 24 * 60 * 60 * 1000;
const PREMIUM_REWARD_BOOST = 1.5;
const PREMIUM_FEE_DISCOUNT = 0.5;

export interface MiningMilestone {
  blocks: number;
  reward: number;
  title: string;
  desc: string;
  achieved: boolean;
  achievedAt?: number;
}

interface MiningSession {
  userId: number;
  username: string;
  walletId: number;
  startedAt: number;
  intervalHandle: ReturnType<typeof setInterval>;
  stats: MiningStats;
  premiumPassExpiry: number;
}

export interface MiningStats {
  isActive: boolean;
  hashRate: number;
  blocksFound: number;
  totalSkyntEarned: number;
  currentPhiBoost: number;
  cyclesCompleted: number;
  lastBlockHash: string;
  lastBlockTime: number;
  sessionStartedAt: number;
  uptimeSeconds: number;
  difficulty: number;
  noncesChecked: number;
  streak: number;
  bestStreak: number;
  streakMultiplier: number;
  milestones: MiningMilestone[];
  lifetimeBlocksFound: number;
  lifetimeSkyntEarned: number;
  hasPremiumPass: boolean;
  premiumPassExpiry: number;
  recentEvents: MiningEvent[];
}

export interface MiningEvent {
  type: "block_found" | "streak" | "milestone" | "premium" | "fee" | "difficulty_up";
  message: string;
  timestamp: number;
  reward?: number;
}

const sessions = new Map<number, MiningSession>();
const lifetimeStats = new Map<number, { blocks: number; earned: number; bestStreak: number; achievements: Set<number> }>();

function getLifetimeStats(userId: number) {
  if (!lifetimeStats.has(userId)) {
    lifetimeStats.set(userId, { blocks: 0, earned: 0, bestStreak: 0, achievements: new Set() });
  }
  return lifetimeStats.get(userId)!;
}

function getStreakMultiplier(streak: number): number {
  let mult = 1.0;
  for (let i = STREAK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_THRESHOLDS[i]) {
      mult = STREAK_MULTIPLIERS[i];
      break;
    }
  }
  return mult;
}

function createEmptyStats(): MiningStats {
  return {
    isActive: false,
    hashRate: 0,
    blocksFound: 0,
    totalSkyntEarned: 0,
    currentPhiBoost: 1.0,
    cyclesCompleted: 0,
    lastBlockHash: "",
    lastBlockTime: 0,
    sessionStartedAt: 0,
    uptimeSeconds: 0,
    difficulty: 1.0,
    noncesChecked: 0,
    streak: 0,
    bestStreak: 0,
    streakMultiplier: 1.0,
    milestones: MILESTONES.map(m => ({ ...m, achieved: false })),
    lifetimeBlocksFound: 0,
    lifetimeSkyntEarned: 0,
    hasPremiumPass: false,
    premiumPassExpiry: 0,
    recentEvents: [],
  };
}

function addEvent(stats: MiningStats, event: MiningEvent) {
  stats.recentEvents.unshift(event);
  if (stats.recentEvents.length > 50) stats.recentEvents.pop();
}

async function runMiningCycle(session: MiningSession): Promise<void> {
  const { userId, walletId, stats } = session;

  try {
    const wallet = await storage.getWallet(walletId);
    if (!wallet) {
      stopMining(userId);
      return;
    }

    const isPremium = session.premiumPassExpiry > Date.now();
    stats.hasPremiumPass = isPremium;
    stats.premiumPassExpiry = session.premiumPassExpiry;

    const fee = isPremium ? MINING_FEE_PER_CYCLE * PREMIUM_FEE_DISCOUNT : MINING_FEE_PER_CYCLE;
    const currentBalance = parseFloat(wallet.balanceSkynt);
    if (currentBalance < fee) {
      stopMining(userId);
      return;
    }

    const seed = randomBytes(16).toString("hex");
    const nonce = Math.floor(Math.random() * 0xffffffff);
    const nonceBuf = Buffer.alloc(4);
    nonceBuf.writeUInt32LE(nonce);

    const blockHash = createHash("sha256")
      .update(Buffer.from(seed, "hex"))
      .update(nonceBuf)
      .update(Buffer.from(String(userId), "utf8"))
      .digest("hex");

    const hashPrefix = BigInt("0x" + blockHash.slice(0, 16));
    const difficultyTarget = BigInt("0xffffffffffff") / BigInt(Math.max(1, Math.floor(stats.difficulty * 100)));
    const blockFound = hashPrefix < difficultyTarget;

    const simulatedNonces = 500 + Math.floor(Math.random() * 1500);
    stats.noncesChecked += simulatedNonces;
    stats.hashRate = Math.round(simulatedNonces / (MINE_INTERVAL_MS / 1000));
    stats.cyclesCompleted++;

    const phiResult = calculatePhi(`mine-${userId}-${Date.now()}`);
    stats.currentPhiBoost = Math.min(2.0, Math.exp(phiResult.phi));

    await storage.updateWalletBalance(walletId, "SKYNT", (currentBalance - fee).toString());
    recordMintFee(fee, "background-mine", "SKYNT", `mine-fee-${Date.now()}-${userId}`);

    if (blockFound) {
      stats.blocksFound++;
      stats.streak++;
      const lt = getLifetimeStats(userId);
      lt.blocks++;

      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      if (stats.streak > lt.bestStreak) lt.bestStreak = stats.streak;

      stats.streakMultiplier = getStreakMultiplier(stats.streak);

      const premiumBoost = isPremium ? PREMIUM_REWARD_BOOST : 1.0;
      const reward = BASE_REWARD_PER_CYCLE * stats.currentPhiBoost * stats.streakMultiplier * premiumBoost;
      stats.totalSkyntEarned += reward;
      lt.earned += reward;
      stats.lifetimeBlocksFound = lt.blocks;
      stats.lifetimeSkyntEarned = lt.earned;

      stats.lastBlockHash = blockHash.slice(0, 16);
      stats.lastBlockTime = Date.now();

      addEvent(stats, {
        type: "block_found",
        message: `Block mined! Hash: ${blockHash.slice(0, 12)}... | +${reward.toFixed(4)} SKYNT`,
        timestamp: Date.now(),
        reward,
      });

      if (stats.streak >= 3 && STREAK_THRESHOLDS.includes(stats.streak)) {
        addEvent(stats, {
          type: "streak",
          message: `${stats.streak}x Streak! Mining bonus: ${stats.streakMultiplier.toFixed(2)}x`,
          timestamp: Date.now(),
        });
      }

      for (const milestone of stats.milestones) {
        if (!milestone.achieved && lt.blocks >= milestone.blocks && !lt.achievements.has(milestone.blocks)) {
          milestone.achieved = true;
          milestone.achievedAt = Date.now();
          lt.achievements.add(milestone.blocks);

          addEvent(stats, {
            type: "milestone",
            message: `Achievement Unlocked: "${milestone.title}" — +${milestone.reward} SKYNT`,
            timestamp: Date.now(),
            reward: milestone.reward,
          });

          const mWallet = await storage.getWallet(walletId);
          if (mWallet) {
            const mBalance = parseFloat(mWallet.balanceSkynt) + milestone.reward;
            await storage.updateWalletBalance(walletId, "SKYNT", mBalance.toString());
            stats.totalSkyntEarned += milestone.reward;
            lt.earned += milestone.reward;

            await storage.createTransaction({
              walletId,
              type: "milestone_reward",
              token: "SKYNT",
              amount: milestone.reward.toString(),
              fromAddress: "SKYNT-TREASURY-MILESTONES",
              toAddress: mWallet.address,
              status: "confirmed",
            });

            recordMintFee(milestone.reward * 0.1, "milestone-tax", "SKYNT", `milestone-${milestone.blocks}-${userId}`);
          }
        }
      }

      const updatedWallet = await storage.getWallet(walletId);
      if (updatedWallet) {
        const newBalance = parseFloat(updatedWallet.balanceSkynt) + reward;
        await storage.updateWalletBalance(walletId, "SKYNT", newBalance.toString());

        await storage.createTransaction({
          walletId,
          type: "reward",
          token: "SKYNT",
          amount: reward.toString(),
          fromAddress: "0x0000000000000000000000000000000000000000",
          toAddress: updatedWallet.address,
          status: "confirmed",
        });
      }

      const oldDifficulty = stats.difficulty;
      stats.difficulty = 1.0 + (stats.blocksFound * 0.02) + (stats.streak * 0.005);
      if (stats.difficulty > oldDifficulty + 0.01) {
        addEvent(stats, {
          type: "difficulty_up",
          message: `Difficulty increased: ${stats.difficulty.toFixed(3)}`,
          timestamp: Date.now(),
        });
      }
    } else {
      stats.streak = 0;
      stats.streakMultiplier = 1.0;
      stats.difficulty = 1.0 + (stats.blocksFound * 0.02);
    }

    stats.uptimeSeconds = Math.floor((Date.now() - stats.sessionStartedAt) / 1000);
  } catch (error) {
    console.error(`[Background Miner] Error in cycle for user ${userId}:`, error);
  }
}

export async function startMining(userId: number, username: string): Promise<{ success: boolean; message: string; stats?: MiningStats }> {
  if (sessions.has(userId)) {
    const session = sessions.get(userId)!;
    session.stats.uptimeSeconds = Math.floor((Date.now() - session.stats.sessionStartedAt) / 1000);
    return { success: true, message: "Mining already active", stats: session.stats };
  }

  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    return { success: false, message: "Mining pool is full. Try again later." };
  }

  const userWallets = await storage.getWalletsByUser(userId);
  if (userWallets.length === 0) {
    return { success: false, message: "No wallet found. Create a wallet first." };
  }

  const wallet = userWallets[0];
  const balance = parseFloat(wallet.balanceSkynt);
  if (balance < MINING_FEE_PER_CYCLE * 5) {
    return { success: false, message: `Insufficient SKYNT balance. Need at least ${(MINING_FEE_PER_CYCLE * 5).toFixed(2)} SKYNT to start mining.` };
  }

  const stats = createEmptyStats();
  stats.isActive = true;
  stats.sessionStartedAt = Date.now();

  const lt = getLifetimeStats(userId);
  stats.lifetimeBlocksFound = lt.blocks;
  stats.lifetimeSkyntEarned = lt.earned;
  stats.bestStreak = lt.bestStreak;

  for (const milestone of stats.milestones) {
    if (lt.achievements.has(milestone.blocks)) {
      milestone.achieved = true;
    }
  }

  const session: MiningSession = {
    userId,
    username,
    walletId: wallet.id,
    startedAt: Date.now(),
    intervalHandle: null as any,
    stats,
    premiumPassExpiry: 0,
  };

  session.intervalHandle = setInterval(() => runMiningCycle(session), MINE_INTERVAL_MS);

  sessions.set(userId, session);
  console.log(`[Background Miner] Started mining for user ${username} (ID: ${userId})`);

  addEvent(stats, { type: "fee", message: "Mining session initialized", timestamp: Date.now() });

  runMiningCycle(session);

  return { success: true, message: "Mining started", stats };
}

export function stopMining(userId: number): { success: boolean; message: string; stats?: MiningStats } {
  const session = sessions.get(userId);
  if (!session) {
    return { success: true, message: "No active mining session" };
  }

  clearInterval(session.intervalHandle);
  session.stats.isActive = false;
  session.stats.uptimeSeconds = Math.floor((Date.now() - session.stats.sessionStartedAt) / 1000);

  const finalStats = { ...session.stats };
  sessions.delete(userId);

  console.log(`[Background Miner] Stopped mining for user ${session.username} (ID: ${userId}) — earned ${finalStats.totalSkyntEarned.toFixed(4)} SKYNT in ${finalStats.uptimeSeconds}s`);

  return { success: true, message: "Mining stopped", stats: finalStats };
}

export function getMiningStatus(userId: number): MiningStats {
  const session = sessions.get(userId);
  if (!session) {
    const stats = createEmptyStats();
    const lt = getLifetimeStats(userId);
    stats.lifetimeBlocksFound = lt.blocks;
    stats.lifetimeSkyntEarned = lt.earned;
    stats.bestStreak = lt.bestStreak;
    return stats;
  }
  session.stats.uptimeSeconds = Math.floor((Date.now() - session.stats.sessionStartedAt) / 1000);
  return { ...session.stats };
}

export async function activatePremiumPass(userId: number): Promise<{ success: boolean; message: string }> {
  const session = sessions.get(userId);

  const userWallets = await storage.getWalletsByUser(userId);
  if (userWallets.length === 0) {
    return { success: false, message: "No wallet found" };
  }

  const wallet = userWallets[0];
  const balance = parseFloat(wallet.balanceSkynt);
  if (balance < PREMIUM_MINING_PASS_FEE) {
    return { success: false, message: `Insufficient balance. Need ${PREMIUM_MINING_PASS_FEE} SKYNT for premium pass.` };
  }

  await storage.updateWalletBalance(wallet.id, "SKYNT", (balance - PREMIUM_MINING_PASS_FEE).toString());
  recordMintFee(PREMIUM_MINING_PASS_FEE, "premium-pass", "SKYNT", `premium-${Date.now()}-${userId}`);

  await storage.createTransaction({
    walletId: wallet.id,
    type: "premium_pass",
    token: "SKYNT",
    amount: PREMIUM_MINING_PASS_FEE.toString(),
    fromAddress: wallet.address,
    toAddress: "SKYNT-TREASURY",
    status: "confirmed",
  });

  const expiry = Date.now() + PREMIUM_PASS_DURATION_MS;
  if (session) {
    session.premiumPassExpiry = expiry;
    session.stats.hasPremiumPass = true;
    session.stats.premiumPassExpiry = expiry;
    addEvent(session.stats, {
      type: "premium",
      message: `Premium Mining Pass activated! 1.5x rewards, 50% fee discount for 24h`,
      timestamp: Date.now(),
    });
  }

  return { success: true, message: "Premium Mining Pass activated for 24 hours!" };
}

export function getMiningLeaderboard(): Array<{ username: string; blocks: number; earned: number; bestStreak: number }> {
  const board: Array<{ username: string; blocks: number; earned: number; bestStreak: number }> = [];

  for (const [, session] of sessions) {
    const lt = getLifetimeStats(session.userId);
    board.push({
      username: session.username,
      blocks: lt.blocks,
      earned: lt.earned,
      bestStreak: lt.bestStreak,
    });
  }

  return board.sort((a, b) => b.earned - a.earned).slice(0, 20);
}

export function stopAllMining(): void {
  for (const [userId] of sessions) {
    stopMining(userId);
  }
  console.log("[Background Miner] All mining sessions stopped");
}

export function getActiveMinerCount(): number {
  return sessions.size;
}
