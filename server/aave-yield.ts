import { wsHub } from "./ws-hub";

export interface AaveYieldState {
  depositedEth: number;
  aTokenBalance: number;
  yieldEarned: number;
  currentApr: number;
  lastUpdated: number;
  isActive: boolean;
  depositHistory: AaveDepositRecord[];
}

export interface AaveDepositRecord {
  timestamp: number;
  amountEth: number;
  txHash: string | null;
  type: "deposit" | "withdraw" | "compound";
}

const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const AWETH_ADDRESS = "0x4d5F47FA6A74756f5Bc1Ce69C2A86E93B74bB12F";

const WETH_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const AAVE_POOL_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const RAY = 10n ** 27n;

let state: AaveYieldState = {
  depositedEth: 0,
  aTokenBalance: 0,
  yieldEarned: 0,
  currentApr: 0,
  lastUpdated: 0,
  isActive: false,
  depositHistory: [],
};

let pollInterval: ReturnType<typeof setInterval> | null = null;
let _pollErrorCount = 0;

async function getViemClients() {
  const { createPublicClient, createWalletClient, http, getAddress } = await import("viem");
  const { mainnet } = await import("viem/chains");
  const { privateKeyToAccount } = await import("viem/accounts");

  const rpcUrl = process.env.ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "https://eth-mainnet.g.alchemy.com/v2/demo";

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: mainnet, transport });

  const pk = process.env.TREASURY_PRIVATE_KEY;
  let walletClient = null;
  if (pk) {
    const key = pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`);
    const account = privateKeyToAccount(key);
    walletClient = createWalletClient({ account, chain: mainnet, transport });
  }

  return { publicClient, walletClient, getAddress };
}

export async function getAaveApr(): Promise<number> {
  try {
    const { publicClient, getAddress } = await getViemClients();
    const reserveData = await publicClient.readContract({
      address: getAddress(AAVE_V3_POOL),
      abi: AAVE_POOL_ABI,
      functionName: "getReserveData",
      args: [getAddress(WETH_ADDRESS)],
    });
    const liquidityRate: bigint = reserveData.currentLiquidityRate;
    const aprFloat = Number(liquidityRate * 10000n / RAY) / 100;
    return Math.max(0, aprFloat);
  } catch (err: any) {
    console.warn("[Aave] getAaveApr failed:", err?.message?.slice(0, 80));
    return state.currentApr || 3.5;
  }
}

export async function getAavePosition(treasuryAddress: string): Promise<{ aTokenBalance: number; depositedEth: number; yieldEarned: number; currentApr: number }> {
  try {
    const { publicClient, getAddress } = await getViemClients();
    const raw = await publicClient.readContract({
      address: getAddress(AWETH_ADDRESS),
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [getAddress(treasuryAddress as `0x${string}`)],
    });
    const aTokenBalance = Number(raw as bigint) / 1e18;
    const apr = await getAaveApr();
    const yieldEarned = aTokenBalance > state.depositedEth ? aTokenBalance - state.depositedEth : state.yieldEarned;
    return { aTokenBalance, depositedEth: state.depositedEth, yieldEarned, currentApr: apr };
  } catch (err: any) {
    console.warn("[Aave] getAavePosition failed:", err?.message?.slice(0, 80));
    return { aTokenBalance: state.aTokenBalance, depositedEth: state.depositedEth, yieldEarned: state.yieldEarned, currentApr: state.currentApr };
  }
}

export async function depositToAave(amountEth: number): Promise<{ success: boolean; txHash: string | null; message: string }> {
  if (!process.env.TREASURY_PRIVATE_KEY || !process.env.ALCHEMY_API_KEY) {
    // Do NOT mutate deposited state — position must reflect on-chain reality only
    return { success: false, txHash: null, message: "Treasury wallet not configured — on-chain deposit unavailable" };
  }
  if (amountEth <= 0) return { success: false, txHash: null, message: "Amount must be > 0" };

  try {
    const { publicClient, walletClient, getAddress } = await getViemClients();
    if (!walletClient) throw new Error("Wallet client unavailable");

    const { parseEther } = await import("viem");
    const amountWei = parseEther(amountEth.toString());
    const account = walletClient.account!;

    // Step 1: Wrap ETH → WETH
    const wrapHash = await walletClient.writeContract({
      address: getAddress(WETH_ADDRESS),
      abi: WETH_ABI,
      functionName: "deposit",
      value: amountWei,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: wrapHash });

    // Step 2: Approve Aave Pool to spend WETH
    const approveHash = await walletClient.writeContract({
      address: getAddress(WETH_ADDRESS),
      abi: WETH_ABI,
      functionName: "approve",
      args: [getAddress(AAVE_V3_POOL), amountWei],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Step 3: Supply WETH to Aave v3
    const supplyHash = await walletClient.writeContract({
      address: getAddress(AAVE_V3_POOL),
      abi: AAVE_POOL_ABI,
      functionName: "supply",
      args: [getAddress(WETH_ADDRESS), amountWei, account.address, 0],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: supplyHash });

    state.depositedEth += amountEth;
    const record: AaveDepositRecord = { timestamp: Date.now(), amountEth, txHash: supplyHash, type: "deposit" };
    state.depositHistory.unshift(record);
    if (state.depositHistory.length > 50) state.depositHistory.pop();
    state.isActive = true;
    state.lastUpdated = Date.now();

    wsHub.broadcast("aave:deposit", { amountEth, txHash: supplyHash, depositedEth: state.depositedEth });
    console.log(`[Aave] Deposited ${amountEth} ETH (wrap→approve→supply) | tx: ${supplyHash}`);

    return { success: true, txHash: supplyHash, message: `Deposited ${amountEth} ETH to Aave v3` };
  } catch (err: any) {
    console.error("[Aave] depositToAave failed:", err?.message);
    return { success: false, txHash: null, message: err?.message ?? "Deposit failed" };
  }
}

export async function withdrawFromAave(amountEth: number): Promise<{ success: boolean; txHash: string | null; message: string }> {
  if (!process.env.TREASURY_PRIVATE_KEY || !process.env.ALCHEMY_API_KEY) {
    return { success: false, txHash: null, message: "Treasury wallet not configured" };
  }

  try {
    const { publicClient, walletClient, getAddress } = await getViemClients();
    if (!walletClient) throw new Error("Wallet client unavailable");

    const { parseEther } = await import("viem");
    const amountWei = parseEther(amountEth.toString());
    const account = walletClient.account!;

    const hash = await walletClient.writeContract({
      address: getAddress(AAVE_V3_POOL),
      abi: AAVE_POOL_ABI,
      functionName: "withdraw",
      args: [getAddress(WETH_ADDRESS), amountWei, account.address],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    state.depositedEth = Math.max(0, state.depositedEth - amountEth);
    const record: AaveDepositRecord = { timestamp: Date.now(), amountEth, txHash: hash, type: "withdraw" };
    state.depositHistory.unshift(record);
    if (state.depositHistory.length > 50) state.depositHistory.pop();
    state.lastUpdated = Date.now();

    wsHub.broadcast("aave:withdraw", { amountEth, txHash: hash, depositedEth: state.depositedEth });
    console.log(`[Aave] Withdrew ${amountEth} ETH from Aave | tx: ${hash}`);

    return { success: true, txHash: hash, message: `Withdrew ${amountEth} ETH from Aave v3` };
  } catch (err: any) {
    console.error("[Aave] withdrawFromAave failed:", err?.message);
    return { success: false, txHash: null, message: err?.message ?? "Withdraw failed" };
  }
}

async function pollAaveState(): Promise<void> {
  try {
    const apr = await getAaveApr();
    state.currentApr = apr;

    const treasuryAddr = process.env.TREASURY_WALLET_ADDRESS;
    if (treasuryAddr) {
      // Always read on-chain aToken balance — do not gate on in-memory depositedEth
      // so pre-existing on-chain positions are picked up after process restart
      const pos = await getAavePosition(treasuryAddr);
      state.aTokenBalance = pos.aTokenBalance;
      state.isActive = pos.aTokenBalance > 0;
      if (state.isActive) {
        // Sync depositedEth from on-chain balance if in-memory value is zero
        // (handles restart case where state was wiped)
        if (state.depositedEth === 0) state.depositedEth = pos.aTokenBalance;
        if (pos.aTokenBalance > state.depositedEth) {
          state.yieldEarned = pos.aTokenBalance - state.depositedEth;
        }
      }
    }

    state.lastUpdated = Date.now();

    wsHub.broadcast("aave:state", {
      depositedEth: state.depositedEth,
      aTokenBalance: state.aTokenBalance,
      yieldEarned: state.yieldEarned,
      currentApr: state.currentApr,
    });
  } catch (err: any) {
    _pollErrorCount++;
    if (_pollErrorCount === 1 || _pollErrorCount % 10 === 0) {
      console.warn(`[Aave] pollAaveState error (×${_pollErrorCount}):`, err?.message?.slice(0, 100));
    }
  }
}

export function getAaveYieldState(): AaveYieldState {
  return { ...state, depositHistory: [...state.depositHistory] };
}

export function updateAaveStateFromTreasury(depositedEth: number): void {
  state.depositedEth = depositedEth;
  if (depositedEth > 0) state.isActive = true;
  state.lastUpdated = Date.now();
}

export function startAaveYieldEngine(): void {
  if (pollInterval) return;
  console.log("[Aave] Starting Aave v3 yield engine (poll every 5min)");

  pollAaveState().catch(() => {});

  pollInterval = setInterval(() => {
    pollAaveState().catch(() => {});
  }, 5 * 60 * 1000);

  process.on("SIGTERM", () => stopAaveYieldEngine());
  process.on("SIGINT", () => stopAaveYieldEngine());
}

export function stopAaveYieldEngine(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[Aave] Aave yield engine stopped");
  }
}

export function isAaveEngineRunning(): boolean {
  return pollInterval !== null;
}
