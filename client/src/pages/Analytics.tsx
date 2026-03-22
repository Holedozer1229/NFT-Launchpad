import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, Users, Layers, Activity, BarChart3, PieChart as PieChartIcon,
  Loader2, Flame, Coins, CircleDollarSign, Zap, ArrowUpRight, Target,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsStats {
  totalMinted: number;
  uniqueHolders: number;
  volume24h: string;
  allTimeVolume: string;
  rarityDistribution: { name: string; value: number; color: string }[];
  topHolders: { address: string; holdings: number; percentage: number }[];
  mintVolumeByMonth: { date: string; volume: number; revenue: number }[];
  dailyActivity: { day: string; mints: number; transfers: number; burns: number }[];
}

interface PriceSnapshot {
  epochNumber: number;
  priceEth: number;
  priceUsd: number;
  ethPriceUsd: number;
  poolFee: number;
  treasuryEthBalance: number;
  createdAt: string;
}

interface TokenStats {
  priceUsd: number;
  priceEth: number;
  ethPriceUsd: number;
  poolFee: number | null;
  targetPriceUsd: number;
  maxSupply: number;
  initialCirculating: number;
  circulatingSupply: number;
  totalSkyntBurned: number;
  totalSkyntBought: number;
  totalEthSpent: number;
  buybackEth24h: number;
  buybackSkynt24h: number;
  treasuryEthBalance: number;
  treasurySkyntBalance: number;
  epochCount: number;
  nftHolderCount: number;
  lastUpdated: string | null;
  pricePressureMode: string;
  engineRunning: boolean;
}

const tooltipStyle = {
  background: "hsl(220 25% 7%)",
  border: "1px solid hsl(210 20% 15%)",
  borderRadius: "4px",
  fontSize: "12px",
};

