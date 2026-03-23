/**
 * Treasury Service — single authority for all outbound on-chain transactions.
 *
 * Rules:
 *  - Loads keys strictly from environment variables (no user/admin wallet ever enters here)
 *  - Exposes typed send() methods per supported chain
 *  - Throws structured TreasuryError on failure
 *  - All external API calls get up to 3 retries with exponential back-off
 */

import { CHAIN_REGISTRY, EVM_CHAIN_KEYS, requireChain } from "./chain-registry";

export interface TreasurySendResult {
  txHash: string;
  fee: string;
  success: true;
  explorerUrl: string | null;
  chain: string;
  status: string;
}

export class TreasuryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "TreasuryError";
  }
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val)
    throw new TreasuryError(
      "MISSING_ENV",
      `${name} is not configured — add it to secrets to enable live ${name.split("_")[0]} transactions`
    );
  return val;
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // TreasuryErrors are structured/known failures — no point retrying
      if (err instanceof TreasuryError) throw err;
      if (attempt < maxAttempts) {
        const delay = 500 * Math.pow(2, attempt - 1);
        console.warn(
          `[TreasuryService] ${label} attempt ${attempt}/${maxAttempts} failed — retrying in ${delay}ms:`,
          (err as Error)?.message?.slice(0, 120)
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new TreasuryError(
    "RETRY_EXHAUSTED",
    `${label} failed after ${maxAttempts} attempts`,
    lastErr
  );
}

// ─── Address validation ────────────────────────────────────────────────────────

export function validateAddress(chain: string, address: string): void {
  if (EVM_CHAIN_KEYS.has(chain)) {
    // All EVM chains share the same address format: 0x + 40 hex chars
    if (!/^0x[a-fA-F0-9]{40}$/.test(address))
      throw new TreasuryError(
        "INVALID_ADDRESS",
        "EVM address must be a 0x-prefixed 40-character hex string"
      );
    // Enforce EIP-55 checksum when mixed-case is present
    const hasUpper = /[A-F]/.test(address.slice(2));
    const hasLower = /[a-f]/.test(address.slice(2));
    if (hasUpper && hasLower) {
      const { isAddress } = require("viem");
      if (!isAddress(address, { strict: true })) {
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "EVM address has invalid EIP-55 checksum — use all-lowercase or a correctly checksummed address"
        );
      }
    }
    return;
  }
  switch (chain) {
    case "solana":
    case "sol":
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "Solana address must be a 32-44 character base58 string"
        );
      break;
    case "stacks":
    case "stx":
      // STX mainnet addresses start with SP (mainnet) or ST (testnet).
      // SP is required for mainnet production sends.
      if (!/^SP[A-Z0-9]{38,41}$/.test(address))
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "STX address must start with SP followed by 38-41 alphanumeric characters (mainnet)"
        );
      break;
    case "dogecoin":
    case "doge":
      if (!/^D[a-zA-Z0-9]{24,33}$/.test(address))
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "DOGE address must start with D and be 25-34 characters"
        );
      break;
    case "monero":
    case "xmr": {
      // XMR standard address: 95 chars starting with '4'
      // Subaddress: 95 chars starting with '8'
      // Integrated: 106 chars starting with '4'
      const len = address.length;
      if (len !== 95 && len !== 106)
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "XMR address must be exactly 95 characters (standard/subaddress) or 106 characters (integrated)"
        );
      if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(address))
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "XMR address must contain only base58 characters"
        );
      if (address[0] !== "4" && address[0] !== "8")
        throw new TreasuryError(
          "INVALID_ADDRESS",
          "XMR mainnet address must start with '4' (standard) or '8' (subaddress)"
        );
      break;
    }
    default:
      break;
  }
}

// ─── EVM multi-chain — 136 Alchemy-supported networks ────────────────────────
//   Chain configs live in chain-registry.ts.  sendEvm() resolves config from
//   the registry so no per-chain boilerplate is needed here.

type StacksBroadcastResponse =
  | { txid: string; tx_id?: string; error?: never }
  | { error: string; reason?: string; txid?: never; tx_id?: never };

