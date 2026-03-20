import { createHash, randomBytes } from "crypto";
import { calculatePhi } from "./iit-engine";
import { recordMintFee } from "./treasury-yield";
import { storage } from "./storage";
import * as liveChain from "./live-chain";
import { transmitRewardToWallet, isEngineConfigured, getTreasuryGasStatus } from "./alchemy-engine";
import { accumulateGasFromMining, sweepGasToTreasury } from "./treasury-yield";

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

const AUTO_PAYOUT_MIN_THRESHOLD = 0.1;
const AUTO_PAYOUT_DEFAULT_THRESHOLD = 1.0;
const AUTO_PAYOUT_FEE_PERCENT = 0.5;

export interface AutoPayoutConfig {
  enabled: boolean;
  externalWallet: string;
  threshold: number;
  pendingAmount: number;
  totalPaidOut: number;
  lastPayoutTime: number;
  payoutCount: number;
  payoutHistory: PayoutRecord[];
}

export interface PayoutRecord {
  amount: number;
  fee: number;
  netAmount: number;
  toAddress: string;
  txHash: string;
  timestamp: number;
}

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
  cycleRunning: boolean;
  autoPayout: AutoPayoutConfig;
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
  anchoredBlock: number;
  anchoredHash: string;
  autoPayout: AutoPayoutConfig;
}

export interface MiningEvent {
  type: "block_found" | "streak" | "milestone" | "premium" | "fee" | "difficulty_up" | "auto_payout";
  message: string;
  timestamp: number;
  reward?: number;
}

export interface MinedBlock {
  height: number;
  hash: string;
  previousHash: string;
  timestamp: number;
  miner: string;
  reward: number;
  phiBoost: number;
  streakMultiplier: number;
  difficulty: number;
  nonce: number;
  anchoredEthBlock: number;
  anchoredEthHash: string;
  algorithm: string;
}

const sessions = new Map<number, MiningSession>();
const lifetimeStats = new Map<number, { blocks: number; earned: number; bestStreak: number; achievements: Set<number> }>();
const userMinedBlocks = new Map<number, MinedBlock[]>();
const autoPayoutConfigs = new Map<number, AutoPayoutConfig>();

function createDefaultAutoPayoutConfig(): AutoPayoutConfig {
  return {
    enabled: false,
    externalWallet: "",
    threshold: AUTO_PAYOUT_DEFAULT_THRESHOLD,
    pendingAmount: 0,
    totalPaidOut: 0,
    lastPayoutTime: 0,
    payoutCount: 0,
    payoutHistory: [],
  };
}

function getAutoPayoutConfig(userId: number): AutoPayoutConfig {
  if (!autoPayoutConfigs.has(userId)) {
    autoPayoutConfigs.set(userId, createDefaultAutoPayoutConfig());
  }
  return autoPayoutConfigs.get(userId)!;
}

export function getMinedBlocks(userId: number): MinedBlock[] {
  return userMinedBlocks.get(userId) || [];
}

function getLifetimeStats(userId: number) {
  if (!lifetimeStats.has(userId)) {
    lifetimeStats.set(userId, { blocks: 0, earned: 0, bestStreak: 0, achievements: new Set() });
  }
  return lifetimeStats.get(userId)!;
}

function getStreakMultiplier(streak: number): number {
  for (let i = STREAK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_THRESHOLDS[i]) return STREAK_MULTIPLIERS[i];
  }
  return 1.0;
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
    anchoredBlock: 0,
    anchoredHash: "",
    autoPayout: createDefaultAutoPayoutConfig(),
  };
}

function addEvent(stats: MiningStats, event: MiningEvent) {
  stats.recentEvents.unshift(event);
  if (stats.recentEvents.length > 50) stats.recentEvents.pop();
}