function StatCardSkeleton() {
  return (
    <div className="cosmic-card p-4">
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-8 w-20 mb-1" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

function fmt(n: number, decimals = 4) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string, range: string) {
  const d = new Date(iso);
  if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const MODE_COLOR: Record<string, string> = {
  aggressive: "text-plasma-red",
  moderate: "text-neon-orange",
  idle: "text-muted-foreground",
  target_reached: "text-neon-green",
};

const PRICE_RANGE_OPTIONS = ["24h", "7d", "30d"] as const;
type PriceRange = typeof PRICE_RANGE_OPTIONS[number];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("all");
  const [priceRange, setPriceRange] = useState<PriceRange>("24h");

  const { data, isLoading, isError } = useQuery<AnalyticsStats>({
    queryKey: ["/api/analytics/stats"],
    refetchInterval: 30000,
  });

  const { data: tokenStats, isLoading: statsLoading } = useQuery<TokenStats>({
    queryKey: ["/api/analytics/token-stats"],
    refetchInterval: 30000,
  });

  const { data: priceHistory, isLoading: priceLoading } = useQuery<PriceSnapshot[]>({
    queryKey: ["/api/analytics/price-history", priceRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/price-history?range=${priceRange}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const totalMinted = data?.totalMinted ?? 0;
  const uniqueHolders = data?.uniqueHolders ?? 0;
  const volume24h = data?.volume24h ?? "0.00";
  const allTimeVolume = data?.allTimeVolume ?? "0.00";
  const rarityDistribution = data?.rarityDistribution ?? [];
  const topHolders = data?.topHolders ?? [];
  const dailyActivity = data?.dailyActivity ?? [];

  const mintVolumeByMonth = data?.mintVolumeByMonth ?? [];
  const chartData = timeRange === "7d"
    ? mintVolumeByMonth.slice(-2)
    : timeRange === "30d"
    ? mintVolumeByMonth.slice(-4)
    : mintVolumeByMonth;

  const priceChartData = (priceHistory ?? []).map((snap) => ({
    time: formatDate(snap.createdAt, priceRange),
    price: parseFloat(snap.priceUsd.toFixed(6)),
    epoch: snap.epochNumber,
  }));

  const latestPrice = tokenStats?.priceUsd ?? 0;
  const targetPrice = tokenStats?.targetPriceUsd ?? 0.65;
  const priceProgress = targetPrice > 0 ? Math.min(100, (latestPrice / targetPrice) * 100) : 0;

  const statCards = [
    {
      label: "Total Minted",
      value: isLoading ? null : totalMinted.toLocaleString(),
      sub: "NFTs on-chain",
      icon: Layers,
      color: "cyan",
    },
    {
      label: "Unique Holders",
      value: isLoading ? null : uniqueHolders.toLocaleString(),
      sub: "Distinct owners",
      icon: Users,
      color: "green",
    },
    {
      label: "All-Time Volume",
      value: isLoading ? null : `${parseFloat(allTimeVolume).toLocaleString()} SKYNT`,
      sub: "Completed transactions",
      icon: TrendingUp,
      color: "orange",
    },
    {
      label: "24h Volume",
      value: isLoading ? null : `${parseFloat(volume24h).toLocaleString()} SKYNT`,
      sub: "Last 24 hours",
      icon: Activity,
      color: "magenta",
    },
  ];

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Live collection performance & SKYNT on-chain insights</p>
        </div>
        <div className="flex gap-1 bg-black/40 rounded-sm border border-border p-1">
          {(["7d", "30d", "all"] as const).map((range) => (
            <button
              key={range}
              data-testid={`button-range-${range}`}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-heading uppercase tracking-wider rounded-sm transition-all ${
                timeRange === range
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* ── SKYNT Token Stats Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "SKYNT Price",
            value: statsLoading ? null : `$${fmt(latestPrice, 6)}`,
            sub: tokenStats ? `${fmt(tokenStats.priceEth, 8)} ETH` : "",
            icon: CircleDollarSign,
            color: "text-neon-cyan",
            testId: "text-skynt-price",
          },
          {
            label: "Circulating Supply",
            value: statsLoading ? null : `${fmt(tokenStats?.circulatingSupply ?? 0, 0)}`,
            sub: `of ${(tokenStats?.maxSupply ?? 21_000_000).toLocaleString()} max`,
            icon: Coins,
            color: "text-neon-magenta",
            testId: "text-circulating-supply",
          },
          {
            label: "Total Burned",
            value: statsLoading ? null : `${fmt(tokenStats?.totalSkyntBurned ?? 0, 2)} SKYNT`,
            sub: "Sent to 0x000dead",
            icon: Flame,
            color: "text-plasma-red",
            testId: "text-total-burned",
          },
          {
            label: "24h Buyback ETH",
            value: statsLoading ? null : `${fmt(tokenStats?.buybackEth24h ?? 0, 5)} ETH`,
            sub: `${fmt(tokenStats?.buybackSkynt24h ?? 0, 2)} SKYNT bought`,
            icon: ArrowUpRight,
            color: "text-neon-orange",
            testId: "text-buyback-24h",
          },
          {
            label: "Treasury SKYNT",
            value: statsLoading ? null : `${fmt(tokenStats?.treasurySkyntBalance ?? 0, 2)}`,
            sub: `${fmt(tokenStats?.treasuryEthBalance ?? 0, 5)} ETH reserve`,
            icon: Target,
            color: "text-neon-green",
            testId: "text-treasury-skynt",
          },
          {
            label: "ETH Price",
            value: statsLoading ? null : `$${(tokenStats?.ethPriceUsd ?? 3200).toLocaleString()}`,
            sub: tokenStats?.engineRunning
              ? `${(tokenStats?.nftHolderCount ?? 0).toLocaleString()} NFT holders`
              : "Engine paused",
            icon: Zap,
            color: tokenStats?.engineRunning ? "text-neon-green" : "text-muted-foreground",
            testId: "text-eth-price",
          },
        ].map((stat) => (
          <div key={stat.label} className="cosmic-card p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <stat.icon className={`w-3 h-3 ${stat.color}`} />
              <span className="text-[9px] font-heading tracking-widest text-muted-foreground uppercase">{stat.label}</span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-5 w-20 mb-1" />
            ) : (
              <div className={`font-mono text-sm font-bold ${stat.color}`} data-testid={stat.testId}>
                {stat.value}
              </div>
            )}
            <span className="text-[9px] text-muted-foreground font-mono">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* ── SKYNT Price Chart ───────────────────────────────────────────── */}
      <div className="cosmic-card cosmic-card-cyan p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neon-cyan" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-price-chart-title">
              SKYNT / USD Live Price Chart
            </h3>
            {priceLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex gap-1 bg-black/40 rounded-sm border border-border p-1">
            {PRICE_RANGE_OPTIONS.map((range) => (
              <button
                key={range}
                data-testid={`button-price-range-${range}`}
                onClick={() => setPriceRange(range)}
                className={`px-3 py-1 text-[10px] font-heading uppercase tracking-wider rounded-sm transition-all ${
                  priceRange === range
                    ? "bg-neon-cyan/20 text-neon-cyan"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[260px]">
          {!priceLoading && priceChartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <TrendingUp className="w-8 h-8 opacity-20" />
              <p className="text-xs font-mono">No price data yet</p>
              <p className="text-[10px]">Price snapshots are written every 5 min when the engine runs</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceLoading ? [] : priceChartData}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(185 100% 50%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(185 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="hsl(220 15% 50%)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(220 15% 50%)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v.toFixed(4)}`}
                  width={70}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`$${v.toFixed(6)}`, "SKYNT/USD"]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(185 100% 50%)"
                  strokeWidth={2}
                  dot={priceChartData.length < 50 ? { fill: "hsl(185 100% 50%)", r: 2 } : false}
                  activeDot={{ r: 4, fill: "hsl(185 100% 50%)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
          {tokenStats && (
            <>
              <span>Pool fee: {tokenStats.poolFee != null ? `${tokenStats.poolFee / 10000}%` : "—"}</span>
              <span>Engine epochs: {tokenStats.epochCount}</span>
              <span className={MODE_COLOR[tokenStats.pricePressureMode] ?? "text-muted-foreground"}>
                Mode: {tokenStats.pricePressureMode.replace("_", " ").toUpperCase()}
              </span>
              {tokenStats.lastUpdated && (
                <span className="ml-auto">Updated: {formatTime(tokenStats.lastUpdated)}</span>
              )}
            </>
          )}
        </div>
      </div>

      {isError && (
        <div className="text-xs text-plasma-red font-mono text-center py-2">
          Failed to load analytics data
        </div>
      )}

      {/* ── NFT Stat Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) =>
          isLoading ? (
            <StatCardSkeleton key={stat.label} />
          ) : (
            <div
              key={stat.label}
              className={`cosmic-card cosmic-card-${stat.color} p-4`}
              data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label">{stat.label}</span>
                <stat.icon className={`w-4 h-4 text-neon-${stat.color}`} />
              </div>
              <div className="stat-value">{stat.value}</div>
              <span className="text-[10px] text-muted-foreground font-mono">{stat.sub}</span>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cosmic-card cosmic-card-cyan p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-neon-cyan" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-minting-volume">
              Minting Volume
            </h3>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
          </div>
          <div className="h-[280px]">
            {!isLoading && chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                No mint data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={isLoading ? [] : chartData}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(185 100% 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(185 100% 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="hsl(185 100% 50%)"
                    fill="url(#volumeGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="cosmic-card cosmic-card-magenta p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-4 h-4 text-neon-magenta" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-rarity-distribution">
              Rarity Distribution
            </h3>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
          </div>
          <div className="h-[200px]">
            {!isLoading && rarityDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                No NFTs minted yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={isLoading ? [] : rarityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rarityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1.5 mt-2">
            {isLoading
              ? [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-3 w-full" />)
              : rarityDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono">{item.value.toLocaleString()}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cosmic-card cosmic-card-green p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-neon-green" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-daily-activity">
              Daily Transactions
            </h3>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
          </div>
          <div className="h-[250px]">
            {!isLoading && dailyActivity.every(d => d.mints === 0 && d.transfers === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                No transaction activity yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={isLoading ? [] : dailyActivity}>
                  <XAxis dataKey="day" stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="mints" fill="hsl(145 100% 50%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="transfers" fill="hsl(185 100% 50%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-neon-green" /> Rewards
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-neon-cyan" /> Fees
            </div>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-orange p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-neon-orange" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-top-holders">
              Top Holders
            </h3>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-7 w-full" />)}
            </div>
          ) : topHolders.length === 0 ? (
            <div className="text-xs text-muted-foreground font-mono text-center py-8">
              No holder data yet
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  <th>Holdings</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {topHolders.map((holder, i) => (
                  <tr key={holder.address} data-testid={`row-holder-${i}`}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="text-primary font-mono">{holder.address}</td>
                    <td>{holder.holdings.toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, holder.percentage * 5)}%`,
                              background: `linear-gradient(90deg, hsl(30 100% 55%), hsl(45 100% 50%))`,
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground">{holder.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="cosmic-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-revenue-trend">
            Revenue Trend (SKYNT)
          </h3>
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
        </div>
        <div className="h-[200px]">
          {!isLoading && chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={isLoading ? [] : chartData}>
                <XAxis dataKey="date" stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(300 100% 60%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(300 100% 60%)", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
