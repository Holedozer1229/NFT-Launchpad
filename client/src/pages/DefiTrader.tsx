import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, RefreshCw, ExternalLink, Zap, DollarSign,
  BarChart3, ArrowDownUp, Coins, Globe, Shield, Activity, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DefiOpportunity {
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

interface OpportunitiesData {
  opportunities: DefiOpportunity[];
  lastUpdated: number;
  bestApy: number;
  totalTracked: number;
  chains: string[];
  isScanning: boolean;
}

interface PriceData {
  prices: Record<string, number>;
  updatedAt: number;
}

const CHAIN_COLORS: Record<string, string> = {
  Polygon: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  BSC: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  Ethereum: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  Arbitrum: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  Optimism: "text-red-400 border-red-500/30 bg-red-500/10",
  Avalanche: "text-orange-400 border-orange-500/30 bg-orange-500/10",
};

const CHAIN_IDS: Record<string, number> = {
  Ethereum: 1, Polygon: 137, BSC: 56, Arbitrum: 42161, Optimism: 10, Avalanche: 43114,
};

function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
  return `$${(tvl / 1e3).toFixed(0)}K`;
}

function apyColor(apy: number): string {
  if (apy >= 100) return "text-neon-orange";
  if (apy >= 20) return "text-neon-green";
  if (apy >= 5) return "text-neon-cyan";
  return "text-foreground";
}