async function sendEvm(
  chain: string,
  toAddress: string,
  amount: string,
  speedMultiplier = 1.0
): Promise<TreasurySendResult> {
  const chainConfig = requireChain(chain);   // throws for unknown chains
  validateAddress(chain, toAddress);

  const privateKey = requireEnv("TREASURY_PRIVATE_KEY");
  const apiKey = requireEnv("ALCHEMY_API_KEY");

  const { Alchemy, Wallet, Utils } = await import("alchemy-sdk");
  const rpcUrl = `https://${chainConfig.alchemySlug}.g.alchemy.com/v2/${apiKey}`;

  return withRetry(`sendEvm(${chain})`, async () => {
    // Use the Alchemy provider (ethers.js) — it supports estimateGas natively,
    // so we don't need per-chain viem chain configs for 136 networks.
    const alchemy = new Alchemy({ apiKey, network: chainConfig.alchemySlug as any, url: rpcUrl });
    const provider = await alchemy.config.getProvider();
    const wallet = new Wallet(privateKey, provider);

    const weiAmount = Utils.parseEther(amount);
    const feeData = await provider.getFeeData();
    const mult = Math.round(speedMultiplier * 100);

    const gasEstimate = await provider.estimateGas({
      from: wallet.address,
      to: toAddress,
      value: weiAmount,
    });
    // Add 20% buffer so the tx doesn't hit the gas limit on busy blocks
    const gasLimit = gasEstimate.mul(120).div(100);

    // EIP-1559 (type 2) for post-London chains; legacy gasPrice fallback for
    // chains that haven't yet adopted EIP-1559.
    const hasEip1559 = feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null;
    const feeParams = hasEip1559
      ? {
          maxFeePerGas: feeData.maxFeePerGas!.mul(mult).div(100),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!.mul(mult).div(100),
          type: 2,
        }
      : { gasPrice: feeData.gasPrice!.mul(mult).div(100) };

    const worstCaseFeePerGas = hasEip1559
      ? feeData.maxFeePerGas!.mul(mult).div(100)
      : feeData.gasPrice!.mul(mult).div(100);

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: weiAmount,
      gasLimit,
      ...feeParams,
    });

    const txHash: string = tx.hash;
    const feeBn = worstCaseFeePerGas.mul(gasLimit);
    const fee = Utils.formatEther(feeBn);

    console.log(`[TreasuryService] ${chainConfig.name} ${amount} → ${toAddress} | tx: ${txHash} | fee: ${fee}`);
    return {
      txHash,
      fee,
      success: true,
      explorerUrl: `${chainConfig.explorerUrl}${txHash}`,
      chain,
      status: "broadcast",
    };
  });
}

// ─── Solana ───────────────────────────────────────────────────────────────────

async function sendSolana(
  toAddress: string,
  amount: string
): Promise<TreasurySendResult> {
  validateAddress("solana", toAddress);
  const keyB58 = requireEnv("SOLANA_TREASURY_KEY");

  const {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction,
  } = await import("@solana/web3.js");
  const { base58 } = await import("@scure/base");

  return withRetry("sendSolana", async () => {
    const secretKey = base58.decode(keyB58);
    if (secretKey.length !== 64)
      throw new TreasuryError(
        "INVALID_KEY",
        `SOLANA_TREASURY_KEY invalid length (${secretKey.length}, expected 64 bytes base58)`
      );

    const keypair = Keypair.fromSecretKey(secretKey);
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    const lamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamports < 5000)
      throw new TreasuryError("AMOUNT_TOO_SMALL", "Amount below Solana minimum (0.000005 SOL)");

    // Preflight: check treasury SOL balance before broadcasting to avoid
    // "no record of a prior credit" simulation failures on unfunded wallets.
    const FEE_LAMPORTS = 5000;
    const senderBalance = await connection.getBalance(keypair.publicKey);
    if (senderBalance < lamports + FEE_LAMPORTS) {
      throw new TreasuryError(
        "INSUFFICIENT_FUNDS",
        `Treasury SOL balance too low: have ${(senderBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL, ` +
        `need ${((lamports + FEE_LAMPORTS) / LAMPORTS_PER_SOL).toFixed(6)} SOL (amount + fee)`
      );
    }

    const recipient = new PublicKey(toAddress);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: recipient, lamports })
    );

    const txHash = await sendAndConfirmTransaction(connection, tx, [keypair]);
    const fee = (FEE_LAMPORTS / LAMPORTS_PER_SOL).toFixed(9);

    console.log(`[TreasuryService] SOL ${amount} → ${toAddress} | tx: ${txHash}`);
    return {
      txHash,
      fee,
      success: true,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
      chain: "solana",
      status: "confirmed",
    };
  });
}

// ─── Dogecoin ─────────────────────────────────────────────────────────────────

