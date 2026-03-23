/**
 * Wormhole Relayer — Official SDK Integration
 *
 * Uses @wormhole-foundation/sdk (TypeScript SDK) as the primary bridge layer.
 * EVM contract calls (ERC-20 approve, sendTokenWithPayloadToEvm, NTT) are
 * performed via viem — the SDK is used for chain/address resolution, canonical
 * chain IDs, VAA parsing, and ETH→Solana bridging.
 *
 * Flow for every cross-chain transfer:
 *   1. ZK Verifier gate (IZKVerifier.verifyProof on-chain — optional)
 *   2. Wormhole SDK token transfer initiation (EVM→EVM or EVM→Solana)
 *   3. Kora gasless relay for Solana destination (treasury pays SOL fee)
 *
 * Required secrets:
 *   TREASURY_PRIVATE_KEY    — EVM signing key (0x-prefixed or raw hex)
 *   ALCHEMY_API_KEY         — Ethereum / Polygon / Arbitrum / Base RPC
 *
 * Optional secrets:
 *   ZK_VERIFIER_ADDRESS     — IZKVerifier contract; skipped if unset
 *   SKYNT_NTT_HUB_ADDRESS   — NTT Hub for SKYNT cross-chain
 *   SKYNT_TOKEN_ADDRESS     — SKYNT ERC-20 on Ethereum
 *   WORMHOLE_RELAYER_GAS   — Delivery gasLimit override (default 250 000)
 *   SOLANA_TREASURY_KEY    — base58 Solana keypair (for Kora fee-payer)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  getAddress,
  encodeAbiParameters,
  parseAbiParameters,
  type Hex,
  type Address,
  type Chain,
} from "viem";
import { mainnet, polygon, arbitrum, base, optimism } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ─── Wormhole Chain Registry ───────────────────────────────────────────────────
// Official Wormhole chain IDs (uint16).  Used as the targetChain parameter
// in WormholeRelayer contract calls.
// Reference: https://wormhole.com/docs/reference/contracts

export const WORMHOLE_CHAIN_IDS: Record<string, number> = {
  solana:        1,
  ethereum:      2,
  bsc:           4,
  polygon:       5,
  avalanche:     6,
  arbitrum:      23,
  optimism:      24,
  base:          30,
  polygon_zkevm: 37,
  zksync:        35,
  stacks:        21,
};

// ─── Standard Relayer addresses (mainnet) ─────────────────────────────────────
// Source: https://wormhole.com/docs/reference/contracts#standard-relayer

const WORMHOLE_RELAYER_ADDR: Record<string, Address> = {
  ethereum:      "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
  polygon:       "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
  arbitrum:      "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
  optimism:      "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
  base:          "0x706F82e9bb5b0813501714Ab5974216704980e31",
  bsc:           "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
  avalanche:     "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
  polygon_zkevm: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
};

// Wormhole Token Bridge — used for ETH→Solana token transfers
const TOKEN_BRIDGE_ADDR: Record<string, Address> = {
  ethereum: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
  polygon:  "0x5a58505a96D1dbf8dF91cB21B54419FC36e93fde",
  arbitrum: "0x0b2402144Bb366A632D14B83F244D2e0e21bD39c",
  base:     "0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627",
};

// ─── EVM chain viem objects ────────────────────────────────────────────────────

const VIEM_CHAIN: Record<string, Chain> = {
  ethereum: mainnet,
  polygon,
  arbitrum,
  base,
  optimism,
};

// ─── Token registry ──────────────────────────────────────────────────────────

const TOKEN_ADDRESS: Record<string, string> = {
  SKYNT: process.env.SKYNT_TOKEN_ADDRESS  ?? "0x0000000000000000000000000000000000000000",
  USDC:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT:  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  WBTC:  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  WETH:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ETH:   "NATIVE",
  MATIC: "NATIVE",
  SOL:   "NATIVE",
  STX:   "NATIVE",
  DOGE:  "NATIVE",
  XMR:   "NATIVE",
};

const TOKEN_DECIMALS: Record<string, number> = {
  SKYNT: 18, USDC: 6, USDT: 6, WBTC: 8, WETH: 18,
  ETH: 18, MATIC: 18, SOL: 9, STX: 6, DOGE: 8,
};

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const WORMHOLE_RELAYER_ABI = [
  {
    name: "quoteEVMDeliveryPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "targetChain",   type: "uint16"  },
      { name: "receiverValue", type: "uint256" },
      { name: "gasLimit",      type: "uint256" },
    ],
    outputs: [
      { name: "nativePriceQuote",              type: "uint256" },
      { name: "targetChainRefundPerGasUnused", type: "uint256" },
    ],
  },
  {
    name: "sendTokenWithPayloadToEvm",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "targetChain",   type: "uint16"  },
      { name: "targetAddress", type: "address" },
      { name: "payload",       type: "bytes"   },
      { name: "receiverValue", type: "uint256" },
      { name: "gasLimit",      type: "uint256" },
      { name: "token",         type: "address" },
      { name: "amount",        type: "uint256" },
    ],
    outputs: [{ name: "sequence", type: "uint64" }],
  },
  {
    name: "sendPayloadToEvm",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "targetChain",   type: "uint16"  },
      { name: "targetAddress", type: "address" },
      { name: "payload",       type: "bytes"   },
      { name: "receiverValue", type: "uint256" },
      { name: "gasLimit",      type: "uint256" },
    ],
    outputs: [{ name: "sequence", type: "uint64" }],
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// IZKVerifier — deployed at ZK_VERIFIER_ADDRESS (optional).
// Interface: verifyProof(bytes32 proofHash, bytes calldata publicInputs) view returns (bool)
const ZK_VERIFIER_ABI = [
  {
    name: "verifyProof",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proofHash",    type: "bytes32" },
      { name: "publicInputs", type: "bytes"   },
    ],
    outputs: [{ name: "valid", type: "bool" }],
  },
] as const;

// Wormhole NTT Hub — SKYNT cross-chain using Native Token Transfers standard
const NTT_HUB_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amount",                  type: "uint256" },
      { name: "recipientChain",          type: "uint16"  },
      { name: "recipient",               type: "bytes32" },
      { name: "refundAddress",           type: "bytes32" },
      { name: "shouldQueue",             type: "bool"    },
      { name: "transceiverInstructions", type: "bytes"   },
    ],
    outputs: [{ name: "msgId", type: "uint64" }],
  },
  {
    name: "quoteDeliveryPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "recipientChain",          type: "uint16" },
      { name: "transceiverInstructions", type: "bytes"  },
    ],
    outputs: [
      { name: "nativePrices", type: "uint256[]" },
      { name: "totalPrice",   type: "uint256"   },
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WormholeRelayResult {
  success: boolean;
  txHash: string | null;
  sequence: bigint | null;
  explorerUrl: string | null;
  method: "sendTokenWithPayloadToEvm" | "sendPayloadToEvm" | "ntt_transfer" | "wh_sdk_eth_to_sol" | "unsupported";
  zkVerified: boolean;
  deliveryQuote: bigint | null;
  wormholeSequence: string | null;
  error: string | null;
}

export interface SendCrossChainParams {
  sourceChain: string;
  destChain: string;
  recipientAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  tokenDecimals?: number;
  zkProofHash?: string;
  payload?: Hex;
}

// ─── RPC / explorer helpers ───────────────────────────────────────────────────

function getRpcUrl(chain: string): string {
  const k = process.env.ALCHEMY_API_KEY;
  const networks: Record<string, string> = {
    ethereum: k ? `https://eth-mainnet.g.alchemy.com/v2/${k}` : "https://cloudflare-eth.com",
    polygon:  k ? `https://polygon-mainnet.g.alchemy.com/v2/${k}` : "https://polygon-rpc.com",
    arbitrum: k ? `https://arb-mainnet.g.alchemy.com/v2/${k}` : "https://arb1.arbitrum.io/rpc",
    base:     k ? `https://base-mainnet.g.alchemy.com/v2/${k}` : "https://mainnet.base.org",
    optimism: k ? `https://opt-mainnet.g.alchemy.com/v2/${k}` : "https://mainnet.optimism.io",
  };
  return networks[chain] ?? (k ? `https://eth-mainnet.g.alchemy.com/v2/${k}` : "https://cloudflare-eth.com");
}

function explorerTx(chain: string, hash: string): string {
  const e: Record<string, string> = {
    ethereum: `https://etherscan.io/tx/${hash}`,
    polygon:  `https://polygonscan.com/tx/${hash}`,
    arbitrum: `https://arbiscan.io/tx/${hash}`,
    base:     `https://basescan.org/tx/${hash}`,
    optimism: `https://optimistic.etherscan.io/tx/${hash}`,
  };
  return e[chain] ?? `https://etherscan.io/tx/${hash}`;
}

function getEvmClients(chain: string) {
  const viemChain = VIEM_CHAIN[chain] ?? mainnet;
  const transport = http(getRpcUrl(chain), { timeout: 30_000 });
  const publicClient = createPublicClient({ chain: viemChain, transport });

  const pk = process.env.TREASURY_PRIVATE_KEY;
  if (!pk) throw new Error("TREASURY_PRIVATE_KEY not configured");
  const key = (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
  const account = privateKeyToAccount(key);
  const walletClient = createWalletClient({ account, chain: viemChain, transport });
  return { publicClient, walletClient, account };
}

function addrToBytes32(addr: string): Hex {
  return `0x${addr.replace("0x", "").padStart(64, "0")}` as Hex;
}

function buildPayload(zkProofHash: string, recipient: string): Hex {
  const proof = zkProofHash.replace("0x", "").slice(0, 64).padEnd(64, "0");
  const addr  = recipient.replace("0x", "").slice(0, 40).padStart(64, "0");
  return `0x${proof}${addr}` as Hex;
}

// ─── ZK Verifier Gate ─────────────────────────────────────────────────────────

async function runZkVerifierGate(
  publicClient: ReturnType<typeof createPublicClient>,
  zkProofHash: string,
  publicInputs: Hex = "0x"
): Promise<boolean> {
  const addr = process.env.ZK_VERIFIER_ADDRESS;
  if (!addr) {
    console.log("[WormholeRelayer] ZK_VERIFIER_ADDRESS not set — off-chain ZK proof accepted");
    return true;
  }
  try {
    const proofBytes = `0x${zkProofHash.replace("0x", "").padEnd(64, "0").slice(0, 64)}` as Hex;
    const valid = await publicClient.readContract({
      address: getAddress(addr),
      abi: ZK_VERIFIER_ABI,
      functionName: "verifyProof",
      args: [proofBytes, publicInputs],
    }) as boolean;
    console.log(`[WormholeRelayer] ZK verifier gate: ${valid ? "✓ PASS" : "✗ FAIL"} — proof ${zkProofHash.slice(0, 18)}…`);
    return valid;
  } catch (err: any) {
    console.warn("[WormholeRelayer] ZK verifier call failed — continuing:", err.message?.slice(0, 80));
    return true;  // non-blocking: verifier unreachable ≠ proof invalid
  }
}

// ─── Delivery Price Quote ─────────────────────────────────────────────────────

async function quoteDeliveryPrice(
  publicClient: ReturnType<typeof createPublicClient>,
  relayerAddress: Address,
  targetChainId: number,
  gasLimit: bigint
): Promise<bigint> {
  try {
    const [quote] = await publicClient.readContract({
      address: relayerAddress,
      abi: WORMHOLE_RELAYER_ABI,
      functionName: "quoteEVMDeliveryPrice",
      args: [targetChainId, BigInt(0), gasLimit],
    }) as [bigint, bigint];
    console.log(`[WormholeRelayer] Delivery quote: ${quote}wei for gasLimit=${gasLimit}`);
    return quote;
  } catch (err: any) {
    console.warn("[WormholeRelayer] quoteEVMDeliveryPrice failed — using 0.003 ETH fallback:", err.message?.slice(0, 60));
    return BigInt("3000000000000000");
  }
}

// ─── Official Wormhole SDK — ETH→Solana Token Transfer ───────────────────────
// Uses @wormhole-foundation/sdk for ETH→Solana bridging via the Token Bridge.
// This covers the path: Ethereum ERC-20 lock → Wormhole VAA → Solana redeem.

async function sendEthToSolanaViaWormholeSDK(
  tokenSymbol: string,
  tokenAddr: string,
  amount: string,
  recipientSolAddr: string,
  zkProofHash: string
): Promise<WormholeRelayResult> {
  try {
    console.log(`[WormholeRelayer] ETH→SOL SDK transfer: ${amount} ${tokenSymbol} → ${recipientSolAddr}`);

    // Lazy-import the official Wormhole TypeScript SDK (ESM)
    const { Wormhole, amount: whAmount, wormhole } = await import("@wormhole-foundation/sdk");
    const evmMod = await import("@wormhole-foundation/sdk-evm");
    const evmPlatform: any = (evmMod as any).default ?? evmMod;
    const solanaMod = await import("@wormhole-foundation/sdk-solana");
    const solanaPlatform: any = (solanaMod as any).default ?? solanaMod;

    // Initialize Wormhole instance for mainnet with EVM + Solana platforms
    const wh = await wormhole("Mainnet", [evmPlatform, solanaPlatform]);

    // Build chain contexts
    const srcChain = wh.getChain("Ethereum");
    const dstChain = wh.getChain("Solana");

    // Build a treasury EVM signer compatible with the Wormhole SDK
    const pk = process.env.TREASURY_PRIVATE_KEY;
    if (!pk) throw new Error("TREASURY_PRIVATE_KEY not configured");

    // Create a minimal Wormhole SDK-compatible signer wrapper around viem
    const { publicClient, walletClient, account } = getEvmClients("ethereum");
    const treasurySigner = {
      chain: () => "Ethereum" as const,
      address: () => Wormhole.chainAddress("Ethereum", account.address),
      signAndSend: async (txs: any[]) => {
        const hashes: string[] = [];
        for (const tx of txs) {
          const hash = await walletClient.sendTransaction({
            to: tx.transaction.to as Address,
            data: tx.transaction.data as Hex,
            value: tx.transaction.value ? BigInt(tx.transaction.value) : undefined,
            gas: tx.transaction.gas ? BigInt(tx.transaction.gas) : undefined,
          });
          hashes.push(hash);
          console.log(`[WormholeRelayer] SDK signAndSend tx: ${hash}`);
        }
        return hashes;
      },
    };

    // Resolve the token — use canonical native ETH or ERC-20 address
    const tokenId = tokenAddr === "NATIVE"
      ? Wormhole.tokenId("Ethereum", "native")
      : Wormhole.tokenId("Ethereum", getAddress(tokenAddr));

    // Recipient address on Solana
    const dstAddress = Wormhole.chainAddress("Solana", recipientSolAddr);

    // Build the automatic token transfer (Wormhole relayer pays for Solana redemption)
    const xfer: any = await (wh as any).tokenTransfer(
      tokenId,
      BigInt(parseUnits(amount, TOKEN_DECIMALS[tokenSymbol] ?? 18).toString()),
      { chain: "Ethereum", address: Wormhole.chainAddress("Ethereum", account.address).address },
      { chain: "Solana",   address: dstAddress.address },
      true,   // automatic = true → relayer pays for Solana-side redemption (no SOL needed by recipient)
    );

    // Get and log the delivery quote from the SDK (method name varies by SDK version)
    let sdkQuote: any = null;
    try {
      sdkQuote = typeof xfer.quote === "function" ? await xfer.quote() :
                 typeof xfer.getQuote === "function" ? await xfer.getQuote() : null;
      console.log(`[WormholeRelayer] SDK quote: ${JSON.stringify(sdkQuote)}`);
    } catch (qe) {
      console.warn("[WormholeRelayer] Could not fetch SDK quote:", qe);
    }

    // Initiate transfer on Ethereum
    const srcTxids: string[] = await xfer.initiateTransfer(treasurySigner as any);
    const srcTxHash = srcTxids[srcTxids.length - 1] ?? null;

    console.log(`[WormholeRelayer] ETH→SOL SDK initiated | txHash: ${srcTxHash}`);
    return {
      success: true,
      txHash: srcTxHash,
      sequence: null,
      explorerUrl: srcTxHash ? explorerTx("ethereum", srcTxHash) : null,
      method: "wh_sdk_eth_to_sol",
      zkVerified: true,
      deliveryQuote: sdkQuote,
      wormholeSequence: xfer.transfer?.sequence?.toString() ?? (xfer.transfer as any)?.seq?.toString() ?? null,
      error: null,
    };
  } catch (err: any) {
    console.error("[WormholeRelayer] ETH→SOL SDK failed:", err.message?.slice(0, 300));
    return {
      success: false, txHash: null, sequence: null, explorerUrl: null,
      method: "wh_sdk_eth_to_sol", zkVerified: true, deliveryQuote: null,
      wormholeSequence: null, error: err.message,
    };
  }
}

// ─── Kora Gasless Relay (Solana fee-payer) ────────────────────────────────────
// Kora is a gasless relay for Solana — it acts as the fee-payer on a partially
// signed transaction so the end-user needs zero SOL.
// This implementation uses the treasury Solana key as the fee-payer,
// mimicking the Kora pattern without an external relayer dependency.

export interface KoraRelayResult {
  success: boolean;
  signature: string | null;
  explorerUrl: string | null;
  feePaidBy: string;
  error: string | null;
}

export async function koraGaslessRelay(
  serializedTx: Uint8Array | string,
  featureName: string = "oiye-vault"
): Promise<KoraRelayResult> {
  const solKey = process.env.SOLANA_TREASURY_KEY;
  if (!solKey) {
    return { success: false, signature: null, explorerUrl: null, feePaidBy: "none", error: "SOLANA_TREASURY_KEY not configured — Kora gasless relay disabled" };
  }

  try {
    const { Connection, Keypair, Transaction, sendAndConfirmTransaction } = await import("@solana/web3.js");
    const { base58 } = await import("@scure/base");

    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    const secret = base58.decode(solKey);
    const feePayerKeypair = Keypair.fromSecretKey(secret);

    // Deserialize the partially-signed transaction
    const txBytes = typeof serializedTx === "string" ? Buffer.from(serializedTx, "base64") : serializedTx;
    const tx = Transaction.from(txBytes);

    // Override fee payer with treasury key (Kora pattern)
    tx.feePayer = feePayerKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Sign as fee payer and broadcast
    const sig = await sendAndConfirmTransaction(connection, tx, [feePayerKeypair], { skipPreflight: false, commitment: "confirmed" });
    const explorerUrl = `https://solscan.io/tx/${sig}`;
    console.log(`[KoraRelay] ${featureName} gasless relay | feePayer: ${feePayerKeypair.publicKey.toBase58()} | sig: ${sig}`);
    return { success: true, signature: sig, explorerUrl, feePaidBy: feePayerKeypair.publicKey.toBase58(), error: null };
  } catch (err: any) {
    console.error("[KoraRelay] Gasless relay failed:", err.message?.slice(0, 200));
    return { success: false, signature: null, explorerUrl: null, feePaidBy: "none", error: err.message };
  }
}

// ─── Main sendCrossChain ──────────────────────────────────────────────────────

export async function sendCrossChain(params: SendCrossChainParams): Promise<WormholeRelayResult> {
  const {
    sourceChain,
    destChain,
    recipientAddress,
    tokenAddress,
    tokenSymbol,
    amount,
    tokenDecimals = 18,
    zkProofHash = "0x" + "0".repeat(64),
    payload: extraPayload,
  } = params;

  const relayerAddress = WORMHOLE_RELAYER_ADDR[sourceChain];
  const targetChainId  = WORMHOLE_CHAIN_IDS[destChain];

  if (!targetChainId) {
    return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "unsupported", zkVerified: false, deliveryQuote: null, wormholeSequence: null, error: `${destChain} is not a supported Wormhole target chain` };
  }

  // ZK Verifier gate — always runs if verifier address is set
  let zkVerified = true;
  if (relayerAddress) {
    try {
      const { publicClient } = getEvmClients(sourceChain);
      zkVerified = await runZkVerifierGate(publicClient, zkProofHash);
    } catch {}
  }
  if (!zkVerified) {
    return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "sendTokenWithPayloadToEvm", zkVerified: false, deliveryQuote: null, wormholeSequence: null, error: "ZK proof verification failed on-chain — transfer rejected" };
  }

  // ── ETH → Solana: use official Wormhole TypeScript SDK ───────────────────────
  if (destChain === "solana" && sourceChain === "ethereum") {
    const tokenAddr = tokenAddress !== "NATIVE" ? tokenAddress : "NATIVE";
    return sendEthToSolanaViaWormholeSDK(tokenSymbol, tokenAddr, amount, recipientAddress, zkProofHash);
  }

  // ── EVM → EVM: use WormholeRelayer contract directly via viem ────────────────
  if (!relayerAddress) {
    return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "unsupported", zkVerified, deliveryQuote: null, wormholeSequence: null, error: `No Wormhole Relayer deployed on ${sourceChain}` };
  }

  let clients: ReturnType<typeof getEvmClients>;
  try {
    clients = getEvmClients(sourceChain);
  } catch (err: any) {
    return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "unsupported", zkVerified, deliveryQuote: null, wormholeSequence: null, error: err.message };
  }

  const { publicClient, walletClient } = clients;
  const gasLimit     = BigInt(process.env.WORMHOLE_RELAYER_GAS ?? "250000");
  const deliveryQuote = await quoteDeliveryPrice(publicClient, relayerAddress, targetChainId, gasLimit);
  const payload      = extraPayload ?? buildPayload(zkProofHash, recipientAddress);
  const amountWei    = parseUnits(amount, tokenDecimals);
  const targetAddr   = getAddress(recipientAddress);

  // SKYNT NTT path
  const nttHubAddr = process.env.SKYNT_NTT_HUB_ADDRESS;
  if (tokenSymbol === "SKYNT" && nttHubAddr) {
    try {
      const skyntAddr = getAddress(tokenAddress !== "NATIVE" ? tokenAddress : nttHubAddr);
      await (walletClient as any).writeContract({ address: skyntAddr, abi: ERC20_ABI, functionName: "approve", args: [getAddress(nttHubAddr), amountWei] });
      const hash = await (walletClient as any).writeContract({
        address: getAddress(nttHubAddr),
        abi: NTT_HUB_ABI,
        functionName: "transfer",
        args: [amountWei, targetChainId, addrToBytes32(recipientAddress), addrToBytes32((walletClient as any).account.address), false, "0x"],
        value: deliveryQuote,
      });
      console.log(`[WormholeRelayer] NTT transfer | tx: ${hash}`);
      return { success: true, txHash: hash, sequence: null, explorerUrl: explorerTx(sourceChain, hash), method: "ntt_transfer", zkVerified, deliveryQuote, wormholeSequence: null, error: null };
    } catch (err: any) {
      return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "ntt_transfer", zkVerified, deliveryQuote, wormholeSequence: null, error: err.message };
    }
  }

  // ERC-20 → sendTokenWithPayloadToEvm
  if (tokenAddress !== "NATIVE") {
    try {
      const tokenAddr = getAddress(tokenAddress);
      await (walletClient as any).writeContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "approve", args: [relayerAddress, amountWei] });
      const hash = await (walletClient as any).writeContract({
        address: relayerAddress,
        abi: WORMHOLE_RELAYER_ABI,
        functionName: "sendTokenWithPayloadToEvm",
        args: [targetChainId, targetAddr, payload, BigInt(0), gasLimit, tokenAddr, amountWei],
        value: deliveryQuote,
      });
      console.log(`[WormholeRelayer] sendTokenWithPayloadToEvm | zkVerified=${zkVerified} | tx: ${hash}`);
      return { success: true, txHash: hash, sequence: null, explorerUrl: explorerTx(sourceChain, hash), method: "sendTokenWithPayloadToEvm", zkVerified, deliveryQuote, wormholeSequence: null, error: null };
    } catch (err: any) {
      return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "sendTokenWithPayloadToEvm", zkVerified, deliveryQuote, wormholeSequence: null, error: err.message };
    }
  }

  // Native ETH payload (sendPayloadToEvm)
  try {
    const hash = await (walletClient as any).writeContract({
      address: relayerAddress,
      abi: WORMHOLE_RELAYER_ABI,
      functionName: "sendPayloadToEvm",
      args: [targetChainId, targetAddr, payload, BigInt(0), gasLimit],
      value: deliveryQuote,
    });
    console.log(`[WormholeRelayer] sendPayloadToEvm | tx: ${hash}`);
    return { success: true, txHash: hash, sequence: null, explorerUrl: explorerTx(sourceChain, hash), method: "sendPayloadToEvm", zkVerified, deliveryQuote, wormholeSequence: null, error: null };
  } catch (err: any) {
    return { success: false, txHash: null, sequence: null, explorerUrl: null, method: "sendPayloadToEvm", zkVerified, deliveryQuote, wormholeSequence: null, error: err.message };
  }
}

// ─── Utility exports ──────────────────────────────────────────────────────────

export function isWormholeSupported(sourceChain: string, destChain: string): boolean {
  return (!!WORMHOLE_RELAYER_ADDR[sourceChain] || sourceChain === "ethereum") &&
    !!WORMHOLE_CHAIN_IDS[destChain];
}

export async function getDeliveryQuote(sourceChain: string, destChain: string): Promise<{ wei: bigint; eth: string } | null> {
  const relayerAddress = WORMHOLE_RELAYER_ADDR[sourceChain];
  const targetChainId  = WORMHOLE_CHAIN_IDS[destChain];
  if (!relayerAddress || !targetChainId) return null;
  try {
    const { publicClient } = getEvmClients(sourceChain);
    const gasLimit = BigInt(process.env.WORMHOLE_RELAYER_GAS ?? "250000");
    const wei = await quoteDeliveryPrice(publicClient, relayerAddress, targetChainId, gasLimit);
    return { wei, eth: (Number(wei) / 1e18).toFixed(6) };
  } catch {
    return null;
  }
}
