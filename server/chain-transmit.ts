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
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} env var is not configured — add it to secrets to enable live ${name.split("_")[0]} transmits`);
  return val;
}

// ─── Ethereum ─────────────────────────────────────────────────────────────────

export async function transmitEthereum(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const privateKey = requireEnv("TREASURY_PRIVATE_KEY");
  const apiKey = requireEnv("ALCHEMY_API_KEY");

  const alchemy = new Alchemy({ apiKey, network: Network.ETH_MAINNET });
  const provider = await alchemy.config.getProvider();
  const wallet = new Wallet(privateKey, provider);

  const weiAmount = Utils.parseEther(amount);
  const gasPrice = await provider.getGasPrice();
  const gasLimit = 21000;

  const tx = await wallet.sendTransaction({
    to: recipientAddress,
    value: weiAmount,
    gasLimit,
    gasPrice,
  });

  const txHash: string = tx.hash;
  const estimatedFeeBN = gasPrice.mul(gasLimit);
  const networkFee = Utils.formatEther(estimatedFeeBN);

  return {
    txHash,
    status: "broadcast",
    explorerUrl: `https://etherscan.io/tx/${txHash}`,
    chain: "ethereum",
    networkFee,
  };
}

function decodeDogeWif(wif: string): Uint8Array {
  const decoded = base58check.decode(wif);
  const raw = decoded.slice(1);
  return raw.length === 33 && raw[32] === 0x01 ? raw.slice(0, 32) : raw.slice(0, 32);
}

// ─── Solana ───────────────────────────────────────────────────────────────────

export async function transmitSolana(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const keyB58 = requireEnv("SOLANA_TREASURY_KEY");
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
  console.log(`[ChainTransmit] SOL ${amount} → ${recipientAddress} | tx: ${txHash}`);
  return { txHash, status: "confirmed", explorerUrl: `https://solscan.io/tx/${txHash}`, chain: "solana" };
}

// ─── Dogecoin ─────────────────────────────────────────────────────────────────

export async function transmitDogecoin(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const wif = requireEnv("DOGE_TREASURY_WIF");
  const privKey = decodeDogeWif(wif);
  const pubKeyHex = Buffer.from(secp256k1.getPublicKey(privKey, true)).toString("hex");
  const treasuryAddress = requireEnv("DOGE_TREASURY_ADDRESS");
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

  const tmpl = await newTxRes.json() as { tx: object; tosign: string[]; errors?: { error: string }[] };
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

  const result = await sendRes.json() as { tx: { hash: string } };
  const txHash = result.tx?.hash;
  if (!txHash) throw new Error("DOGE broadcast returned no tx hash");

  console.log(`[ChainTransmit] DOGE ${amount} → ${recipientAddress} | tx: ${txHash}`);
  return { txHash, status: "broadcast", explorerUrl: `https://dogechain.info/tx/${txHash}`, chain: "dogecoin" };
}

// ─── Stacks (STX) ─────────────────────────────────────────────────────────────

export async function transmitStacks(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const privateKey = requireEnv("STACKS_TREASURY_KEY");
  const microSTX = BigInt(Math.round(parseFloat(amount) * STX_MICRO));
  if (microSTX < BigInt(1)) throw new Error("Amount too small for Stacks transfer");

  const { makeSTXTokenTransfer, broadcastTransaction, AnchorMode } = await import("@stacks/transactions");
  const { STACKS_MAINNET } = await import("@stacks/network");

  const tx = await makeSTXTokenTransfer({
    recipient: recipientAddress,
    amount: microSTX,
    senderKey: privateKey,
    network: STACKS_MAINNET,
    anchorMode: AnchorMode.Any,
    memo: "SKYNT cross-chain transfer",
    fee: BigInt(2000),
  });

  const response = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });

  if ("error" in response && response.error) {
    throw new Error(`Stacks broadcast error: ${response.error} — ${(response as any).reason ?? ""}`);
  }

  const txHash = (response as any).txid ?? (response as any).tx_id ?? String(response);
  return {
    txHash,
    status: "broadcast",
    explorerUrl: `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`,
    chain: "stacks",
  };
}

// ─── Monero (XMR) ─────────────────────────────────────────────────────────────

export async function transmitMonero(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const walletRpc = requireEnv("XMR_WALLET_RPC_URL");
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

  const data = await res.json() as { result?: { tx_hash: string; fee: number }; error?: { message: string; code: number } };
  if (data.error) throw new Error(`Monero wallet RPC error (${data.error.code}): ${data.error.message}`);

  const txHash = data.result?.tx_hash;
  if (!txHash) throw new Error("Monero RPC returned no tx_hash");

  console.log(`[ChainTransmit] XMR ${amount} → ${recipientAddress} | tx: ${txHash} | fee: ${data.result?.fee}`);
  return {
    txHash,
    status: "broadcast",
    explorerUrl: `https://xmrchain.net/tx/${txHash}`,
    chain: "monero",
  };
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
      throw new Error("SKYNT is an internal platform token — no external chain transmit needed");
    default:
      throw new Error(`Unsupported chain for live transmit: ${chain}`);
  }
}