const BLOCKCYPHER_BASE = "https://api.blockcypher.com/v1/doge/main";
const DOGE_SATOSHI = 1e8;

async function sendDogecoin(
  toAddress: string,
  amount: string
): Promise<TreasurySendResult> {
  validateAddress("dogecoin", toAddress);
  const wif = requireEnv("DOGE_TREASURY_WIF");
  const treasuryAddress = requireEnv("DOGE_TREASURY_ADDRESS");

  const { secp256k1 } = await import("@noble/curves/secp256k1");
  const { base58check } = await import("@scure/base");
  const { sha256 } = await import("@noble/hashes/sha256");

  return withRetry("sendDogecoin", async () => {
    const decoded = base58check(sha256).decode(wif);
    const rawKey = decoded.slice(1);
    const privKey = rawKey.length === 33 && rawKey[32] === 0x01 ? rawKey.slice(0, 32) : rawKey.slice(0, 32);
    const pubKeyHex = Buffer.from(secp256k1.getPublicKey(privKey, true)).toString("hex");
    const satoshis = Math.round(parseFloat(amount) * DOGE_SATOSHI);
    if (satoshis < 100000)
      throw new TreasuryError("AMOUNT_TOO_SMALL", "Amount below Dogecoin dust threshold (0.001 DOGE min)");

    const newTxRes = await fetch(`${BLOCKCYPHER_BASE}/txs/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: [{ addresses: [treasuryAddress] }],
        outputs: [{ addresses: [toAddress], value: satoshis }],
      }),
    });
    if (!newTxRes.ok)
      throw new TreasuryError("API_ERROR", `BlockCypher DOGE tx create failed (${newTxRes.status}): ${await newTxRes.text()}`);

    interface BlockCypherTemplate {
      tx: object;
      tosign: string[];
      errors?: { error: string }[];
    }
    const tmpl = (await newTxRes.json()) as BlockCypherTemplate;
    if (tmpl.errors?.length)
      throw new TreasuryError("API_ERROR", `DOGE tx error: ${tmpl.errors.map((e) => e.error).join(", ")}`);

    const signatures = (tmpl.tosign || []).map((h: string) =>
      secp256k1.sign(Buffer.from(h, "hex"), privKey, { lowS: true }).toDERHex()
    );

    const sendRes = await fetch(`${BLOCKCYPHER_BASE}/txs/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx: tmpl.tx,
        tosign: tmpl.tosign,
        signatures,
        pubkeys: tmpl.tosign.map(() => pubKeyHex),
      }),
    });
    if (!sendRes.ok)
      throw new TreasuryError("API_ERROR", `BlockCypher DOGE broadcast failed (${sendRes.status}): ${await sendRes.text()}`);

    interface BlockCypherSendResult {
      tx: { hash: string; fees: number };
    }
    const result = (await sendRes.json()) as BlockCypherSendResult;
    const txHash = result.tx?.hash;
    if (!txHash) throw new TreasuryError("NO_TX_HASH", "DOGE broadcast returned no tx hash");

    const fee = ((result.tx?.fees ?? 100000) / DOGE_SATOSHI).toFixed(8);
    console.log(`[TreasuryService] DOGE ${amount} → ${toAddress} | tx: ${txHash} | fee: ${fee}`);
    return {
      txHash,
      fee,
      success: true,
      explorerUrl: `https://dogechain.info/tx/${txHash}`,
      chain: "dogecoin",
      status: "broadcast",
    };
  });
}

// ─── Stacks (STX) ─────────────────────────────────────────────────────────────

const STX_MICRO = 1e6;

async function sendStacks(
  toAddress: string,
  amount: string
): Promise<TreasurySendResult> {
  validateAddress("stacks", toAddress);
  const privateKey = requireEnv("STACKS_TREASURY_KEY");

  return withRetry("sendStacks", async () => {
    const microSTX = BigInt(Math.round(parseFloat(amount) * STX_MICRO));
    if (microSTX < 1n)
      throw new TreasuryError("AMOUNT_TOO_SMALL", "Amount too small for Stacks transfer");

    const { makeSTXTokenTransfer, broadcastTransaction } = await import("@stacks/transactions");
    const { STACKS_MAINNET } = await import("@stacks/network");

    const tx = await makeSTXTokenTransfer({
      recipient: toAddress,
      amount: microSTX,
      senderKey: privateKey,
      network: STACKS_MAINNET,
      memo: "SKYNT treasury transfer",
      fee: BigInt(2000),
    });

    const response = (await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET })) as StacksBroadcastResponse;

    if ("error" in response && response.error)
      throw new TreasuryError(
        "BROADCAST_ERROR",
        `Stacks broadcast error: ${response.error} — ${response.reason ?? ""}`
      );

    const txHash = "txid" in response ? (response.txid ?? response.tx_id ?? "unknown") : "unknown";
    const STX_FEE_MICRO = 2000n;
    const fee = (Number(STX_FEE_MICRO) / STX_MICRO).toFixed(6);

    console.log(`[TreasuryService] STX ${amount} → ${toAddress} | tx: ${txHash}`);
    return {
      txHash,
      fee,
      success: true,
      explorerUrl: `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`,
      chain: "stacks",
      status: "broadcast",
    };
  });
}

