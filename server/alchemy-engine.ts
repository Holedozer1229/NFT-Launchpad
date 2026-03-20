import { Alchemy, Network, Utils, Wallet, Contract } from "alchemy-sdk";

const SKYNT_CONTRACT_ADDRESS = process.env.SKYNT_CONTRACT_ADDRESS || "0xfbc620cc04cc73bf443981b1d9f99a03fd5de38d";
const SKYNT_MINING_CONTRACT_ADDRESS = process.env.SKYNT_MINING_CONTRACT_ADDRESS || "";
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

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

const BTC_RPC_ENDPOINTS: Record<string, string> = {
  btc: "https://blockstream.info/api",
  doge: "https://dogechain.info/api/v1",
};

const CHAIN_NETWORK_MAP: Record<string, Network> = {
  ethereum: Network.ETH_MAINNET,
  polygon: Network.MATIC_MAINNET,
  base: Network.BASE_MAINNET,
  zksync: Network.ZKSYNC_MAINNET,
  arbitrum: Network.ARB_MAINNET,
};

function getAlchemyForChain(chain: string): Alchemy {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw new Error("ALCHEMY_API_KEY is not configured");
  const network = CHAIN_NETWORK_MAP[chain] || Network.ETH_MAINNET;
  return new Alchemy({ apiKey, network });
}

export async function transmitRewardToWallet(params: {
  recipientAddress: string;
  amount: string;
  chain: string;
  token: string;
}): Promise<{
  txHash: string | null;
  status: string;
  chain: string;
  explorerUrl: string | null;
}> {
  const { recipientAddress, amount, chain, token } = params;
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!recipientAddress || !recipientAddress.startsWith("0x")) {
    return { txHash: null, status: "invalid_address", chain, explorerUrl: null };
  }

  if (chain === "btc" || chain === "doge") {
    return await relayToUtxoChain(chain, recipientAddress, amount);
  }

  if (!privateKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[RewardTransmit] TREASURY_PRIVATE_KEY missing — cannot send mainnet reward");
      return { txHash: null, status: "missing_treasury_key", chain, explorerUrl: null };
    }
    const simHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
    console.warn(`[RewardTransmit] Simulated reward ${amount} ${token} → ${recipientAddress} on ${chain}`);
    return { txHash: simHash, status: "simulated", chain, explorerUrl: null };
  }

  try {
    const alchemy = getAlchemyForChain(chain);
    const provider = await alchemy.config.getProvider();
    const wallet = new Wallet(privateKey, provider);

    let tx: any;

    if (token === "ETH" || token === "MATIC") {
      tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: Utils.parseEther(amount),
      });
    } else if (token === "SKYNT" || token === "ERC20") {
      const contract = new Contract(SKYNT_CONTRACT_ADDRESS, ERC20_ABI, wallet);
      const decimals = 18;
      const amountWei = Utils.parseUnits(amount, decimals);
      tx = await contract.transfer(recipientAddress, amountWei);
    } else {
      tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: Utils.parseEther(amount),
      });
    }

    const receipt = await tx.wait();
    const explorerUrl = getExplorerUrl(chain, receipt.transactionHash);

    console.log(`[RewardTransmit] ${amount} ${token} → ${recipientAddress} on ${chain} | tx: ${receipt.transactionHash}`);
    return {
      txHash: receipt.transactionHash,
      status: receipt.status === 1 ? "confirmed" : "reverted",
      chain,
      explorerUrl,
    };
  } catch (err: any) {
    console.error(`[RewardTransmit] Failed ${chain}:`, err.message);
    return {
      txHash: null,
      status: err.message?.includes("insufficient") ? "insufficient_funds" : "failed",
      chain,
      explorerUrl: null,
    };
  }
}

async function relayToUtxoChain(
  chain: string,
  address: string,
  amount: string
): Promise<{ txHash: string | null; status: string; chain: string; explorerUrl: string | null }> {
  const endpoint = BTC_RPC_ENDPOINTS[chain];
  if (!endpoint) {
    return { txHash: null, status: "unsupported_utxo_chain", chain, explorerUrl: null };
  }

  try {
    const response = await fetch(`${endpoint}/tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: address,
        amount,
        chain,
        timestamp: Date.now(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const txHash = data.txid || data.hash || null;
      return {
        txHash,
        status: txHash ? "broadcast" : "queued",
        chain,
        explorerUrl: chain === "btc"
          ? `https://blockstream.info/tx/${txHash}`
          : `https://dogechain.info/tx/${txHash}`,
      };
    }

    console.warn(`[UTXO-Relay] ${chain} RPC returned ${response.status} — reward queued for retry`);
    return {
      txHash: null,
      status: "rpc_queued",
      chain,
      explorerUrl: null,
    };
  } catch (err: any) {
    console.error(`[UTXO-Relay] ${chain} relay error:`, err.message);
    return { txHash: null, status: "relay_error", chain, explorerUrl: null };
  }
}

function getExplorerUrl(chain: string, txHash: string): string | null {
  const explorers: Record<string, string> = {
    ethereum: `https://etherscan.io/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    zksync: `https://explorer.zksync.io/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
  };
  return explorers[chain] || null;
}

export async function getOnChainBalance(address: string, chain: string = "ethereum"): Promise<string> {
  try {
    const alchemy = getAlchemyForChain(chain);
    const balance = await alchemy.core.getBalance(address);
    return Utils.formatEther(balance);
  } catch {
    return "0";
  }
}

export function isEngineConfigured(): boolean {
  return !!process.env.ALCHEMY_API_KEY;
}

export function isTreasuryConfigured(): boolean {
  return !!process.env.TREASURY_PRIVATE_KEY;
}

export { SKYNT_CONTRACT_ADDRESS, TREASURY_WALLET };
