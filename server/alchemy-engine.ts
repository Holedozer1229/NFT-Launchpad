import { Alchemy, Network } from "alchemy-sdk";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zkSync } from "viem/chains";

const SKYNT_CONTRACT_ADDRESS = "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20";
const TREASURY_WALLET = "0x7Fbe68677e63272ECB55355a6778fCee974d4895";

let _alchemy: Alchemy | null = null;

function getAlchemy(): Alchemy {
  if (!_alchemy) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY is not configured");
    }
    _alchemy = new Alchemy({
      apiKey,
      network: Network.ETH_MAINNET,
    });
  }
  return _alchemy;
}

function getPublicClient() {
  const apiKey = process.env.ALCHEMY_API_KEY;
  const rpcUrl = apiKey
    ? `https://zksync-mainnet.g.alchemy.com/v2/${apiKey}`
    : "https://mainnet.era.zksync.io";

  return createPublicClient({
    chain: zkSync,
    transport: http(rpcUrl),
  });
}

const ERC1155_ABI = parseAbi([
  "function mint(address to, uint256 id, uint256 amount, bytes data) external",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
]);

export async function mintNftViaEngine(params: {
  recipientAddress: string;
  tokenId: bigint;
  quantity: bigint;
}): Promise<{
  transactionId: string;
  txHash: string | null;
  status: string;
}> {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    const transactionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return {
      transactionId,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      status: "simulated",
    };
  }

  try {
    const apiKey = process.env.ALCHEMY_API_KEY;
    const rpcUrl = apiKey
      ? `https://zksync-mainnet.g.alchemy.com/v2/${apiKey}`
      : "https://mainnet.era.zksync.io";

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: zkSync,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.writeContract({
      address: SKYNT_CONTRACT_ADDRESS as `0x${string}`,
      abi: ERC1155_ABI,
      functionName: "mint",
      args: [
        params.recipientAddress as `0x${string}`,
        params.tokenId,
        params.quantity,
        "0x" as `0x${string}`,
      ],
    });

    return {
      transactionId: txHash,
      txHash,
      status: "confirmed",
    };
  } catch (err: any) {
    const transactionId = `err_${Date.now()}`;
    return {
      transactionId,
      txHash: null,
      status: err.message?.includes("insufficient") ? "insufficient_funds" : "failed",
    };
  }
}

export async function getEngineTransactionStatus(transactionId: string) {
  if (transactionId.startsWith("sim_") || transactionId.startsWith("err_")) {
    return {
      status: transactionId.startsWith("sim_") ? "simulated" : "failed",
      transactionId,
    };
  }

  try {
    const publicClient = getPublicClient();
    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionId as `0x${string}`,
    });

    return {
      status: receipt.status === "success" ? "confirmed" : "reverted",
      transactionId,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch {
    return {
      status: "pending",
      transactionId,
    };
  }
}

export function isEngineConfigured(): boolean {
  return !!process.env.ALCHEMY_API_KEY;
}

export { SKYNT_CONTRACT_ADDRESS, TREASURY_WALLET };