// ─── Monero (XMR) ─────────────────────────────────────────────────────────────

const XMR_PICONERO = 1e12;

interface XmrRpcResult {
  result?: { tx_hash: string; fee: number };
  error?: { message: string; code: number };
}

async function sendMonero(
  toAddress: string,
  amount: string
): Promise<TreasurySendResult> {
  validateAddress("monero", toAddress);
  const walletRpc = requireEnv("XMR_WALLET_RPC_URL");

  return withRetry("sendMonero", async () => {
    const piconero = Math.round(parseFloat(amount) * XMR_PICONERO);
    if (piconero < 1e9)
      throw new TreasuryError("AMOUNT_TOO_SMALL", "Amount below Monero minimum (0.001 XMR)");

    const headers: HeadersInit = { "Content-Type": "application/json" };
    const user = process.env.XMR_WALLET_RPC_USER;
    const pass = process.env.XMR_WALLET_RPC_PASS;
    if (user && pass) {
      headers["Authorization"] = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
    }

    const body = {
      jsonrpc: "2.0",
      id: "0",
      method: "transfer",
      params: {
        destinations: [{ amount: piconero, address: toAddress }],
        account_index: 0,
        subaddr_indices: [],
        priority: 1,
        ring_size: 16,
        get_tx_hex: false,
      },
    };

    const res = await fetch(`${walletRpc}/json_rpc`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new TreasuryError(
        "API_ERROR",
        `Monero wallet RPC HTTP error: ${res.status} ${res.statusText}`
      );

    const data = (await res.json()) as XmrRpcResult;
    if (data.error)
      throw new TreasuryError(
        "RPC_ERROR",
        `Monero wallet RPC error (${data.error.code}): ${data.error.message}`
      );

    const txHash = data.result?.tx_hash;
    if (!txHash) throw new TreasuryError("NO_TX_HASH", "Monero RPC returned no tx_hash");

    const fee = data.result?.fee
      ? (data.result.fee / XMR_PICONERO).toFixed(12)
      : "0";

    console.log(`[TreasuryService] XMR ${amount} → ${toAddress} | tx: ${txHash} | fee: ${fee}`);
    return {
      txHash,
      fee,
      success: true,
      explorerUrl: `https://xmrchain.net/tx/${txHash}`,
      chain: "monero",
      status: "broadcast",
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send funds on-chain using the treasury's own keys.
 * No user wallet address or admin wallet is ever involved.
 */
export async function treasurySend(
  chain: string,
  toAddress: string,
  amount: string,
  speedMultiplier = 1.0
): Promise<TreasurySendResult> {
  if (EVM_CHAIN_KEYS.has(chain)) {
    return sendEvm(chain, toAddress, amount, speedMultiplier);
  }
  switch (chain) {
    case "solana":
    case "sol":
      return sendSolana(toAddress, amount);
    case "dogecoin":
    case "doge":
      return sendDogecoin(toAddress, amount);
    case "stacks":
    case "stx":
      return sendStacks(toAddress, amount);
    case "monero":
    case "xmr":
      return sendMonero(toAddress, amount);
    case "skynt":
      throw new TreasuryError(
        "NOT_SUPPORTED",
        "SKYNT is an internal platform token — no external chain transmit needed"
      );
    default:
      throw new TreasuryError(
        "UNSUPPORTED_CHAIN",
        `Unsupported chain for treasury send: ${chain}`
      );
  }
}

/**
 * Validate a recipient address for a given chain without attempting a send.
 * Returns true if valid, throws TreasuryError if invalid.
 */
export function validateRecipientAddress(chain: string, address: string): true {
  validateAddress(chain, address);
  return true;
}
