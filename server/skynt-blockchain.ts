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

// ==================== Types ====================

export interface SkyntBlock {
  index: number;
  hash: string;
  previousHash: string;
  timestamp: number;
  transactions: SkyntTransaction[];
  miner: string;
  phiScore: number;
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
}

export interface SkyntMintResult {
  success: boolean;
  txHash: string;
  blockIndex: number;
  tokenId: string;
  phiProof: number;
  gasUsed: number;
  chain: "skynt";
  explorerUrl: string;
}

// ==================== Constants ====================

const MINING_REWARD = 50.0;
const BLOCK_DIFFICULTY = 2;
const MAX_SUPPLY = 21_000_000;
const TRANSACTION_FEE = 0.0; // Gasless
const POW_ALGORITHM = "phi-spectral";

// ==================== In-memory state ====================

const chain: SkyntBlock[] = [];
const pendingTransactions: SkyntTransaction[] = [];
const balances = new Map<string, number>();
const txIndex = new Map<string, SkyntTransaction>();

// ==================== Core helpers ====================

function calculateBlockHash(block: Omit<SkyntBlock, "hash">): string {
  const data = JSON.stringify({
    index: block.index,
    previousHash: block.previousHash,
    timestamp: block.timestamp,
    miner: block.miner,
    nonce: block.nonce,
    phiScore: block.phiScore,
    txCount: block.transactions.length,
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
    miner: "GENESIS",
    phiScore: 1.0,
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
  phiScore: number
): SkyntBlock {
  const latest = chain[chain.length - 1];

  // Φ-boosted coinbase reward; phiScore is clamped to [0,1] for stable exp
  const clampedPhi = Math.max(0, Math.min(1, phiScore));
  const phiBoost = Math.exp(clampedPhi);
  const reward = MINING_REWARD * Math.min(phiBoost, 2.0);

  const coinbase: SkyntTransaction = {
    txHash: generateTxHash(),
    fromAddress: null,
    toAddress: miner,
    amount: reward,
    type: "coinbase",
    timestamp: Date.now(),
    signature: "PHI_BOOSTED_COINBASE",
    fee: 0,
  };

  const allTransactions = [coinbase, ...transactions];

  let nonce = 0;
  let candidate: Omit<SkyntBlock, "hash"> = {
    index: latest.index + 1,
    previousHash: latest.hash,
    timestamp: Date.now(),
    transactions: allTransactions,
    miner,
    phiScore,
    difficulty: BLOCK_DIFFICULTY,
    nonce,
    powAlgorithm: POW_ALGORITHM,
  };

  // Proof of Work with reduced difficulty for gasless speed
  const prefix = "0".repeat(BLOCK_DIFFICULTY);
  let hash = calculateBlockHash(candidate);
  while (!hash.startsWith(prefix)) {
    nonce++;
    candidate = { ...candidate, nonce };
    hash = calculateBlockHash(candidate);
  }

  return { ...candidate, hash };
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

  return {
    chainLength: chain.length,
    latestBlockHash: latest.hash,
    latestBlockHeight: latest.index,
    totalTransactions: totalTx,
    totalSupply: totalMined,
    maxSupply: MAX_SUPPLY,
    difficulty: BLOCK_DIFFICULTY,
    pendingTransactions: pendingTransactions.length,
    networkPhiScore: latest.phiScore,
    isValid: isChainValid(),
    powAlgorithm: POW_ALGORITHM,
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