async function runMiningCycle(session: MiningSession): Promise<void> {
  const { userId, walletId, stats } = session;

  if (session.cycleRunning) return;
  session.cycleRunning = true;

  try {
    const wallet = await storage.getWallet(walletId);
    if (!wallet) {
      console.warn(`[Background Miner] Wallet ${walletId} not found for user ${userId}, stopping`);
      stopMining(userId);
      return;
    }

    const isPremium = session.premiumPassExpiry > Date.now();
    stats.hasPremiumPass = isPremium;
    stats.premiumPassExpiry = session.premiumPassExpiry;

    const fee = isPremium ? MINING_FEE_PER_CYCLE * PREMIUM_FEE_DISCOUNT : MINING_FEE_PER_CYCLE;
    let currentBalance = parseFloat(wallet.balanceSkynt);
    if (currentBalance < fee) {
      addEvent(stats, {
        type: "fee",
        message: `Insufficient balance (${currentBalance.toFixed(4)} SKYNT). Mining paused.`,
        timestamp: Date.now(),
      });
      stopMining(userId);
      return;
    }

    let liveBlockSeed = "";
    let liveBlockNumber = 0;
    try {
      if (liveChain.isConfigured()) {
        const liveBlock = await liveChain.getLatestBlock("ethereum");
        liveBlockSeed = liveBlock.hash;
        liveBlockNumber = liveBlock.number;
      }
    } catch {}

    const seed = randomBytes(16).toString("hex");
    const nonce = Math.floor(Math.random() * 0xffffffff);
    const nonceBuf = Buffer.alloc(4);
    nonceBuf.writeUInt32LE(nonce);

    const blockHash = createHash("sha256")
      .update(Buffer.from(seed, "hex"))
      .update(nonceBuf)
      .update(Buffer.from(String(userId), "utf8"))
      .update(Buffer.from(liveBlockSeed, "utf8"))
      .digest("hex");

    const hashPrefix = BigInt("0x" + blockHash.slice(0, 16));
    const difficultyTarget = BigInt("0xffffffffffff") / BigInt(Math.max(1, Math.floor(stats.difficulty * 100)));
    const blockFound = hashPrefix < difficultyTarget;

    const simulatedNonces = 500 + Math.floor(Math.random() * 1500);
    stats.noncesChecked += simulatedNonces;
    stats.hashRate = Math.round(simulatedNonces / (MINE_INTERVAL_MS / 1000));
    stats.anchoredBlock = liveBlockNumber;
    stats.anchoredHash = liveBlockSeed.slice(0, 16);
    stats.cyclesCompleted++;

    const phiTimeSlot = Math.floor(Date.now() / 30000);
    const phiResult = calculatePhi(`mine-${userId}-${phiTimeSlot}`);
    stats.currentPhiBoost = Math.max(1.0, Math.min(2.0, Math.exp(phiResult.phi)));

    currentBalance -= fee;
    recordMintFee(fee, "background-mine", "SKYNT", `mine-fee-${Date.now()}-${userId}`);
    accumulateGasFromMining(fee);

    let totalMilestoneReward = 0;

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

      if (!userMinedBlocks.has(userId)) userMinedBlocks.set(userId, []);
      const blocks = userMinedBlocks.get(userId)!;
      const prevHash = blocks.length > 0 ? blocks[blocks.length - 1].hash : "0000000000000000000000000000000000000000000000000000000000000000";
      blocks.push({
        height: lt.blocks,
        hash: blockHash,
        previousHash: prevHash,
        timestamp: Date.now(),
        miner: session.username,
        reward,
        phiBoost: stats.currentPhiBoost,
        streakMultiplier: stats.streakMultiplier,
        difficulty: stats.difficulty,
        nonce,
        anchoredEthBlock: liveBlockNumber,
        anchoredEthHash: liveBlockSeed.slice(0, 16),
        algorithm: "qg-v8-three-gate",
      });
      if (blocks.length > 500) blocks.shift();

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

          totalMilestoneReward += milestone.reward;
          stats.totalSkyntEarned += milestone.reward;
          lt.earned += milestone.reward;

          await storage.createTransaction({
            walletId,
            type: "milestone_reward",
            token: "SKYNT",
            amount: milestone.reward.toString(),
            fromAddress: "SKYNT-TREASURY-MILESTONES",
            toAddress: wallet.address,
            status: "confirmed",
          });

          recordMintFee(milestone.reward * 0.1, "milestone-tax", "SKYNT", `milestone-${milestone.blocks}-${userId}`);
        }
      }

      currentBalance += reward + totalMilestoneReward;

      await storage.updateWalletBalance(walletId, "SKYNT", currentBalance.toString());

      await storage.createTransaction({
        walletId,
        type: "reward",
        token: "SKYNT",
        amount: reward.toString(),
        fromAddress: "0x0000000000000000000000000000000000000000",
        toAddress: wallet.address,
        status: "confirmed",
      });

      const ap = session.autoPayout;
      if (ap.enabled && ap.externalWallet) {
        ap.pendingAmount += reward + totalMilestoneReward;
        stats.autoPayout = { ...ap };

        if (ap.pendingAmount >= ap.threshold) {
          const payoutAmount = ap.pendingAmount;
          const fee = payoutAmount * (AUTO_PAYOUT_FEE_PERCENT / 100);
          const netAmount = payoutAmount - fee;

          if (currentBalance >= payoutAmount) {
            currentBalance -= payoutAmount;
            await storage.updateWalletBalance(walletId, "SKYNT", currentBalance.toString());

            let txHash = "0x" + randomBytes(32).toString("hex");
            let txStatus = "confirmed";
            let explorerUrl: string | null = null;

            if (isEngineConfigured() && ap.externalWallet.startsWith("0x")) {
              try {
                const transmitResult = await transmitRewardToWallet({
                  recipientAddress: ap.externalWallet,
                  amount: netAmount.toFixed(6),
                  chain: "ethereum",
                  token: "SKYNT",
                });
                if (transmitResult.txHash) {
                  txHash = transmitResult.txHash;
                  txStatus = transmitResult.status;
                  explorerUrl = transmitResult.explorerUrl;
                  console.log(`[AutoPayout] On-chain tx ${txHash} for user ${userId} — ${netAmount.toFixed(4)} SKYNT`);
                } else {
                  console.warn(`[AutoPayout] On-chain transmit returned no hash: ${transmitResult.status}`);
                  txStatus = transmitResult.status;
                }
              } catch (transmitErr: any) {
                console.error(`[AutoPayout] On-chain transmit failed for user ${userId}:`, transmitErr.message);
                txStatus = "pending_retry";
              }
            }

            await storage.createTransaction({
              walletId,
              type: "auto_payout",
              token: "SKYNT",
              amount: netAmount.toString(),
              fromAddress: wallet.address,
              toAddress: ap.externalWallet,
              status: txStatus,
              txHash,
            });

            if (fee > 0) {
              recordMintFee(fee, "auto-payout-fee", "SKYNT", `payout-fee-${Date.now()}-${userId}`);
            }

            const record: PayoutRecord = {
              amount: payoutAmount,
              fee,
              netAmount,
              toAddress: ap.externalWallet,
              txHash,
              timestamp: Date.now(),
            };

            ap.payoutHistory.unshift(record);
            if (ap.payoutHistory.length > 20) ap.payoutHistory.pop();
            ap.totalPaidOut += netAmount;
            ap.lastPayoutTime = Date.now();
            ap.payoutCount++;
            ap.pendingAmount = 0;
            stats.autoPayout = { ...ap };

            addEvent(stats, {
              type: "auto_payout",
              message: `Auto-payout: ${netAmount.toFixed(4)} SKYNT → ${ap.externalWallet.slice(0, 6)}...${ap.externalWallet.slice(-4)} [${txStatus}]${explorerUrl ? ` | ${explorerUrl}` : ""}`,
              timestamp: Date.now(),
              reward: netAmount,
            });

            // After payout, check gas health and auto-sweep if critical
            try {
              const gasStatus = await getTreasuryGasStatus();
              if (gasStatus.isCritical || !gasStatus.isHealthy) {
                const swept = await sweepGasToTreasury(gasStatus.isCritical);
                if (swept) {
                  console.log(`[Gas Refill] Auto-sweep triggered: ${swept.ethAmount.toFixed(6)} ETH | ${swept.status}`);
                }
              }
            } catch (gasErr: any) {
              console.warn("[Gas Refill] Auto-sweep check failed:", gasErr.message);
            }
          }
        }
      }

      const oldDifficulty = stats.difficulty;
      const logBlocks = Math.log2(Math.max(1, stats.blocksFound));
      stats.difficulty = 1.0 + (logBlocks * 0.15) + (Math.min(stats.streak, 50) * 0.003);
      stats.difficulty = Math.min(stats.difficulty, 5.0);
      if (stats.difficulty > oldDifficulty + 0.01) {
        addEvent(stats, {
          type: "difficulty_up",
          message: `Difficulty increased: ${stats.difficulty.toFixed(3)}`,
          timestamp: Date.now(),
        });
      }
    } else {
      if (stats.streak > 0) {
        stats.streak = Math.max(0, stats.streak - 1);
      }
      stats.streakMultiplier = getStreakMultiplier(stats.streak);
      const logBlocks = Math.log2(Math.max(1, stats.blocksFound));
      stats.difficulty = 1.0 + (logBlocks * 0.15);
      stats.difficulty = Math.min(stats.difficulty, 5.0);

      await storage.updateWalletBalance(walletId, "SKYNT", currentBalance.toString());
    }

    stats.uptimeSeconds = Math.floor((Date.now() - stats.sessionStartedAt) / 1000);
  } catch (error) {
    console.error(`[Background Miner] Error in cycle for user ${userId}:`, error);
  } finally {
    session.cycleRunning = false;
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

  const apConfig = getAutoPayoutConfig(userId);
  const user = await storage.getUser(userId);
  if (user?.walletAddress && apConfig.externalWallet === "") {
    apConfig.externalWallet = user.walletAddress;
  }
  stats.autoPayout = { ...apConfig };

  const session: MiningSession = {
    userId,
    username,
    walletId: wallet.id,
    startedAt: Date.now(),
    intervalHandle: null as any,
    stats,
    premiumPassExpiry: 0,
    cycleRunning: false,
    autoPayout: apConfig,
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
    stats.autoPayout = { ...getAutoPayoutConfig(userId) };
    return stats;
  }
  session.stats.uptimeSeconds = Math.floor((Date.now() - session.stats.sessionStartedAt) / 1000);
  session.stats.autoPayout = { ...session.autoPayout };
  return { ...session.stats };
}

