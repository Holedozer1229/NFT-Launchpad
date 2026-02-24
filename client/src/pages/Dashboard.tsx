import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import {
  Activity, Cpu, Box, DollarSign, Clock,
  ChevronUp, ChevronDown, Loader2, Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MempoolStats {
  mempoolSize: number;
  mempoolVSize: number;
  totalFee: number;
  fees: {
    fastest: number;
    halfHour: number;
    hour: number;
    economy: number;
    minimum: number;
  };
  blockHeight: number;
}

interface DifficultyData {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
}

interface HashrateData {
  hashrates: Array<{ timestamp: number; avgHashrate: number }>;
  difficulty: Array<{ timestamp: number; difficulty: number }>;
  currentHashrate: number;
  currentDifficulty: number;
}

interface MinerData {
  id: number;
  walletAddress: string;
  hashRate: number;
  shards: number;
  lastUpdate: string | null;
}

interface StatCardProps {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
}

function StatCard({ label, value, change, icon, accent, loading }: StatCardProps) {
  const positive = change >= 0;
  return (
    <div className={`cosmic-card cosmic-card-${accent} p-5`} data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="stat-label">{label}</span>
          <div className="stat-value">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : value}
          </div>
        </div>
        <div className={`p-2 rounded-sm bg-neon-${accent}/10`}>{icon}</div>
      </div>
      <div className={`stat-change ${positive ? "positive" : "negative"} flex items-center gap-1 mt-2`}>
        {positive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}% from last epoch
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [uptimeSeconds, setUptimeSeconds] = useState(() => Math.floor((Date.now() - new Date().setHours(0, 0, 0, 0)) / 1000));

  const { data: mempoolStats, isLoading: statsLoading } = useQuery<MempoolStats>({
    queryKey: ["/api/mempool/stats"],
    refetchInterval: 30000,
  });

  const { data: difficultyData, isLoading: diffLoading } = useQuery<DifficultyData>({
    queryKey: ["/api/mempool/difficulty"],
    refetchInterval: 60000,
  });

  const { data: hashrateData, isLoading: hashrateLoading } = useQuery<HashrateData>({
    queryKey: ["/api/mempool/hashrate"],
    refetchInterval: 60000,
  });

  const { data: recentBlocks } = useQuery<any[]>({
    queryKey: ["/api/mempool/blocks"],
    refetchInterval: 30000,
  });

  const { data: miners, isLoading: minersLoading } = useQuery<MinerData[]>({
    queryKey: ["/api/miners/all"],
    queryFn: async () => {
      const addresses = ["miner-alpha", "miner-beta", "miner-gamma"];
      const results = await Promise.all(
        addresses.map(addr =>
          fetch(`/api/miners/${addr}`).then(r => r.ok ? r.json() : null)
        )
      );
      return results.filter(Boolean);
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const interval = setInterval(() => setUptimeSeconds(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = useCallback(() => {
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }, [uptimeSeconds]);

  const hashrateChartData = hashrateData?.hashrates?.slice(-24).map((h) => ({
    time: new Date(h.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    hashrate: h.avgHashrate / 1e18,
  })) || [];

  const blocksChartData = recentBlocks?.map((b: any) => ({
    time: new Date(b.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    txCount: b.tx_count || 0,
    size: ((b.size || 0) / 1e6).toFixed(2),
  })).reverse() || [];

  const currentHashrateEH = hashrateData?.currentHashrate
    ? (hashrateData.currentHashrate / 1e18).toFixed(1)
    : "—";

  const diffPercent = difficultyData?.progressPercent ?? 0;
  const remainingBlocks = difficultyData?.remainingBlocks ?? 0;
  const diffChange = difficultyData?.difficultyChange ?? 0;

  const retargetDate = difficultyData?.estimatedRetargetDate
    ? new Date(difficultyData.estimatedRetargetDate)
    : null;
  const retargetDaysLeft = retargetDate
    ? Math.max(0, Math.floor((retargetDate.getTime() - Date.now()) / 86400000))
    : 0;
  const retargetHoursLeft = retargetDate
    ? Math.max(0, Math.floor(((retargetDate.getTime() - Date.now()) % 86400000) / 3600000))
    : 0;

  return (
    <div className="space-y-6 p-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-widest neon-glow-cyan" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <span className="text-xs font-mono text-muted-foreground" data-testid="text-live-indicator">
          <Activity className="w-3 h-3 inline mr-1 text-neon-green animate-pulse" />
          LIVE — mempool.space
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Network Hashrate"
          value={`${currentHashrateEH} EH/s`}
          change={diffChange}
          icon={<Cpu className="w-5 h-5 text-neon-cyan" />}
          accent="cyan"
          loading={hashrateLoading}
        />
        <StatCard
          label="Block Height"
          value={mempoolStats?.blockHeight?.toLocaleString() || "—"}
          change={0.1}
          icon={<Box className="w-5 h-5 text-neon-green" />}
          accent="green"
          loading={statsLoading}
        />
        <StatCard
          label="Fastest Fee"
          value={mempoolStats ? `${mempoolStats.fees.fastest} sat/vB` : "—"}
          change={mempoolStats ? ((mempoolStats.fees.fastest - mempoolStats.fees.hour) / mempoolStats.fees.hour * 100) : 0}
          icon={<DollarSign className="w-5 h-5 text-neon-orange" />}
          accent="orange"
          loading={statsLoading}
        />
        <StatCard
          label="Uptime"
          value={formatUptime()}
          change={0}
          icon={<Clock className="w-5 h-5 text-neon-magenta" />}
          accent="magenta"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="cosmic-card cosmic-card-cyan p-5" data-testid="chart-hashrate">
          <h3 className="stat-label mb-4">Network Hashrate (EH/s) — Live from mempool.space</h3>
          <div className="h-[200px] sm:h-[250px]">
            {hashrateLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-neon-cyan" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hashrateChartData}>
                  <defs>
                    <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(185,100%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(185,100%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,20%,15%)" />
                  <XAxis dataKey="time" stroke="#555" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                  <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(220,25%,7%)", border: "1px solid hsl(185,100%,50%,0.3)", borderRadius: "4px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(185,100%,50%)" }}
                    formatter={(value: number) => [`${value.toFixed(2)} EH/s`, "Hashrate"]}
                  />
                  <Area type="monotone" dataKey="hashrate" stroke="hsl(185,100%,50%)" fill="url(#hashGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="cosmic-card cosmic-card-green p-5" data-testid="chart-blocks">
          <h3 className="stat-label mb-4">Recent Blocks — Transaction Count</h3>
          <div className="h-[200px] sm:h-[250px]">
            {!recentBlocks ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-neon-green" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={blocksChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,20%,15%)" />
                  <XAxis dataKey="time" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(220,25%,7%)", border: "1px solid hsl(145,100%,50%,0.3)", borderRadius: "4px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(145,100%,50%)" }}
                  />
                  <Bar dataKey="txCount" name="Transactions" fill="hsl(145,100%,50%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cosmic-card cosmic-card-orange p-5" data-testid="card-difficulty">
          <h3 className="stat-label mb-4">Difficulty Adjustment Progress</h3>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(210,20%,15%)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="hsl(30,100%,55%)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${diffPercent * 3.27} 327`}
                  style={{ filter: "drop-shadow(0 0 6px hsl(30,100%,55%,0.5))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading font-bold text-lg text-neon-orange">{diffPercent.toFixed(1)}%</span>
                <span className="text-[10px] text-muted-foreground font-mono">{remainingBlocks} blocks left</span>
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] font-mono text-muted-foreground mt-2">
            Est. change: <span className={diffChange >= 0 ? "text-neon-green" : "text-red-400"}>{diffChange >= 0 ? "+" : ""}{diffChange.toFixed(2)}%</span>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-magenta p-5" data-testid="card-retarget">
          <h3 className="stat-label mb-4">Next Difficulty Retarget</h3>
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="text-center">
              <span className="font-heading font-bold text-2xl text-neon-magenta">{retargetDaysLeft}</span>
              <span className="block text-[10px] text-muted-foreground font-mono">DAYS</span>
            </div>
            <span className="text-muted-foreground text-lg">:</span>
            <div className="text-center">
              <span className="font-heading font-bold text-2xl text-neon-magenta">{retargetHoursLeft}</span>
              <span className="block text-[10px] text-muted-foreground font-mono">HRS</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${diffPercent}%`,
                  background: "linear-gradient(90deg, hsl(300,100%,60%), hsl(280,100%,60%))",
                  boxShadow: "0 0 10px hsl(300,100%,60%,0.5)",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
              <span>Epoch Start</span>
              <span>{diffPercent.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-cyan p-5" data-testid="card-mempool">
          <h3 className="stat-label mb-4">Mempool Status</h3>
          {statsLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-neon-cyan" /></div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Unconfirmed TXs</span>
                <span className="font-mono text-neon-cyan">{mempoolStats?.mempoolSize?.toLocaleString() || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mempool Size</span>
                <span className="font-mono">{mempoolStats?.mempoolVSize ? `${(mempoolStats.mempoolVSize / 1e6).toFixed(1)} MvB` : "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Fastest Fee</span>
                <span className="font-mono text-neon-green">{mempoolStats?.fees.fastest || "—"} sat/vB</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Half-Hour Fee</span>
                <span className="font-mono">{mempoolStats?.fees.halfHour || "—"} sat/vB</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Economy Fee</span>
                <span className="font-mono">{mempoolStats?.fees.economy || "—"} sat/vB</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Minimum Fee</span>
                <span className="font-mono">{mempoolStats?.fees.minimum || "—"} sat/vB</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="cosmic-card p-5" data-testid="table-miners">
        <h3 className="stat-label mb-4">Active Miners</h3>
        <div className="overflow-x-auto -mx-2 px-2">
          {minersLoading ? (
            <div className="flex items-center justify-center h-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : miners && miners.length > 0 ? (
            <table className="data-table min-w-[600px]">
              <thead>
                <tr>
                  <th>Miner ID</th>
                  <th>Status</th>
                  <th>Hashrate</th>
                  <th>Shards</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {miners.map((m) => (
                  <tr key={m.walletAddress} data-testid={`row-miner-${m.walletAddress}`}>
                    <td className="text-neon-cyan font-semibold">{m.walletAddress}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 ${m.hashRate > 0 ? "text-neon-green" : "text-muted-foreground"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.hashRate > 0 ? "bg-neon-green animate-pulse" : "bg-muted-foreground"}`} />
                        {m.hashRate > 0 ? "online" : "idle"}
                      </span>
                    </td>
                    <td>{m.hashRate} H/s</td>
                    <td>{m.shards}</td>
                    <td className="text-muted-foreground">{m.lastUpdate ? new Date(m.lastUpdate).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No miners registered yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
