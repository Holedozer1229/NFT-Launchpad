import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, Users, Layers, Activity, BarChart3, PieChart as PieChartIcon, Loader2 } from "lucide-react";
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

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("all");

  const { data, isLoading, isError } = useQuery<AnalyticsStats>({
    queryKey: ["/api/analytics/stats"],
    refetchInterval: 60000,
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
          <p className="text-sm text-muted-foreground mt-1">Live collection performance & insights</p>
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

      {isError && (
        <div className="text-xs text-plasma-red font-mono text-center py-2">
          Failed to load analytics data
        </div>
      )}

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
