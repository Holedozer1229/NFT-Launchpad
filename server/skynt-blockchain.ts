/**
 * SphinxSkynet Blockchain Service
 *
 * TypeScript integration layer for the SphinxOS SKYNT blockchain.
 * Implements gasless NFT minting, Φ-boosted block consensus, and
 * on-chain transaction tracking — mirroring the Python StandaloneSphinxBlockchain
 * and SphinxSkynetBlockchain from https://github.com/Holedozer1229/Sphinx_OS
 */

import { createHash, randomBytes } from "crypto";
import { calculatePhi } from "./iit-engine";
import { qgMiner } from "./qg-miner-v8";

// ==================== Types ====================

export interface SkyntBlock {
  index: number;
  hash: string;
  previousHash: string;
  timestamp: number;
  transactions: SkyntTransaction[];
  merkleRoot: string;
  version: number;
  miner: string;
  phiScore: number;
  qgScore: number;
  holoScore: number;
  fanoScore: number;
  gatesPassed: string[];
  difficulty: number;
  nonce: number;
  powAlgorithm: string;
}

export interface SkyntTransaction {
  txHash: string;
  fromAddress: string | null;
  toAddress: string;
  amount: number;
  type: "transfer" | "nft_mint" | "coinbase";
  nftMetadata?: SkyntNftMetadata;
  timestamp: number;
  signature: string;
  fee: number;
}

export interface SkyntNftMetadata {
  title: string;
  rarity: string;
  launchId?: number;
  owner: string;
  mintDate: string;
  tokenId: string;
  phiProof: number;
}

export interface SkyntChainInfo {
  chainLength: number;
  latestBlockHash: string;
  latestBlockHeight: number;
  totalTransactions: number;
  totalSupply: number;
  maxSupply: number;
  difficulty: number;
  pendingTransactions: number;
  networkPhiScore: number;
  isValid: boolean;
  powAlgorithm: string;
  version: number;
  halvingEpoch: number;
  nextHalving: number;
  currentReward: number;
  difficultyAdjustmentBlock: number;
}

export interface SkyntMintResult {
  success: boolean;
  txHash: string;
  blockIndex: number;
  tokenId: string;
  phiProof: number;
  phiTotal: number;
  qgScore: number;
  holoScore: number;
  fanoScore: number;
  gatesPassed: string[];
  gasUsed: number;
  chain: "skynt";
  explorerUrl: string;
}

// ==================== Constants ====================

const INITIAL_MINING_REWARD = 50.0;
const SKYNT_HALVING_INTERVAL = 210_000;
const BLOCK_DIFFICULTY = 2; // Starting difficulty
const MAX_SUPPLY = 21_000_000;
const TRANSACTION_FEE = 0.0; // Gasless
const POW_ALGORITHM = "qg-v8-three-gate";
const BLOCK_TIME_TARGET_MS = 30_000; // 30s for simulation
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10; // Every 10 blocks for simulation
const BLOCK_VERSION = 4;

// ==================== In-memory state ====================

const chain: SkyntBlock[] = [];
const pendingTransactions: SkyntTransaction[] = [];
const balances = new Map<string, number>();
const txIndex = new Map<string, SkyntTransaction>();

// ==================== Core helpers ====================

function computeMerkleRoot(transactions: SkyntTransaction[]): string {
  if (transactions.length === 0) return createHash("sha256").update("").digest("hex");
  
  let hashes = transactions.map(tx => tx.txHash);
  
  while (hashes.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        nextLevel.push(createHash("sha256").update(hashes[i] + hashes[i + 1]).digest("hex"));
      } else {
        nextLevel.push(createHash("sha256").update(hashes[i] + hashes[i]).digest("hex"));
      }
    }
    hashes = nextLevel;
  }
  
  return hashes[0];
}

function getBlockReward(height: number): number {
  const halvings = Math.floor(height / SKYNT_HALVING_INTERVAL);
  if (halvings >= 64) return 0;
  
  const reward = INITIAL_MINING_REWARD / Math.pow(2, halvings);
  return Math.max(reward, 0.00000001);
}

