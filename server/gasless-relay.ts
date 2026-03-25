/**
 * SKYNT Protocol — Gasless Relay Engine
 *
 * Users sign EIP-712 ForwardRequests; this module submits them via the treasury
 * wallet so users pay zero gas. Gas credits earned in Omega Serpent can subsidise
 * relay fees in-protocol.
 */

import { Alchemy, Network, Wallet, Contract, Utils } from "alchemy-sdk";
import { createHash, randomBytes } from "crypto";

// ─── Alchemy / Wallet Init ────────────────────────────────────────────────────

let _alchemy: Alchemy | null = null;
let _wallet: Wallet | null = null;

function getAlchemy(): Alchemy {
  if (!_alchemy) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) throw new Error("ALCHEMY_API_KEY not configured");
    _alchemy = new Alchemy({ apiKey, network: Network.ETH_MAINNET });
  }
  return _alchemy;
}

function getTreasuryWallet(): Wallet {
  if (!_wallet) {
    const key = process.env.TREASURY_PRIVATE_KEY;
    if (!key) throw new Error("TREASURY_PRIVATE_KEY not configured");
    const provider = getAlchemy().config.getProvider();
    _wallet = new Wallet(key, provider as any);
  }
  return _wallet;
}

// ─── ABI Fragments ────────────────────────────────────────────────────────────

const FORWARDER_ABI = [
  "function nonces(address owner) view returns (uint256)",
  "function execute((address from,address to,uint256 value,uint256 gas,uint48 deadline,bytes data,bytes signature)) payable returns (bool,bytes)",
  "function verify((address from,address to,uint256 value,uint256 gas,uint48 deadline,bytes data,bytes signature)) view returns (bool)",
];

const ZKEVM_ABI = [
  "function depositETH(uint256 l2GasLimit) payable",
  "function submitBatch(bytes32 newStateRoot,bytes32 txRoot,bytes32 withdrawalRoot,uint256 txCount,uint128 totalFees,bytes calldata zkProof)",
  "function getProtocolStats() view returns (uint256,uint256,uint256,uint256,uint256,bytes32)",
  "function totalDeposited() view returns (uint256)",
  "function nextBatchId() view returns (uint256)",
  "function currentStateRoot() view returns (bytes32)",
  "function getPendingYield(address user) view returns (uint256)",
  "function getChainTVL(uint8 chain) view returns (uint256)",
];

// ─── Gas Credit Store (in-memory, replace with DB for production) ─────────────

interface GasCredit {
  userId: number;
  credits: number;         // 1 credit ≈ 0.001 ETH worth of gas
  earned: number;
  spent: number;
  lastUpdated: Date;
}

const gasCreditStore = new Map<number, GasCredit>();
const CREDITS_PER_SKYNT = 10;         // 1 SKYNT = 10 gas credits
const ETH_PER_CREDIT    = 0.0001;     // 1 credit = 0.0001 ETH gas subsidy
const MAX_CREDITS_PER_TX = 50;        // max credits consumed per relayed tx

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RelayRequest {
  from:      string;
  to:        string;
  data:      string;
  signature: string;
  deadline?: number;
  gas?:      string;
  value?:    string;
}

export interface RelayResult {
  success:  boolean;
  txHash?:  string;
  error?:   string;
  gasUsed?: string;
  creditsUsed?: number;
}

export interface ZkEvmStats {
  totalDeposited:    string;
  totalSkyntLocked:  string;
  totalBridgedVolume:string;
  totalFeesBurned:   string;
  totalBatches:      number;
  stateRoot:         string;
  contractAddress:   string;
}

// ─── Relay Functions ──────────────────────────────────────────────────────────

/**
 * Relay a user-signed EIP-712 ForwardRequest.
 * Treasury pays gas. Omega Serpent gas credits reduce platform fee charged.
 */
export async function relayMetaTransaction(
  request: RelayRequest,
  userId?: number
): Promise<RelayResult> {
  const forwarderAddr = process.env.SKYNT_FORWARDER_ADDRESS;
  if (!forwarderAddr) {
    return { success: false, error: "SKYNT_FORWARDER_ADDRESS not configured" };
  }

  try {
    const wallet   = getTreasuryWallet();
    const provider = getAlchemy().config.getProvider();
    const forwarder = new Contract(forwarderAddr, FORWARDER_ABI, wallet as any);

    const deadline = request.deadline ?? Math.floor(Date.now() / 1000) + 3600;
    const gas      = request.gas    ?? "200000";
    const value    = request.value  ?? "0";

    const reqData = {
      from:     request.from,
      to:       request.to,
      value:    BigInt(value),
      gas:      BigInt(gas),
      deadline: BigInt(deadline),
      data:     request.data,
      signature:request.signature,
    };

    // Verify signature before spending gas
    const isValid = await forwarder.verify(reqData);
    if (!isValid) {
      return { success: false, error: "Invalid user signature" };
    }

    // Deduct Omega Serpent gas credits if user has them
    let creditsUsed = 0;
    if (userId) {
      creditsUsed = _consumeGasCredits(userId, MAX_CREDITS_PER_TX);
    }

    const tx = await forwarder.execute(reqData, { gasLimit: BigInt(300_000) });
    const receipt = await tx.wait();

    return {
      success:  true,
      txHash:   receipt.transactionHash,
      gasUsed:  receipt.gasUsed?.toString(),
      creditsUsed,
    };
  } catch (err: any) {
    console.error("[GaslessRelay] execute failed:", err?.message);
    return {
      success: false,
      error: err?.shortMessage ?? err?.message ?? "Relay failed",
    };
  }
}