export async function configureAutoPayout(
  userId: number,
  opts: { enabled?: boolean; threshold?: number; externalWallet?: string }
): Promise<{ success: boolean; message: string; config: AutoPayoutConfig }> {
  const config = getAutoPayoutConfig(userId);

  if (opts.externalWallet !== undefined) {
    if (opts.externalWallet && !/^0x[a-fA-F0-9]{40}$/.test(opts.externalWallet)) {
      return { success: false, message: "Invalid Ethereum address format", config };
    }
    config.externalWallet = opts.externalWallet;
  }

  if (opts.threshold !== undefined) {
    if (opts.threshold < AUTO_PAYOUT_MIN_THRESHOLD) {
      return { success: false, message: `Minimum payout threshold is ${AUTO_PAYOUT_MIN_THRESHOLD} SKYNT`, config };
    }
    config.threshold = opts.threshold;
  }

  if (opts.enabled !== undefined) {
    if (opts.enabled && !config.externalWallet) {
      const user = await storage.getUser(userId);
      if (user?.walletAddress) {
        config.externalWallet = user.walletAddress;
      } else {
        return { success: false, message: "Connect and link an external wallet first to enable auto-payout", config };
      }
    }
    config.enabled = opts.enabled;
  }

  autoPayoutConfigs.set(userId, config);

  const session = sessions.get(userId);
  if (session) {
    session.autoPayout = config;
    session.stats.autoPayout = { ...config };

    if (config.enabled) {
      addEvent(session.stats, {
        type: "auto_payout",
        message: `Auto-payout ${config.enabled ? "enabled" : "disabled"} — threshold: ${config.threshold} SKYNT → ${config.externalWallet.slice(0, 6)}...${config.externalWallet.slice(-4)}`,
        timestamp: Date.now(),
      });
    }
  }

  return { success: true, message: config.enabled ? "Auto-payout enabled" : "Auto-payout updated", config };
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
