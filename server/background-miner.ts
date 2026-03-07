import { createHash, randomBytes } from "crypto";
import { calculatePhi } from "./iit-engine";
import { recordMintFee } from "./treasury-yield";
import { storage } from "./storage";

const MINE_INTERVAL_MS = 15_000;
const MINING_FEE_PER_CYCLE = 0.01;
const BASE_REWARD_PER_CYCLE = 0.25;
const MAX_CONCURRENT_SESSIONS = 200;

interface MiningSession {
  userId: number;
  username: string;
  walletId: number;
  startedAt: number;
  intervalHandle: ReturnType<typeof setInterval>;
  stats: MiningStats;
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
}

const sessions = new Map<number, MiningSession>();

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
  };
}

async function runMiningCycle(session: MiningSession): Promise<void> {
  const { userId, walletId, stats } = session;

  try {
    const wallet = await storage.getWallet(walletId);
    if (!wallet) {
      stopMining(userId);
      return;
    }

    const currentBalance = parseFloat(wallet.balanceSkynt);
    if (currentBalance < MINING_FEE_PER_CYCLE) {
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

    await storage.updateWalletBalance(walletId, "SKYNT", (currentBalance - MINING_FEE_PER_CYCLE).toString());
    recordMintFee(MINING_FEE_PER_CYCLE, "background-mine", "SKYNT", `mine-fee-${Date.now()}-${userId}`);

    if (blockFound) {
      stats.blocksFound++;
      const reward = BASE_REWARD_PER_CYCLE * stats.currentPhiBoost;
      stats.totalSkyntEarned += reward;
      stats.lastBlockHash = blockHash.slice(0, 16);
      stats.lastBlockTime = Date.now();

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
    }

    stats.difficulty = 1.0 + (stats.blocksFound * 0.02);
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

  const session: MiningSession = {
    userId,
    username,
    walletId: wallet.id,
    startedAt: Date.now(),
    intervalHandle: null as any,
    stats,
  };

  session.intervalHandle = setInterval(() => runMiningCycle(session), MINE_INTERVAL_MS);

  sessions.set(userId, session);
  console.log(`[Background Miner] Started mining for user ${username} (ID: ${userId})`);

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
    return createEmptyStats();
  }
  session.stats.uptimeSeconds = Math.floor((Date.now() - session.stats.sessionStartedAt) / 1000);
  return { ...session.stats };
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