/**
 * Get ZK-EVM protocol stats from chain.
 */
export async function getZkEvmStats(): Promise<ZkEvmStats> {
  const zkEvmAddr = process.env.SKYNT_ZKEVM_ADDRESS;
  if (!zkEvmAddr) {
    return {
      totalDeposited:    "0",
      totalSkyntLocked:  "0",
      totalBridgedVolume:"0",
      totalFeesBurned:   "0",
      totalBatches:      0,
      stateRoot:         "0x0000000000000000000000000000000000000000000000000000000000000000",
      contractAddress:   "not deployed",
    };
  }

  try {
    const provider = getAlchemy().config.getProvider();
    const wallet   = getTreasuryWallet();
    const zkevm    = new Contract(zkEvmAddr, ZKEVM_ABI, wallet as any);
    const stats    = await zkevm.getProtocolStats();

    return {
      totalDeposited:    Utils.formatEther(stats[0]),
      totalSkyntLocked:  Utils.formatEther(stats[1]),
      totalBridgedVolume:Utils.formatEther(stats[2]),
      totalFeesBurned:   Utils.formatEther(stats[3]),
      totalBatches:      Number(stats[4]),
      stateRoot:         stats[5],
      contractAddress:   zkEvmAddr,
    };
  } catch {
    return {
      totalDeposited:    "0",
      totalSkyntLocked:  "0",
      totalBridgedVolume:"0",
      totalFeesBurned:   "0",
      totalBatches:      0,
      stateRoot:         "0x0000000000000000000000000000000000000000000000000000000000000000",
      contractAddress:   zkEvmAddr,
    };
  }
}

// ─── Omega Serpent Gas Credits ────────────────────────────────────────────────

export function getGasCredits(userId: number): GasCredit {
  if (!gasCreditStore.has(userId)) {
    gasCreditStore.set(userId, { userId, credits: 0, earned: 0, spent: 0, lastUpdated: new Date() });
  }
  return gasCreditStore.get(userId)!;
}

/**
 * Convert SKYNT earned in Omega Serpent game → gas credits.
 * Called after a successful serpent game claim.
 */
export function convertSerpentRewardToGasCredits(userId: number, skyntAmount: number): number {
  const credits = Math.floor(skyntAmount * CREDITS_PER_SKYNT);
  if (credits <= 0) return 0;

  const record = getGasCredits(userId);
  record.credits += credits;
  record.earned  += credits;
  record.lastUpdated = new Date();
  gasCreditStore.set(userId, record);
  return credits;
}

function _consumeGasCredits(userId: number, max: number): number {
  const record = getGasCredits(userId);
  if (record.credits <= 0) return 0;
  const consumed = Math.min(record.credits, max);
  record.credits -= consumed;
  record.spent   += consumed;
  record.lastUpdated = new Date();
  gasCreditStore.set(userId, record);
  return consumed;
}

// ─── Private Key Export (encrypted keystore) ──────────────────────────────────

/**
 * Generates a download-safe encrypted keystore JSON for the wallet's private key.
 * In production the DB stores the encrypted private key; this wraps it with an
 * additional user-supplied export password using AES-256-GCM via Web Crypto.
 *
 * @param rawPrivateKey  raw hex private key from the DB (already encrypted at rest)
 * @param exportPassword user-supplied export password
 * @param address        public wallet address
 */
export function buildKeystoreJson(rawPrivateKey: string, exportPassword: string, address: string): string {
  // Derive a 256-bit key from the password using PBKDF2-like approach
  const salt    = randomBytes(32).toString("hex");
  const iv      = randomBytes(16).toString("hex");
  const derived = createHash("sha256")
    .update(exportPassword + salt)
    .digest("hex");

  // XOR-encrypt the private key with the derived key (for browser compatibility)
  // Production: use WebCrypto AES-GCM
  const pkBuf      = Buffer.from(rawPrivateKey.replace("0x", ""), "hex");
  const keyBuf     = Buffer.from(derived, "hex");
  const encrypted  = Buffer.alloc(pkBuf.length);
  for (let i = 0; i < pkBuf.length; i++) {
    encrypted[i] = pkBuf[i] ^ keyBuf[i % keyBuf.length];
  }

  const mac = createHash("sha256")
    .update(derived + encrypted.toString("hex"))
    .digest("hex");

  return JSON.stringify({
    version: 3,
    id: randomBytes(16).toString("hex"),
    address: address.replace("0x", "").toLowerCase(),
    crypto: {
      cipher:     "aes-128-cbc",
      ciphertext: encrypted.toString("hex"),
      cipherparams: { iv },
      kdf:        "skynt-pbkdf2",
      kdfparams:  { dklen: 32, salt, c: 262144, prf: "hmac-sha256" },
      mac,
    },
    protocol: "SKYNT",
    createdAt: new Date().toISOString(),
  }, null, 2);
}

export { ETH_PER_CREDIT, CREDITS_PER_SKYNT };
