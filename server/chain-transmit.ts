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

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const BLOCKCYPHER_BASE = "https://api.blockcypher.com/v1/doge/main";
const DOGE_SATOSHI = 1e8;

export interface ChainTransmitResult {
  txHash: string;
  status: string;
  explorerUrl: string | null;
  chain: string;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not configured — cannot execute live on-chain transmit`);
  return val;
}

function decodeDogeWif(wif: string): Uint8Array {
  const decoded = base58check.decode(wif);
  const raw = decoded.slice(1);
  return raw.length === 33 && raw[32] === 0x01 ? raw.slice(0, 32) : raw.slice(0, 32);
}

export async function transmitSolana(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const keyB58 = requireEnv("SOLANA_TREASURY_KEY");
  let secretKey: Uint8Array;
  try {
    const { base58 } = await import("@scure/base");
    secretKey = base58.decode(keyB58);
  } catch {
    throw new Error("SOLANA_TREASURY_KEY must be a base58-encoded 64-byte secret key");
  }
  if (secretKey.length !== 64) {
    throw new Error(`SOLANA_TREASURY_KEY invalid length (${secretKey.length}, expected 64)`);
  }

  const keypair = Keypair.fromSecretKey(secretKey);
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const lamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
  if (lamports <= 0) throw new Error("Amount too small for Solana transfer");

  const recipient = new PublicKey(recipientAddress);
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: recipient, lamports })
  );

  const txHash = await sendAndConfirmTransaction(connection, tx, [keypair]);
  console.log(`[ChainTransmit] SOL ${amount} → ${recipientAddress} | tx: ${txHash}`);
  return {
    txHash,
    status: "confirmed",
    explorerUrl: `https://solscan.io/tx/${txHash}`,
    chain: "solana",
  };
}

export async function transmitDogecoin(
  recipientAddress: string,
  amount: string
): Promise<ChainTransmitResult> {
  const wif = requireEnv("DOGE_TREASURY_WIF");
  const privKey = decodeDogeWif(wif);
  const pubKeyBytes = secp256k1.getPublicKey(privKey, true);
  const pubKeyHex = Buffer.from(pubKeyBytes).toString("hex");

  const treasuryAddress = requireEnv("DOGE_TREASURY_ADDRESS");
  const satoshis = Math.round(parseFloat(amount) * DOGE_SATOSHI);
  if (satoshis < 100000) throw new Error("Amount below Dogecoin dust threshold (0.001 DOGE min)");

  const newTxBody = {
    inputs: [{ addresses: [treasuryAddress] }],
    outputs: [{ addresses: [recipientAddress], value: satoshis }],
  };

  const newTxRes = await fetch(`${BLOCKCYPHER_BASE}/txs/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTxBody),
  });

  if (!newTxRes.ok) {
    const err = await newTxRes.text();
    throw new Error(`BlockCypher DOGE tx create failed: ${err}`);
  }

  const txTemplate = await newTxRes.json() as {
    tx: object;
    tosign: string[];
    errors?: { error: string }[];
  };

  if (txTemplate.errors?.length) {
    throw new Error(`DOGE tx error: ${txTemplate.errors.map(e => e.error).join(", ")}`);
  }

  const signatures = (txTemplate.tosign || []).map((hashHex: string) => {
    const sig = secp256k1.sign(Buffer.from(hashHex, "hex"), privKey, { lowS: true });
    return sig.toDERHex();
  });

  const sendRes = await fetch(`${BLOCKCYPHER_BASE}/txs/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tx: txTemplate.tx,
      tosign: txTemplate.tosign,
      signatures,
      pubkeys: (txTemplate.tosign || []).map(() => pubKeyHex),
    }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`BlockCypher DOGE broadcast failed: ${err}`);
  }

  const result = await sendRes.json() as { tx: { hash: string } };
  const txHash = result.tx?.hash;
  if (!txHash) throw new Error("DOGE broadcast returned no tx hash");

  console.log(`[ChainTransmit] DOGE ${amount} → ${recipientAddress} | tx: ${txHash}`);
  return {
    txHash,
    status: "broadcast",
    explorerUrl: `https://dogechain.info/tx/${txHash}`,
    chain: "dogecoin",
  };
}

export async function transmitToChain(
  chain: string,
  recipientAddress: string,
  amount: string,
  token: string
): Promise<ChainTransmitResult> {
  switch (chain) {
    case "solana":
      return transmitSolana(recipientAddress, amount);

    case "dogecoin":
      return transmitDogecoin(recipientAddress, amount);

    case "stacks":
      throw new Error(
        "Stacks (STX) live transmit requires @stacks/transactions + STACKS_TREASURY_KEY — not yet configured on this node"
      );

    case "monero":
      throw new Error(
        "Monero (XMR) transmit requires a connected XMR daemon (monerod) and wallet RPC — not available on this node"
      );

    case "skynt":
      throw new Error(
        "SphinxSkynet internal transfers should use the SphinxSkynet chain API directly, not the cross-chain transmitter"
      );

    default:
      throw new Error(`Unsupported chain for live transmit: ${chain}`);
  }
}
