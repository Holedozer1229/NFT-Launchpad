import { createHash, randomBytes } from "crypto";
import { 
  MERGE_MINING_CHAINS, 
  RANDOMX_CONFIG, 
  STX_LENDING_TIERS,
  type MergeMiningChainId,
  type StxLendingTierId
} from "@shared/schema";
import { qgMiner } from "./qg-miner-v8";
import { storage } from "./storage";
import { recordMintFee } from "./treasury-yield";
import * as liveChain from "./live-chain";

export interface MergeMiningStats {
  chainId: MergeMiningChainId;
  isActive: boolean;
  hashRate: number;
  blocksFound: number;
  rewardsEarned: number;
  difficulty: number;
  lastBlockHash: string;
  lastBlockTime: number;
}

export interface StxLendingState {
  userId: number;
  stakedAmount: number;
  tierId: StxLendingTierId | null;
  startTime: number | null;
  accruedYield: number;
}

export interface GenesisBlock {
  height: number;
  hash: string;
  previousHash: string;
  timestamp: number;
  merkleRoot: string;
  difficulty: number;
  nonce: number;
  reward: number;
  supply: number;
}

interface UserMiningSession {
  userId: number;
  activeChains: Map<MergeMiningChainId, ReturnType<typeof setInterval>>;
  stats: Map<MergeMiningChainId, MergeMiningStats>;
}

const userSessions = new Map<number, UserMiningSession>();
const userLendingState = new Map<number, StxLendingState>();

const BTC_GENESIS_BLOCK: GenesisBlock = {
  height: 0,
  hash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
  previousHash: "0".repeat(64),
  timestamp: 1231006505,
  merkleRoot: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
  difficulty: 1,
  nonce: 2083236893,
  reward: 50,
  supply: 50,
};

const chainBlocks = new Map<string, Array<{
  height: number;
  hash: string;
  miner: string;
  reward: number;
  timestamp: number;
  algorithm: string;
}>>();

const MINE_INTERVAL_MS = 5000;

function getOrCreateSession(userId: number): UserMiningSession {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      userId,
      activeChains: new Map(),
      stats: new Map(),
    });
  }
  return userSessions.get(userId)!;
}

function createEmptyStats(chainId: MergeMiningChainId): MergeMiningStats {
  const config = MERGE_MINING_CHAINS[chainId];
  return {
    chainId,
    isActive: false,
    hashRate: 0,
    blocksFound: 0,
    rewardsEarned: 0,
    difficulty: config.difficultyFactor,
    lastBlockHash: "",
    lastBlockTime: 0,
  };
}

async function runMergeMiningCycle(userId: number, chainId: MergeMiningChainId) {
  const session = getOrCreateSession(userId);
  const stats = session.stats.get(chainId) || createEmptyStats(chainId);
  const config = MERGE_MINING_CHAINS[chainId];

  try {
    let liveAnchorHash = "";
    try {
      if (liveChain.isConfigured()) {
        const liveBlock = await liveChain.getLatestBlock("ethereum");
        liveAnchorHash = liveBlock.hash;
      }
    } catch {}

    const seed = randomBytes(32).toString("hex") + liveAnchorHash;

    const hashLoopStart = Date.now();
    let realHashes = 0;
    while (Date.now() - hashLoopStart < 15) {
      const nb = Buffer.alloc(4);
      nb.writeUInt32LE(realHashes++);
      createHash("sha256").update(Buffer.from(seed.slice(0, 32), "utf8")).update(nb).digest();
    }
    const hashElapsed = Math.max(1, Date.now() - hashLoopStart);
    stats.hashRate = Math.round(realHashes / (hashElapsed / 1000));
    const nonce = Math.floor(Math.random() * 0xffffffff);
    
    let blockFound = false;
    let blockHash = "";

    if (config.algorithm === "auxpow") {
      const qgResult = qgMiner.mine(`auxpow-${chainId}-${seed}`, stats.difficulty);
      
      blockHash = qgResult.blockHash || createHash("sha256").update(seed + nonce).digest("hex");
      const target = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / BigInt(Math.max(1, Math.floor(stats.difficulty * 1000)));
      blockFound = BigInt("0x" + blockHash) < target;
      
    } else if (config.algorithm === "randomx") {
      const rxSeed = createHash("sha256").update(seed + RANDOMX_CONFIG.iterationsPerHash).digest("hex");
      blockHash = createHash("sha256").update(rxSeed + nonce).digest("hex");
      const target = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / BigInt(Math.max(1, RANDOMX_CONFIG.soloMiningDifficulty * 1000));
      blockFound = BigInt("0x" + blockHash) < target;
      
    } else if (config.algorithm === "zkevm" || (config as any).algorithm === "zksync") {
      const proofSeed = `zk-proof-${chainId}-${seed}-${nonce}`;
      blockHash = createHash("sha256").update(proofSeed).digest("hex");
      blockFound = Math.random() < (1 / (stats.difficulty * 10));
    }

    if (blockFound) {
      stats.blocksFound++;
      const reward = config.rewardMultiplier * (1 + Math.random() * 0.1);
      stats.rewardsEarned += reward;
      stats.lastBlockHash = blockHash.slice(0, 16);
      stats.lastBlockTime = Date.now();

      if (!chainBlocks.has(chainId)) chainBlocks.set(chainId, []);
      const blocks = chainBlocks.get(chainId)!;
      blocks.push({
        height: stats.blocksFound,
        hash: blockHash,
        miner: `user-${userId}`,
        reward,
        timestamp: Date.now(),
        algorithm: config.algorithm,
      });
      if (blocks.length > 50) blocks.shift();
    }

    if (stats.blocksFound > 0 && stats.blocksFound % 5 === 0) {
      stats.difficulty *= 1.05;
    }

    session.stats.set(chainId, stats);
  } catch (error) {
    console.error(`[Merge Miner] Error in cycle for user ${userId} on chain ${chainId}:`, error);
  }
}

