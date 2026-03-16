import { Alchemy, Network, Utils, Wallet, Contract } from "alchemy-sdk";

const SKYNT_CONTRACT_ADDRESS = process.env.SKYNT_CONTRACT_ADDRESS || "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20";
const TREASURY_WALLET = process.env.TREASURY_WALLET_ADDRESS || "0x7Fbe68677e63272ECB55355a6778fCee974d4895";

let _alchemy: Alchemy | null = null;

function getAlchemy(): Alchemy {
  if (!_alchemy) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY is not configured");
    }
    _alchemy = new Alchemy({
      apiKey,
      network: Network.ZKSYNC_MAINNET,
    });
  }
  return _alchemy;
}

const ERC1155_ABI = [
  "function mint(address to, uint256 id, uint256 amount, bytes data) external",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
];

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
    if (process.env.NODE_ENV === "production") {
      throw new Error("TREASURY_PRIVATE_KEY is required for mainnet minting");
    }
    const transactionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    console.warn("[AlchemyEngine] TREASURY_PRIVATE_KEY not set — returning simulated transaction (dev only)");
    return {
      transactionId,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      status: "simulated",
    };
  }

  try {
    const alchemy = getAlchemy();
    const provider = await alchemy.config.getProvider();
    const wallet = new Wallet(privateKey, provider);

    const contract = new Contract(SKYNT_CONTRACT_ADDRESS, ERC1155_ABI, wallet);

    const tx = await contract.mint(
      params.recipientAddress,
      params.tokenId.toString(),
      params.quantity.toString(),
      "0x"
    );

    const receipt = await tx.wait();

    return {
      transactionId: receipt.transactionHash,
      txHash: receipt.transactionHash,
      status: receipt.status === 1 ? "confirmed" : "reverted",
    };
  } catch (err: any) {
    console.error("[AlchemyEngine] Mint transaction failed:", err.message);
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
    const alchemy = getAlchemy();
    const receipt = await alchemy.core.getTransactionReceipt(transactionId);

    if (!receipt) {
      return {
        status: "pending",
        transactionId,
      };
    }

    return {
      status: receipt.status === 1 ? "confirmed" : "reverted",
      transactionId,
      blockNumber: receipt.blockNumber,
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