function adjustDifficulty(): number {
  const latest = chain[chain.length - 1];
  if (latest.index === 0 || latest.index % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0) {
    return latest.difficulty;
  }
  
  const lastAdjustmentBlock = chain[chain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const timeExpected = BLOCK_TIME_TARGET_MS * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken = latest.timestamp - lastAdjustmentBlock.timestamp;
  
  let newDifficulty = latest.difficulty;
  if (timeTaken < timeExpected / 2) {
    newDifficulty++;
  } else if (timeTaken > timeExpected * 2) {
    newDifficulty = Math.max(1, newDifficulty - 1);
  }
  
  return newDifficulty;
}

function calculateBlockHash(block: Omit<SkyntBlock, "hash">): string {
  const data = JSON.stringify({
    index: block.index,
    previousHash: block.previousHash,
    timestamp: block.timestamp,
    merkleRoot: block.merkleRoot,
    miner: block.miner,
    nonce: block.nonce,
    phiTotal: block.phiScore,
    qgScore: block.qgScore,
  });
  return createHash("sha256").update(data).digest("hex");
}

function generateTxHash(): string {
  return "0x" + randomBytes(32).toString("hex");
}

function generateTokenId(): string {
  return "SKYNT-" + randomBytes(8).toString("hex").toUpperCase();
}

function computePhiForBlock(miner: string, blockIndex: number): number {
  const seed = `${miner}-block-${blockIndex}-${Date.now()}`;
  const phiMetrics = calculatePhi(seed);
  return phiMetrics.phi;
}

// ==================== Genesis block ====================

function createGenesisBlock(): SkyntBlock {
  const coinbase: SkyntTransaction = {
    txHash: "0x" + createHash("sha256").update("GENESIS").digest("hex"),
    fromAddress: null,
    toAddress: "GENESIS",
    amount: 0,
    type: "coinbase",
    timestamp: 0,
    signature: "GENESIS_SIGNATURE",
    fee: 0,
  };

  const genesis: Omit<SkyntBlock, "hash"> = {
    index: 0,
    previousHash: "0".repeat(64),
    timestamp: 0,
    transactions: [coinbase],
    merkleRoot: computeMerkleRoot([coinbase]),
    version: BLOCK_VERSION,
    miner: "GENESIS",
    phiScore: 1.0,
    qgScore: 1.0,
    holoScore: 1.0,
    fanoScore: 1.0,
    gatesPassed: ["spectral", "consciousness", "qg_curvature"],
    difficulty: BLOCK_DIFFICULTY,
    nonce: 0,
    powAlgorithm: POW_ALGORITHM,
  };

  return { ...genesis, hash: calculateBlockHash(genesis) };
}

// Initialize chain with genesis block
chain.push(createGenesisBlock());

// ==================== Mining ====================

function mineBlock(
  miner: string,
  transactions: SkyntTransaction[],
  phiScore: number // Use for legacy phiScore compatibility if needed
): SkyntBlock {
  const latest = chain[chain.length - 1];
  const height = latest.index + 1;
  const currentDifficulty = adjustDifficulty();

  // BTC-style halving reward
  const baseReward = getBlockReward(height);
  
  // Φ-boosted reward; clamped phi from qgMiner result if available
  // Here we'll start mining and get the real v8 metrics
  const merkleRoot = computeMerkleRoot(transactions);
  const blockData = JSON.stringify({
    index: height,
    previousHash: latest.hash,
    timestamp: Date.now(),
    merkleRoot,
    miner,
  });

  const mineResult = qgMiner.mine(blockData, currentDifficulty);
  
  const clampedPhi = Math.max(0, Math.min(1, mineResult.phiTotal));
  const phiBoost = Math.exp(clampedPhi);
  const reward = baseReward * Math.min(phiBoost, 2.0);

  const coinbase: SkyntTransaction = {
    txHash: generateTxHash(),
    fromAddress: null,
    toAddress: miner,
    amount: reward,
    type: "coinbase",
    timestamp: Date.now(),
    signature: "PHI_BOOSTED_V8_COINBASE",
    fee: 0,
  };

  const allTransactions = [coinbase, ...transactions];
  const finalMerkleRoot = computeMerkleRoot(allTransactions);

  return {
    index: height,
    hash: mineResult.blockHash || calculateBlockHash({
      index: height,
      previousHash: latest.hash,
      timestamp: Date.now(),
      transactions: allTransactions,
      merkleRoot: finalMerkleRoot,
      version: BLOCK_VERSION,
      miner,
      phiScore: mineResult.phiTotal,
      qgScore: mineResult.qgScore,
      holoScore: mineResult.holoScore,
      fanoScore: mineResult.fanoScore,
      gatesPassed: mineResult.gatesPassed,
      difficulty: currentDifficulty,
      nonce: mineResult.nonce || 0,
      powAlgorithm: POW_ALGORITHM,
    }),
    previousHash: latest.hash,
    timestamp: Date.now(),
    transactions: allTransactions,
    merkleRoot: finalMerkleRoot,
    version: BLOCK_VERSION,
    miner,
    phiScore: mineResult.phiTotal,
    qgScore: mineResult.qgScore,
    holoScore: mineResult.holoScore,
    fanoScore: mineResult.fanoScore,
    gatesPassed: mineResult.gatesPassed,
    difficulty: currentDifficulty,
    nonce: mineResult.nonce || 0,
    powAlgorithm: POW_ALGORITHM,
  };
}

function updateBalances(block: SkyntBlock): void {
  for (const tx of block.transactions) {
    if (tx.fromAddress) {
      const current = balances.get(tx.fromAddress) ?? 0;
      balances.set(tx.fromAddress, current - tx.amount - tx.fee);
    }
    const current = balances.get(tx.toAddress) ?? 0;
    balances.set(tx.toAddress, current + tx.amount);
  }
}

// ==================== Public API ====================

export function getChainInfo(): SkyntChainInfo {
  const latest = chain[chain.length - 1];
  const totalTx = chain.reduce((sum, b) => sum + b.transactions.length, 0);
  const totalMined = chain.reduce((sum, b) => {
    const coinbase = b.transactions.find(t => t.type === "coinbase");
    return sum + (coinbase?.amount ?? 0);
  }, 0);

  const halvingEpoch = Math.floor(latest.index / SKYNT_HALVING_INTERVAL);
  const nextHalving = (halvingEpoch + 1) * SKYNT_HALVING_INTERVAL;
  const currentReward = getBlockReward(latest.index);
  const difficultyAdjustmentBlock = Math.floor(latest.index / DIFFICULTY_ADJUSTMENT_INTERVAL + 1) * DIFFICULTY_ADJUSTMENT_INTERVAL;

  return {
    chainLength: chain.length,
    latestBlockHash: latest.hash,
    latestBlockHeight: latest.index,
    totalTransactions: totalTx,
    totalSupply: totalMined,
    maxSupply: MAX_SUPPLY,
    difficulty: latest.difficulty,
    pendingTransactions: pendingTransactions.length,
    networkPhiScore: latest.phiScore,
    isValid: isChainValid(),
    powAlgorithm: POW_ALGORITHM,
    version: latest.version,
    halvingEpoch,
    nextHalving,
    currentReward,
    difficultyAdjustmentBlock,
  };
}

export function getBalance(address: string): number {
  return balances.get(address) ?? 0;
}

export function getTransaction(txHash: string): SkyntTransaction | null {
  return txIndex.get(txHash) ?? null;
}

export function getBlock(indexOrHash: number | string): SkyntBlock | null {
  if (typeof indexOrHash === "number") {
    return chain[indexOrHash] ?? null;
  }
  return chain.find(b => b.hash === indexOrHash) ?? null;
}

/**
 * Mint an NFT on the SphinxSkynet SKYNT chain.
 * Computes a Φ (phi) proof via IIT engine (range: 0–1, normalized von Neumann entropy),
 * creates a signed NFT transaction, and mines a new block immediately (gasless).
 */
export function mintNftOnSkynt(params: {
  owner: string;
  title: string;
  rarity: string;
  launchId?: number;
  price: string;
}): SkyntMintResult {
  const tokenId = generateTokenId();
  const phiMetrics = calculatePhi(`${params.owner}-${params.title}-${tokenId}`);
  const phiScore = phiMetrics.phi;

  const nftMetadata: SkyntNftMetadata = {
    title: params.title,
    rarity: params.rarity,
    launchId: params.launchId,
    owner: params.owner,
    mintDate: new Date().toISOString().substring(0, 10),
    tokenId,
    phiProof: phiScore,
  };

  const tx: SkyntTransaction = {
    txHash: generateTxHash(),
    fromAddress: null,
    toAddress: params.owner,
    amount: 0,
    type: "nft_mint",
    nftMetadata,
    timestamp: Date.now(),
    signature: createHash("sha256")
      .update(`${params.owner}${tokenId}${phiScore}`)
      .digest("hex"),
    fee: TRANSACTION_FEE,
  };

  // Mine block immediately (gasless instant finality for NFTs)
  const minerAddress = "SKYNT_NFT_FORGE";
  const newBlock = mineBlock(minerAddress, [tx], phiScore);
  chain.push(newBlock);
  updateBalances(newBlock);

  // Index the transaction
  for (const t of newBlock.transactions) {
    txIndex.set(t.txHash, t);
  }

  const explorerUrl = `https://explorer.sphinxskynet.io/tx/${tx.txHash}`;

  return {
    success: true,
    txHash: tx.txHash,
    blockIndex: newBlock.index,
    tokenId,
    phiProof: phiScore,
    phiTotal: newBlock.phiScore,
    qgScore: newBlock.qgScore,
    holoScore: newBlock.holoScore,
    fanoScore: newBlock.fanoScore,
    gatesPassed: newBlock.gatesPassed,
    gasUsed: 0,
    chain: "skynt",
    explorerUrl,
  };
}

export function addPendingTransaction(tx: Omit<SkyntTransaction, "txHash" | "signature" | "fee">): SkyntTransaction {
  const full: SkyntTransaction = {
    ...tx,
    txHash: generateTxHash(),
    signature: createHash("sha256")
      .update(`${tx.fromAddress}${tx.toAddress}${tx.amount}${tx.timestamp}`)
      .digest("hex"),
    fee: TRANSACTION_FEE,
  };
  pendingTransactions.push(full);
  return full;
}

export function getRecentBlocks(limit = 20): SkyntBlock[] {
  return chain.slice(-limit).reverse();
}

export function isChainValid(): boolean {
  for (let i = 1; i < chain.length; i++) {
    const curr = chain[i];
    const prev = chain[i - 1];
    if (curr.previousHash !== prev.hash) return false;
    const { hash, ...rest } = curr;
    if (hash !== calculateBlockHash(rest)) return false;
  }
  return true;
}
