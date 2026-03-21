import { Alchemy, Network, Utils, Wallet, Contract } from "alchemy-sdk";

export const SKYNT_CONTRACT_ADDRESS = process.env.SKYNT_CONTRACT_ADDRESS || "0x22d3f06afB69e5FCFAa98C20009510dD11aF2517";
const SKYNT_MINING_CONTRACT_ADDRESS = process.env.SKYNT_MINING_CONTRACT_ADDRESS || "";
export const TREASURY_WALLET = process.env.TREASURY_WALLET_ADDRESS || "0x0000000000000000000000000000000000000000";

const MIN_GAS_RESERVE_ETH = 0.005; // minimum ETH to keep as gas reserve

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

// ─── Self-Gas-Funding Treasury ────────────────────────────────────────────────

interface GasStatus {
  ethBalance: string;
  ethBalanceFloat: number;
  isHealthy: boolean;
  isCritical: boolean;
  reserveThreshold: number;
  criticalThreshold: number;
  treasuryAddress: string;
  message: string;
}

let _lastGasCheck: GasStatus | null = null;
let _lastGasCheckTime = 0;
const GAS_CHECK_TTL_MS = 30_000;

export async function getTreasuryGasStatus(): Promise<GasStatus> {
  const now = Date.now();
  if (_lastGasCheck && now - _lastGasCheckTime < GAS_CHECK_TTL_MS) {
    return _lastGasCheck;
  }

  const address = TREASURY_WALLET;
  const CRITICAL = 0.001;

  if (!process.env.ALCHEMY_API_KEY || !address || address === "0x0000000000000000000000000000000000000000") {
    return {
      ethBalance: "0",
      ethBalanceFloat: 0,
      isHealthy: false,
      isCritical: true,
      reserveThreshold: MIN_GAS_RESERVE_ETH,
      criticalThreshold: CRITICAL,
      treasuryAddress: address,
      message: "Treasury not configured",
    };
  }

  try {
    const alchemy = getAlchemyForChain("ethereum");
    const balanceWei = await alchemy.core.getBalance(address, "latest");
    const balanceEth = parseFloat(Utils.formatEther(balanceWei));
    const status: GasStatus = {
      ethBalance: balanceEth.toFixed(6),
      ethBalanceFloat: balanceEth,
      isHealthy: balanceEth >= MIN_GAS_RESERVE_ETH,
      isCritical: balanceEth < CRITICAL,
      reserveThreshold: MIN_GAS_RESERVE_ETH,
      criticalThreshold: CRITICAL,
      treasuryAddress: address,
      message: balanceEth >= MIN_GAS_RESERVE_ETH
        ? "Gas reserve healthy"
        : balanceEth < CRITICAL
          ? `CRITICAL: Only ${balanceEth.toFixed(6)} ETH — deposit ETH to ${address}`
          : `Low gas: ${balanceEth.toFixed(6)} ETH (min ${MIN_GAS_RESERVE_ETH} ETH recommended)`,
    };
    _lastGasCheck = status;
    _lastGasCheckTime = now;
    if (!status.isHealthy) {
      console.warn(`[Treasury Gas] ${status.message}`);
    }
    return status;
  } catch (err: any) {
    console.error("[Treasury Gas] Balance check failed:", err.message);
    return {
      ethBalance: "unknown",
      ethBalanceFloat: 0,
      isHealthy: false,
      isCritical: false,
      reserveThreshold: MIN_GAS_RESERVE_ETH,
      criticalThreshold: CRITICAL,
      treasuryAddress: address,
      message: "Balance check unavailable",
    };
  }
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
  gasStatus?: GasStatus;
}> {
  const { recipientAddress, amount, chain, token } = params;
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!recipientAddress || !recipientAddress.startsWith("0x")) {
    throw new Error(`Invalid EVM address: "${recipientAddress}" — must start with 0x`);
  }

  if (!privateKey) {
    console.error("[RewardTransmit] TREASURY_PRIVATE_KEY missing — cannot transmit on-chain");
    throw new Error("TREASURY_PRIVATE_KEY is not configured — live on-chain transmit requires a funded treasury key");
  }

  // ── Self-gas check before transmitting ──────────────────────────────────────
  const gasStatus = await getTreasuryGasStatus();
  if (gasStatus.isCritical) {
    console.error(`[Treasury Gas] CRITICAL: ${gasStatus.message}`);
    return { txHash: null, status: "insufficient_gas", chain, explorerUrl: null, gasStatus };
  }
  if (!gasStatus.isHealthy) {
    console.warn(`[Treasury Gas] Low reserve: ${gasStatus.message} — attempting transaction anyway`);
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
      const amountWei = Utils.parseUnits(amount, 18);
      tx = await contract.transfer(recipientAddress, amountWei);
    } else {
      tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: Utils.parseEther(amount),
      });
    }

    const receipt = await tx.wait();
    const explorerUrl = getExplorerUrl(chain, receipt.transactionHash);
    _lastGasCheckTime = 0; // invalidate gas cache after tx

    console.log(`[RewardTransmit] ${amount} ${token} → ${recipientAddress} on ${chain} | tx: ${receipt.transactionHash}`);
    return {
      txHash: receipt.transactionHash,
      status: receipt.status === 1 ? "confirmed" : "reverted",
      chain,
      explorerUrl,
      gasStatus,
    };
  } catch (err: any) {
    console.error(`[RewardTransmit] Failed ${chain}:`, err.message);
    _lastGasCheckTime = 0;
    return {
      txHash: null,
      status: err.message?.includes("insufficient") ? "insufficient_funds" : "failed",
      chain,
      explorerUrl: null,
    };
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