export function startMergeMining(userId: number, chainId: MergeMiningChainId) {
  const session = getOrCreateSession(userId);
  
  if (session.activeChains.has(chainId)) {
    return { success: true, message: "Mining already active" };
  }

  const stats = session.stats.get(chainId) || createEmptyStats(chainId);
  stats.isActive = true;
  session.stats.set(chainId, stats);

  const handle = setInterval(() => runMergeMiningCycle(userId, chainId), MINE_INTERVAL_MS);
  session.activeChains.set(chainId, handle);

  runMergeMiningCycle(userId, chainId);

  return { success: true, message: `Started merge mining on ${chainId}` };
}

export function stopMergeMining(userId: number, chainId: MergeMiningChainId) {
  const session = userSessions.get(userId);
  if (!session) return { success: false, message: "No active session" };

  const handle = session.activeChains.get(chainId);
  if (handle) {
    clearInterval(handle);
    session.activeChains.delete(chainId);
  }

  const stats = session.stats.get(chainId);
  if (stats) {
    stats.isActive = false;
    stats.hashRate = 0;
  }

  return { success: true, message: `Stopped merge mining on ${chainId}` };
}

export function getMergeMiningStatus(userId: number): MergeMiningStats[] {
  const session = userSessions.get(userId);
  if (!session) return [];
  return Array.from(session.stats.values());
}

export function getMergeMiningStatusMap(userId: number): { mergeMining: Record<string, MergeMiningStats>; randomx: MergeMiningStats | null } {
  const session = userSessions.get(userId);
  const mergeMining: Record<string, MergeMiningStats> = {};
  let randomx: MergeMiningStats | null = null;
  if (session) {
    for (const [chainId, stats] of session.stats) {
      if (chainId === 'randomx') {
        randomx = stats;
      } else {
        mergeMining[chainId] = stats;
      }
    }
  }
  return { mergeMining, randomx };
}

export function getAllMergeMiningStats() {
  const allStats: Record<number, MergeMiningStats[]> = {};
  for (const [userId, session] of userSessions) {
    allStats[userId] = Array.from(session.stats.values());
  }
  return allStats;
}

export function getBtcGenesisBlock(): GenesisBlock {
  return BTC_GENESIS_BLOCK;
}

export function getRecentBlocks(chain: string, limit = 20) {
  const blocks = chainBlocks.get(chain) || [];
  return blocks.slice(-limit).reverse();
}

export function getStxLendingState(userId: number): StxLendingState {
  if (!userLendingState.has(userId)) {
    userLendingState.set(userId, {
      userId,
      stakedAmount: 0,
      tierId: null,
      startTime: null,
      accruedYield: 0,
    });
  }
  
  const state = userLendingState.get(userId)!;
  
  if (state.tierId && state.startTime) {
    const tier = STX_LENDING_TIERS[state.tierId];
    const now = Date.now();
    const elapsedYears = (now - state.startTime) / (1000 * 60 * 60 * 24 * 365);
    state.accruedYield = state.stakedAmount * (tier.aprPercent / 100) * elapsedYears;
  }
  
  return state;
}

export async function stakeStxLending(userId: number, amount: number, tierId: StxLendingTierId) {
  const tier = STX_LENDING_TIERS[tierId];
  if (amount < tier.minStake) {
    throw new Error(`Minimum stake for ${tier.name} tier is ${tier.minStake} STX`);
  }

  const userWallets = await storage.getWalletsByUser(userId);
  if (userWallets.length === 0) throw new Error("No wallet found");
  
  const wallet = userWallets[0];
  const currentBalance = parseFloat(wallet.balanceStx);
  
  if (currentBalance < amount) {
    throw new Error("Insufficient STX balance");
  }

  await storage.updateWalletBalance(wallet.id, "STX", (currentBalance - amount).toString());

  const state = getStxLendingState(userId);
  
  if (state.tierId && state.startTime) {
  }

  state.stakedAmount += amount;
  state.tierId = tierId;
  state.startTime = Date.now();

  return { success: true, state };
}