export default function DefiTrader() {
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [stableOnly, setStableOnly] = useState(false);
  const [sortField, setSortField] = useState<"apy" | "tvlUsd">("apy");
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: oppsData, isLoading: oppsLoading } = useQuery<OpportunitiesData>({
    queryKey: ["/api/defi/opportunities", chainFilter, stableOnly],
    queryFn: () => {
      const params = new URLSearchParams();
      if (chainFilter !== "all") params.set("chain", chainFilter);
      if (stableOnly) params.set("stableOnly", "true");
      return fetch(`/api/defi/opportunities?${params}`).then(r => r.json());
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: priceData, isLoading: pricesLoading } = useQuery<PriceData>({
    queryKey: ["/api/defi/prices"],
    refetchInterval: 60 * 1000,
  });

  const rescanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/defi/rescan"),
    onSuccess: () => {
      toast({ title: "DeFi scan triggered", description: "Results will update in ~30 seconds" });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/defi/opportunities"] }), 35000);
    },
    onError: () => toast({ title: "Scan failed", description: "Could not trigger rescan", variant: "destructive" }),
  });

  const opportunities = oppsData?.opportunities ?? [];
  const sorted = [...opportunities].sort((a, b) =>
    sortField === "apy" ? b.apy - a.apy : b.tvlUsd - a.tvlUsd
  );

  const topOpp = sorted[0];
  const prices = priceData?.prices ?? {};

  const TOKEN_SYMBOLS = ["ETH", "MATIC", "BNB", "USDC", "AAVE", "UNI", "CAKE", "ARB"];

  return (
    <div className="space-y-6 p-2 sm:p-6" data-testid="defi-trader-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading tracking-widest neon-glow-cyan" data-testid="text-defi-title">
            DeFi Trader
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            Live yield scanning across Uniswap · PancakeSwap · Aave · Curve · Balancer
          </p>
        </div>
        <div className="flex items-center gap-2">
          {oppsData?.isScanning && (
            <span className="text-[10px] font-mono text-neon-cyan flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" /> Scanning…
            </span>
          )}
          {oppsData?.lastUpdated ? (
            <span className="text-[10px] font-mono text-muted-foreground">
              Updated {Math.floor((Date.now() - oppsData.lastUpdated) / 60000)}m ago
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => rescanMutation.mutate()}
            disabled={rescanMutation.isPending || oppsData?.isScanning}
            className="gap-1.5 text-xs"
            data-testid="button-rescan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rescanMutation.isPending ? "animate-spin" : ""}`} />
            Rescan Markets
          </Button>
        </div>
      </div>

      {/* ── Live Token Prices ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2" data-testid="section-prices">
        {TOKEN_SYMBOLS.map(sym => (
          <div key={sym} className="cosmic-card px-3 py-2 text-center" data-testid={`price-${sym.toLowerCase()}`}>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{sym}</p>
            {pricesLoading ? (
              <Skeleton className="h-4 w-16 mx-auto mt-1" />
            ) : prices[sym] ? (
              <p className="font-mono text-xs text-neon-cyan">
                ${prices[sym] >= 1000 ? prices[sym].toLocaleString(undefined, { maximumFractionDigits: 0 }) : prices[sym].toFixed(prices[sym] >= 1 ? 2 : 4)}
              </p>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">—</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Best Opportunity Highlight ── */}
      {topOpp && (
        <div className="cosmic-card cosmic-card-cyan p-4" data-testid="card-best-opportunity">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-sm bg-neon-green/10">
                <TrendingUp className="w-5 h-5 text-neon-green" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-heading text-xs tracking-wider text-muted-foreground uppercase">Best Opportunity Right Now</p>
                  <Badge variant="outline" className="text-[9px] border-neon-green/30 text-neon-green no-default-hover-elevate">
                    LIVE
                  </Badge>
                </div>
                <p className="font-heading text-lg text-foreground mt-0.5">
                  {topOpp.project} — {topOpp.symbol}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`font-heading text-2xl ${apyColor(topOpp.apy)}`}>
                    {topOpp.apy.toFixed(2)}% APY
                  </span>
                  {topOpp.apyReward && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {topOpp.apyBase.toFixed(2)}% base + {topOpp.apyReward.toFixed(2)}% rewards
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant="outline" className={`text-[9px] no-default-hover-elevate ${CHAIN_COLORS[topOpp.chain] ?? "text-muted-foreground border-border"}`}>
                {topOpp.chain}
              </Badge>
              <p className="font-mono text-xs text-muted-foreground">TVL {formatTvl(topOpp.tvlUsd)}</p>
              <a href={topOpp.url} target="_blank" rel="noopener noreferrer" data-testid="link-best-opportunity">
                <Button size="sm" variant="outline" className="text-xs gap-1.5 h-7">
                  Open Protocol <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Chain Filter + Sort Controls ── */}
      <div className="flex flex-wrap items-center gap-2" data-testid="section-filters">
        <div className="flex items-center gap-1 flex-wrap">
          {["all", "Polygon", "BSC", "Ethereum", "Arbitrum", "Optimism", "Avalanche"].map(chain => (
            <button
              key={chain}
              onClick={() => setChainFilter(chain)}
              data-testid={`filter-chain-${chain}`}
              className={`font-mono text-[10px] px-2.5 py-1 rounded-sm border transition-colors ${
                chainFilter === chain
                  ? "bg-neon-cyan/15 border-neon-cyan/40 text-neon-cyan"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              {chain === "all" ? "All Chains" : chain}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setStableOnly(!stableOnly)}
            data-testid="filter-stable-only"
            className={`font-mono text-[10px] px-2.5 py-1 rounded-sm border transition-colors flex items-center gap-1 ${
              stableOnly
                ? "bg-neon-green/15 border-neon-green/40 text-neon-green"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="w-3 h-3" /> Stables only
          </button>
          <button
            onClick={() => setSortField(sortField === "apy" ? "tvlUsd" : "apy")}
            data-testid="button-sort-toggle"
            className="font-mono text-[10px] px-2.5 py-1 rounded-sm border border-border text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowDownUp className="w-3 h-3" />
            Sort: {sortField === "apy" ? "APY" : "TVL"}
          </button>
        </div>
      </div>

      {/* ── Opportunities Table ── */}
      <div className="cosmic-card overflow-hidden" data-testid="table-opportunities">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neon-cyan" />
            <h3 className="font-heading text-sm font-semibold">Live Yield Opportunities</h3>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {oppsData?.totalTracked ?? 0} pools tracked
          </span>
        </div>

        {oppsLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="font-mono text-sm text-muted-foreground">No opportunities found — try broadening filters or rescanning</p>
          </div>
        ) : (
          <div>
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border">
              {["Protocol / Pool", "Chain", "APY", "TVL", "IL Risk", ""].map((h, i) => (
                <p key={i} className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{h}</p>
              ))}
            </div>
            {sorted.map((opp, idx) => (
              <div key={opp.pool} data-testid={`row-opportunity-${idx}`}>
                <div
                  className="grid grid-cols-[2fr_1fr_1.2fr_1fr_1fr_auto] sm:grid-cols-[2fr_1fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-border/50 hover-elevate cursor-pointer items-center"
                  onClick={() => setExpandedPool(expandedPool === opp.pool ? null : opp.pool)}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-foreground font-medium truncate">{opp.project}</p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">{opp.symbol}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] w-fit no-default-hover-elevate ${CHAIN_COLORS[opp.chain] ?? "text-muted-foreground border-border"}`}>
                    {opp.chain}
                  </Badge>
                  <div>
                    <p className={`font-heading text-sm ${apyColor(opp.apy)}`}>{opp.apy.toFixed(2)}%</p>
                    {opp.apyReward && <p className="font-mono text-[9px] text-muted-foreground">{opp.apyReward.toFixed(2)}% rwds</p>}
                  </div>
                  <p className="font-mono text-xs text-foreground">{formatTvl(opp.tvlUsd)}</p>
                  <Badge
                    variant="outline"
                    className={`text-[9px] w-fit no-default-hover-elevate ${
                      opp.ilRisk === "no" ? "border-neon-green/30 text-neon-green" :
                      opp.ilRisk === "low" ? "border-neon-cyan/30 text-neon-cyan" :
                      "border-neon-orange/30 text-neon-orange"
                    }`}
                  >
                    {opp.ilRisk === "no" ? "No IL" : opp.ilRisk === "low" ? "Low IL" : "IL Risk"}
                  </Badge>
                  <div className="flex items-center">
                    {expandedPool === opp.pool ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </div>

                {expandedPool === opp.pool && (
                  <div className="px-4 py-3 bg-card/50 border-b border-border/50 flex flex-wrap items-center justify-between gap-3" data-testid={`expanded-${opp.pool}`}>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase">Base APY</p>
                        <p className="font-mono text-xs text-neon-cyan">{opp.apyBase.toFixed(2)}%</p>
                      </div>
                      {opp.apyReward && (
                        <div>
                          <p className="font-mono text-[9px] text-muted-foreground uppercase">Reward APY</p>
                          <p className="font-mono text-xs text-neon-green">{opp.apyReward.toFixed(2)}%</p>
                        </div>
                      )}
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase">Category</p>
                        <p className="font-mono text-xs text-foreground capitalize">{opp.category}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase">Stablecoin</p>
                        <p className="font-mono text-xs text-foreground">{opp.stablecoin ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    <a
                      href={opp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-open-protocol-${idx}`}
                    >
                      <Button size="sm" variant="outline" className="text-xs gap-1.5">
                        Open on {opp.project} <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Protocol Breakdown by Chain ── */}
      {oppsData?.chains && oppsData.chains.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="section-chain-breakdown">
          {oppsData.chains.map(chain => {
            const chainOpps = oppsData.opportunities.filter(o => o.chain === chain);
            const best = chainOpps[0];
            return (
              <div
                key={chain}
                className="cosmic-card p-3 cursor-pointer hover-elevate"
                onClick={() => setChainFilter(chainFilter === chain ? "all" : chain)}
                data-testid={`card-chain-${chain}`}
              >
                <p className={`font-mono text-[10px] font-bold ${(CHAIN_COLORS[chain] ?? "text-foreground").split(" ")[0]}`}>{chain}</p>
                <p className="font-heading text-sm text-foreground mt-1">{best?.apy.toFixed(1)}%</p>
                <p className="font-mono text-[9px] text-muted-foreground">best APY</p>
                <p className="font-mono text-[9px] text-muted-foreground">{chainOpps.length} pools</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Info Banner ── */}
      <div className="cosmic-card p-4 flex items-start gap-3">
        <Zap className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-heading text-xs tracking-wider">How Profitability is Determined</p>
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            Opportunities are sourced live from <strong className="text-foreground">DeFiLlama</strong> (100+ protocols) and ranked by total APY — combining base yield from trading fees with token reward incentives. Protocols include <strong className="text-foreground">Uniswap V3</strong>, <strong className="text-foreground">PancakeSwap V3</strong>, <strong className="text-foreground">Aave</strong>, <strong className="text-foreground">Curve</strong>, and <strong className="text-foreground">Balancer</strong> across Polygon, BSC, Arbitrum, and Ethereum. IL Risk indicates impermanent loss exposure. Stablecoin pairs have no IL. Click any row to expand details and open the protocol directly.
          </p>
        </div>
      </div>
    </div>
  );
}
