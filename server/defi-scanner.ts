import { createPublicClient, http, parseUnits, formatUnits } from "viem";
import { polygon, bsc, mainnet, arbitrum } from "viem/chains";

export interface DefiOpportunity {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  apy: number;
  apyBase: number;
  apyReward: number | null;
  tvlUsd: number;
  stablecoin: boolean;
  ilRisk: string;
  url: string;
  category: string;
}

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  price: number;
  priceImpact: number;
  gas: string;
  protocol: string;
  chain: string;
  chainId: number;
  calldata?: string;
  to?: string;
  value?: string;
}

export interface ScannerState {
  lastUpdated: number;
  topOpportunities: DefiOpportunity[];
  chainBreakdown: Record<string, DefiOpportunity[]>;
  bestApy: number;
  totalTracked: number;
  isRunning: boolean;
}

const CHAINS_TO_SCAN = ["Polygon", "BSC", "Arbitrum", "Ethereum", "Optimism", "Avalanche"];
const MIN_TVL = 1_000_000;
const TOP_N = 40;

let state: ScannerState = {
  lastUpdated: 0,
  topOpportunities: [],
  chainBreakdown: {},
  bestApy: 0,
  totalTracked: 0,
  isRunning: false,
};

let scanInterval: NodeJS.Timeout | null = null;

async function fetchDefiLlamaYields(): Promise<DefiOpportunity[]> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      headers: { "User-Agent": "SKYNT-Protocol/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);
    const data = (await res.json()) as { data: any[] };

    return data.data
      .filter(
        (p) =>
          p.tvlUsd >= MIN_TVL &&
          p.apy > 0 &&
          p.apy < 10000 &&
          CHAINS_TO_SCAN.includes(p.chain)
      )
      .map((p) => ({
        pool: p.pool,
        project: p.project,
        chain: p.chain,
        symbol: p.symbol,
        apy: parseFloat((p.apy ?? 0).toFixed(4)),
        apyBase: parseFloat((p.apyBase ?? 0).toFixed(4)),
        apyReward: p.apyReward != null ? parseFloat(p.apyReward.toFixed(4)) : null,
        tvlUsd: p.tvlUsd,
        stablecoin: !!p.stablecoin,
        ilRisk: p.ilRisk ?? "no",
        url: p.url ?? `https://defillama.com/yields?project=${p.project}`,
        category: p.category ?? "pool",
      }))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, TOP_N);
  } catch (err: any) {
    console.error("[DeFiScanner] DeFiLlama fetch failed:", err.message);
    return [];
  }
}

async function runScan() {
  state.isRunning = true;
  try {
    const pools = await fetchDefiLlamaYields();
    const breakdown: Record<string, DefiOpportunity[]> = {};
    for (const p of pools) {
      if (!breakdown[p.chain]) breakdown[p.chain] = [];
      breakdown[p.chain].push(p);
    }
    state.topOpportunities = pools;
    state.chainBreakdown = breakdown;
    state.bestApy = pools[0]?.apy ?? 0;
    state.totalTracked = pools.length;
    state.lastUpdated = Date.now();
    console.log(
      `[DeFiScanner] Scan complete — ${pools.length} opportunities | best APY: ${state.bestApy.toFixed(2)}% on ${pools[0]?.project ?? "?"} (${pools[0]?.chain ?? "?"})`
    );
  } catch (err: any) {
    console.error("[DeFiScanner] Scan error:", err.message);
  } finally {
    state.isRunning = false;
  }
}

export function getDeFiScannerState(): ScannerState {
  return state;
}

export async function getSwapQuote(
  fromToken: string,
  toToken: string,
  amount: string,
  chainId: number
): Promise<SwapQuote | null> {
  const chainName =
    chainId === 137 ? "Polygon" : chainId === 56 ? "BSC" : chainId === 42161 ? "Arbitrum" : "Ethereum";
  const paraswapChainId = chainId;

  try {
    const url = `https://apiv5.paraswap.io/prices?srcToken=${fromToken}&destToken=${toToken}&amount=${amount}&network=${paraswapChainId}&side=SELL&includeDEXS=UniswapV3,UniswapV2,Curve,Balancer,SushiSwap&maxImpact=15`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SKYNT-Protocol/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Paraswap HTTP ${res.status}`);
    const data = await res.json();
    const pr = data.priceRoute;
    if (!pr) return null;
    return {
      fromToken: pr.srcToken,
      toToken: pr.destToken,
      fromAmount: pr.srcAmount,
      toAmount: pr.destAmount,
      price: parseFloat(pr.destAmount) / parseFloat(pr.srcAmount),
      priceImpact: parseFloat(pr.maxImpactReached ? "5" : pr.side === "SELL" ? "0.1" : "0.1"),
      gas: pr.gasCost ?? "150000",
      protocol: pr.bestRoute?.[0]?.swaps?.[0]?.swapExchanges?.[0]?.exchange ?? "Paraswap",
      chain: chainName,
      chainId,
    };
  } catch (err: any) {
    console.error("[DeFiScanner] Paraswap quote error:", err.message);
    return null;
  }
}

export async function fetchLiveTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  try {
    const ids = symbols
      .map((s) => {
        const map: Record<string, string> = {
          ETH: "ethereum", MATIC: "matic-network", BNB: "binancecoin",
          USDC: "usd-coin", USDT: "tether", WBTC: "wrapped-bitcoin",
          ARB: "arbitrum", OP: "optimism", AAVE: "aave",
          UNI: "uniswap", CAKE: "pancakeswap-token",
        };
        return map[s] ?? s.toLowerCase();
      })
      .join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const out: Record<string, number> = {};
    const revMap: Record<string, string> = {
      ethereum: "ETH", "matic-network": "MATIC", binancecoin: "BNB",
      "usd-coin": "USDC", tether: "USDT", "wrapped-bitcoin": "WBTC",
      arbitrum: "ARB", optimism: "OP", aave: "AAVE", uniswap: "UNI",
      "pancakeswap-token": "CAKE",
    };
    for (const [cgId, prices] of Object.entries(data) as any) {
      const sym = revMap[cgId] ?? cgId.toUpperCase();
      out[sym] = (prices as any).usd;
    }
    return out;
  } catch (err: any) {
    console.error("[DeFiScanner] CoinGecko price fetch error:", err.message);
    return {};
  }
}

export function startDeFiScanner() {
  console.log("[DeFiScanner] Starting DeFi opportunity scanner (poll every 5min)");
  runScan();
  scanInterval = setInterval(runScan, 5 * 60 * 1000);
}

export function stopDeFiScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
}
