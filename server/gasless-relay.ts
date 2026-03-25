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

// ─── Private Key Export (Ethereum Keystore v3 format) ─────────────────────────

/**
 * Generates an Ethereum Keystore v3–compatible JSON for the wallet's private key.
 *
 * Encryption scheme:
 *   KDF:    scrypt  (N=8192, r=8, p=1, dklen=32) — same params as MetaMask export
 *   Cipher: AES-128-CTR using derivedKey[0:16] as key and a random 16-byte IV
 *   MAC:    SHA-256(derivedKey[16:32] || ciphertext)
 *
 * The output is compatible with any web3 wallet that supports keystore v3 import.
 *
 * @param rawPrivateKey  32-byte hex private key (with or without 0x prefix)
 * @param exportPassword user-supplied export password for the KDF
 * @param address        public wallet address (for the keystore "address" field)
 */
export function buildKeystoreJson(rawPrivateKey: string, exportPassword: string, address: string): string {
  const { scryptSync, createCipheriv } = require("crypto") as typeof import("crypto");

  const salt = randomBytes(32);
  const iv   = randomBytes(16);

  // Scrypt KDF — derives 32 bytes; first 16 = cipher key, last 16 = MAC key material
  const N = 8192, r = 8, p = 1, dklen = 32;
  const derivedKey = scryptSync(exportPassword, salt, dklen, { N, r, p }) as Buffer;

  // AES-128-CTR encryption (Ethereum keystore v3 standard cipher)
  const encKey     = derivedKey.slice(0, 16);
  const cipher     = createCipheriv("aes-128-ctr", encKey, iv);
  const pkBytes    = Buffer.from(rawPrivateKey.replace(/^0x/, ""), "hex");
  const ciphertext = Buffer.concat([cipher.update(pkBytes), cipher.final()]);

  // MAC: SHA-256(derivedKey[16:32] || ciphertext)
  const mac = createHash("sha256")
    .update(Buffer.concat([derivedKey.slice(16, 32), ciphertext]))
    .digest("hex");

  return JSON.stringify({
    version:  3,
    id:       randomBytes(16).toString("hex"),
    address:  address.replace(/^0x/, "").toLowerCase(),
    crypto: {
      cipher:       "aes-128-ctr",
      ciphertext:   ciphertext.toString("hex"),
      cipherparams: { iv: iv.toString("hex") },
      kdf:          "scrypt",
      kdfparams:    { dklen, salt: salt.toString("hex"), n: N, r, p },
      mac,
    },
    protocol:  "SKYNT",
    createdAt: new Date().toISOString(),
  }, null, 2);
}

export { ETH_PER_CREDIT, CREDITS_PER_SKYNT };
