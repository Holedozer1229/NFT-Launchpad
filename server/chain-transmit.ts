/**
 * Chain Transmit — low-level on-chain broadcast layer.
 *
 * Each transmit function:
 *  - Returns a typed ChainTransmitResult — never throws raw errors
 *  - Uses dynamic gas estimation (EVM: viem estimateGas; others: fee from RPC)
 *  - Retries external API calls up to 3 times with exponential back-off
 *  - Loads signing keys only from environment variables (no user context)
 *
 * The recommended entry point for higher-level code is treasurySend() in
 * treasury-service.ts which wraps this module with additional validation.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { secp256k1 } from "@noble/curves/secp256k1";
import { base58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { Alchemy, Network, Wallet, Utils } from "alchemy-sdk";

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const BLOCKCYPHER_BASE = "https://api.blockcypher.com/v1/doge/main";
const DOGE_SATOSHI = 1e8;
const XMR_PICONERO = 1e12;
const STX_MICRO = 1e6;

export interface ChainTransmitResult {
  txHash: string;
  status: string;
  explorerUrl: string | null;
  chain: string;
  networkFee?: string;
  success: boolean;
  error?: string;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} env var is not configured — add it to secrets to enable live ${name.split("_")[0]} transmits`);
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
      if (attempt < maxAttempts) {
        const delay = 500 * Math.pow(2, attempt - 1);
        console.warn(
          `[ChainTransmit] ${label} attempt ${attempt}/${maxAttempts} failed — retrying in ${delay}ms:`,
          (err as Error)?.message?.slice(0, 120)
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function errorResult(chain: string, err: unknown): ChainTransmitResult {
  const error = err instanceof Error ? err.message : "Chain transmit failed";
  return { txHash: "", status: "failed", explorerUrl: null, chain, success: false, error };
}

// ─── Ethereum ─────────────────────────────────────────────────────────────────

export async function transmitEthereum(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  try {
    const privateKey = requireEnv("TREASURY_PRIVATE_KEY");
    const apiKey = requireEnv("ALCHEMY_API_KEY");

    return await withRetry("transmitEthereum", async () => {
      const { createPublicClient, http, parseEther } = await import("viem");
      const { mainnet } = await import("viem/chains");
      const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
      const pub = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

      const alchemy = new Alchemy({ apiKey, network: Network.ETH_MAINNET });
      const provider = await alchemy.config.getProvider();
      const wallet = new Wallet(privateKey, provider);

      const weiAmount = Utils.parseEther(amount);
      const feeData = await provider.getFeeData();

      const gasEstimate = await pub.estimateGas({
        account: wallet.address as `0x${string}`,
        to: recipientAddress as `0x${string}`,
        value: parseEther(amount),
      });
      const gasLimit = (gasEstimate * 120n) / 100n;
      const gasLimitStr = gasLimit.toString();

      const hasEip1559 = feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null;
      const feeParams = hasEip1559
        ? {
            maxFeePerGas: feeData.maxFeePerGas!,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
            type: 2,
          }
        : { gasPrice: feeData.gasPrice! };
      const worstCaseFeePerGas = hasEip1559 ? feeData.maxFeePerGas! : feeData.gasPrice!;

      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: weiAmount,
        gasLimit: gasLimitStr,
        ...feeParams,
      });

      const txHash: string = tx.hash;
      const feeBn = worstCaseFeePerGas.mul(gasLimitStr);
      const networkFee = Utils.formatEther(feeBn);

      console.log(`[ChainTransmit] ETH ${amount} → ${recipientAddress} | tx: ${txHash} | fee: ${networkFee}`);
      return {
        txHash,
        status: "broadcast",
        explorerUrl: `https://etherscan.io/tx/${txHash}`,
        chain: "ethereum",
        networkFee,
        success: true,
      };
    });
  } catch (err) {
    console.error("[ChainTransmit] transmitEthereum failed:", (err as Error)?.message);
    return errorResult("ethereum", err);
  }
}

function decodeDogeWif(wif: string): Uint8Array {
  const decoded = base58check(sha256).decode(wif);
  const raw = decoded.slice(1);
  return raw.length === 33 && raw[32] === 0x01 ? raw.slice(0, 32) : raw.slice(0, 32);
}

// ─── Solana ───────────────────────────────────────────────────────────────────

export async function transmitSolana(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  try {
    const keyB58 = requireEnv("SOLANA_TREASURY_KEY");

    return await withRetry("transmitSolana", async () => {
      const { base58 } = await import("@scure/base");
      const secretKey = base58.decode(keyB58);
      if (secretKey.length !== 64) {
        throw new Error(`SOLANA_TREASURY_KEY invalid length (${secretKey.length}, expected 64 bytes base58)`);
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      const connection = new Connection(SOLANA_RPC, "confirmed");
      const lamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
      if (lamports < 5000) throw new Error("Amount below Solana minimum (0.000005 SOL)");

      const recipient = new PublicKey(recipientAddress);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: recipient, lamports })
      );

      const txHash = await sendAndConfirmTransaction(connection, tx, [keypair]);
      const FEE_LAMPORTS = 5000;
      const networkFee = (FEE_LAMPORTS / LAMPORTS_PER_SOL).toFixed(9);

      console.log(`[ChainTransmit] SOL ${amount} → ${recipientAddress} | tx: ${txHash}`);
      return { txHash, status: "confirmed", explorerUrl: `https://solscan.io/tx/${txHash}`, chain: "solana", networkFee, success: true };
    });
  } catch (err) {
    console.error("[ChainTransmit] transmitSolana failed:", (err as Error)?.message);
    return errorResult("solana", err);
  }
}

// ─── Dogecoin ─────────────────────────────────────────────────────────────────

interface BlockCypherTemplate {
  tx: object;
  tosign: string[];
  errors?: { error: string }[];
}

interface BlockCypherSendResult {
  tx: { hash: string; fees: number };
}

export async function transmitDogecoin(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  try {
    const wif = requireEnv("DOGE_TREASURY_WIF");
    const treasuryAddress = requireEnv("DOGE_TREASURY_ADDRESS");

    return await withRetry("transmitDogecoin", async () => {
      const privKey = decodeDogeWif(wif);
      const pubKeyHex = Buffer.from(secp256k1.getPublicKey(privKey, true)).toString("hex");
      const satoshis = Math.round(parseFloat(amount) * DOGE_SATOSHI);
      if (satoshis < 100000) throw new Error("Amount below Dogecoin dust threshold (0.001 DOGE min)");

      const newTxRes = await fetch(`${BLOCKCYPHER_BASE}/txs/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: [{ addresses: [treasuryAddress] }],
          outputs: [{ addresses: [recipientAddress], value: satoshis }],
        }),
      });
      if (!newTxRes.ok) throw new Error(`BlockCypher DOGE tx create failed (${newTxRes.status}): ${await newTxRes.text()}`);

      const tmpl = (await newTxRes.json()) as BlockCypherTemplate;
      if (tmpl.errors?.length) throw new Error(`DOGE tx error: ${tmpl.errors.map(e => e.error).join(", ")}`);

      const signatures = (tmpl.tosign || []).map((h: string) =>
        secp256k1.sign(Buffer.from(h, "hex"), privKey, { lowS: true }).toDERHex()
      );

      const sendRes = await fetch(`${BLOCKCYPHER_BASE}/txs/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx: tmpl.tx, tosign: tmpl.tosign, signatures,
          pubkeys: tmpl.tosign.map(() => pubKeyHex),
        }),
      });
      if (!sendRes.ok) throw new Error(`BlockCypher DOGE broadcast failed (${sendRes.status}): ${await sendRes.text()}`);

      const result = (await sendRes.json()) as BlockCypherSendResult;
      const txHash = result.tx?.hash;
      if (!txHash) throw new Error("DOGE broadcast returned no tx hash");

      const networkFee = ((result.tx?.fees ?? 100000) / DOGE_SATOSHI).toFixed(8);
      console.log(`[ChainTransmit] DOGE ${amount} → ${recipientAddress} | tx: ${txHash}`);
      return { txHash, status: "broadcast", explorerUrl: `https://dogechain.info/tx/${txHash}`, chain: "dogecoin", networkFee, success: true };
    });
  } catch (err) {
    console.error("[ChainTransmit] transmitDogecoin failed:", (err as Error)?.message);
    return errorResult("dogecoin", err);
  }
}

// ─── Stacks (STX) ─────────────────────────────────────────────────────────────

type StacksBroadcastResponse =
  | { txid: string; tx_id?: string; error?: never }
  | { error: string; reason?: string; txid?: never; tx_id?: never };

export async function transmitStacks(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  try {
    const privateKey = requireEnv("STACKS_TREASURY_KEY");

    return await withRetry("transmitStacks", async () => {
      const microSTX = BigInt(Math.round(parseFloat(amount) * STX_MICRO));
      if (microSTX < BigInt(1)) throw new Error("Amount too small for Stacks transfer");

      const { makeSTXTokenTransfer, broadcastTransaction } = await import("@stacks/transactions");
      const { STACKS_MAINNET } = await import("@stacks/network");

      const tx = await makeSTXTokenTransfer({
        recipient: recipientAddress,
        amount: microSTX,
        senderKey: privateKey,
        network: STACKS_MAINNET,
        memo: "SKYNT cross-chain transfer",
        fee: BigInt(2000),
      });

      const response = (await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET })) as StacksBroadcastResponse;

      if ("error" in response && response.error) {
        throw new Error(`Stacks broadcast error: ${response.error} — ${response.reason ?? ""}`);
      }

      const txHash = "txid" in response ? (response.txid ?? response.tx_id ?? "unknown") : "unknown";
      const STX_FEE_MICRO = 2000n;
      const networkFee = (Number(STX_FEE_MICRO) / STX_MICRO).toFixed(6);
      return {
        txHash,
        status: "broadcast",
        explorerUrl: `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`,
        chain: "stacks",
        networkFee,
        success: true,
      };
    });
  } catch (err) {
    console.error("[ChainTransmit] transmitStacks failed:", (err as Error)?.message);
    return errorResult("stacks", err);
  }
}

// ─── Monero (XMR) ─────────────────────────────────────────────────────────────

interface XmrRpcResult {
  result?: { tx_hash: string; fee: number };
  error?: { message: string; code: number };
}

export async function transmitMonero(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  try {
    const walletRpc = requireEnv("XMR_WALLET_RPC_URL");

    return await withRetry("transmitMonero", async () => {
      const piconero = Math.round(parseFloat(amount) * XMR_PICONERO);
      if (piconero < 1e9) throw new Error("Amount below Monero minimum (0.001 XMR)");

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
          destinations: [{ amount: piconero, address: recipientAddress }],
          account_index: 0,
          subaddr_indices: [],
          priority: 1,
          ring_size: 16,
          get_tx_hex: false,
        },
      };

      const res = await fetch(`${walletRpc}/json_rpc`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Monero wallet RPC HTTP error: ${res.status} ${res.statusText}`);

      const data = (await res.json()) as XmrRpcResult;
      if (data.error) throw new Error(`Monero wallet RPC error (${data.error.code}): ${data.error.message}`);

      const txHash = data.result?.tx_hash;
      if (!txHash) throw new Error("Monero RPC returned no tx_hash");

      const networkFee = data.result?.fee
        ? (data.result.fee / XMR_PICONERO).toFixed(12)
        : "0";

      console.log(`[ChainTransmit] XMR ${amount} → ${recipientAddress} | tx: ${txHash} | fee: ${networkFee}`);
      return {
        txHash,
        status: "broadcast",
        explorerUrl: `https://xmrchain.net/tx/${txHash}`,
        chain: "monero",
        networkFee,
        success: true,
      };
    });
  } catch (err) {
    console.error("[ChainTransmit] transmitMonero failed:", (err as Error)?.message);
    return errorResult("monero", err);
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function transmitToChain(
  chain: string,
  recipientAddress: string,
  amount: string,
  _token: string
): Promise<ChainTransmitResult> {
  switch (chain) {
    case "ethereum":
    case "eth":
      return transmitEthereum(recipientAddress, amount);
    case "solana":
      return transmitSolana(recipientAddress, amount);
    case "dogecoin":
      return transmitDogecoin(recipientAddress, amount);
    case "stacks":
    case "stx":
      return transmitStacks(recipientAddress, amount);
    case "monero":
      return transmitMonero(recipientAddress, amount);
    case "skynt":
      return { txHash: "", status: "skipped", explorerUrl: null, chain, success: false, error: "SKYNT is an internal platform token — no external chain transmit needed" };
    default:
      return { txHash: "", status: "unsupported", explorerUrl: null, chain, success: false, error: `Unsupported chain for live transmit: ${chain}` };
  }
}
