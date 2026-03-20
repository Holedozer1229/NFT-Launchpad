import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import {
  Activity, Cpu, Box, DollarSign, Clock,
  ChevronUp, ChevronDown, Loader2, Zap, Brain, Pickaxe, Shield, TrendingUp, AlertCircle, RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ResonanceDrop } from "@/components/ResonanceDrop";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

function StatCard({ label, value, change, icon, accent, loading, error, onRetry, index = 0 }: StatCardProps & { error?: boolean, onRetry?: () => void, index?: number }) {
  const positive = change >= 0;

  if (error) {
    return (
      <div 
        className={`cosmic-card cosmic-card-red p-5 page-enter`} 
        style={{ animationDelay: `${index * 100}ms` }}
        data-testid={`stat-card-error-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <div className="flex flex-col items-center justify-center space-y-3 h-full min-h-[100px]">
          <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
          <span className="text-xs font-mono text-destructive tracking-wider uppercase">Failed to load {label}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRetry}
            className="h-7 text-[10px] hover:bg-destructive/10 text-destructive border border-destructive/20"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> RETRY
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`cosmic-card cosmic-card-${accent} p-5 page-enter`} 
      style={{ animationDelay: `${index * 100}ms` }}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <span className="stat-label">{label}</span>
          <div className="stat-value">
            {loading ? (
              <Skeleton className="h-8 w-24 skeleton-shimmer bg-white/5" />
            ) : value}
          </div>
        </div>
        <div className={`p-2 rounded-sm bg-neon-${accent}/10 ml-2`}>{icon}</div>
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

  const { data: mempoolStats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery<MempoolStats>({
    queryKey: ["/api/mempool/stats"],
    refetchInterval: 30000,
  });

  const { data: difficultyData, isLoading: diffLoading, isError: diffError, refetch: refetchDiff } = useQuery<DifficultyData>({
    queryKey: ["/api/mempool/difficulty"],
    refetchInterval: 60000,
  });

  const { data: hashrateData, isLoading: hashrateLoading, isError: hashrateError, refetch: refetchHashrate } = useQuery<HashrateData>({
    queryKey: ["/api/mempool/hashrate"],
    refetchInterval: 60000,
  });

  const { data: recentBlocks, isError: blocksError, refetch: refetchBlocks } = useQuery<any[]>({
    queryKey: ["/api/mempool/blocks"],
    refetchInterval: 30000,
  });

  const { data: miners, isLoading: minersLoading } = useQuery<MinerData[]>({
    queryKey: ["/api/miners/all"],
    refetchInterval: 15000,
  });

  const { data: iitData } = useQuery<{ phi: number; level: string; networkNodes: number }>({
    queryKey: ["/api/iit/status"],
    refetchInterval: 30000,
  });

  const { data: treasuryData } = useQuery<{ totalFees: number; totalYieldGenerated: number; currentApr: number; strategies: any[] }>({
    queryKey: ["/api/treasury/yield"],
    refetchInterval: 60000,
  });

  const { data: miningNetwork } = useQuery<{ activeMiners: number }>({
    queryKey: ["/api/mining/network"],
    refetchInterval: 30000,
  });

  const { data: resonanceData } = useQuery<{ status: string; currentFrequency: number; phiValue: number }>({
    queryKey: ["/api/resonance/status"],
    refetchInterval: 15000,
  });

  useEffect(() => {
    const interval = setInterval(() => setUptimeSeconds(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = useCallback(() => {
    const days = Math.floor(uptimeSeconds / 86400);
    const h = Math.floor((uptimeSeconds % 86400) / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (h > 0 || days > 0) parts.push(`${h}h`);
    parts.push(`${m.toString().padStart(2, "0")}m`);
    
    return parts.join(" ");
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
    <div className="space-y-6 p-2 sm:p-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-heading tracking-widest neon-glow-cyan" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <span className="text-[10px] sm:text-xs font-mono text-muted-foreground" data-testid="text-live-indicator">
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
          error={hashrateError}
          onRetry={() => refetchHashrate()}
          index={0}
        />
        <StatCard
          label="Block Height"
          value={mempoolStats?.blockHeight?.toLocaleString() || "—"}
          change={0.1}
          icon={<Box className="w-5 h-5 text-neon-green" />}
          accent="green"
          loading={statsLoading}
          error={statsError}
          onRetry={() => refetchStats()}
          index={1}
        />
        <StatCard
          label="Fastest Fee"
          value={mempoolStats ? `${mempoolStats.fees.fastest} sat/vB` : "—"}
          change={mempoolStats ? ((mempoolStats.fees.fastest - (mempoolStats.fees.hour || 1)) / (mempoolStats.fees.hour || 1) * 100) : 0}
          icon={<DollarSign className="w-5 h-5 text-neon-orange" />}
          accent="orange"
          loading={statsLoading}
          error={statsError}
          onRetry={() => refetchStats()}
          index={2}
        />
        <StatCard
          label="Uptime"
          value={formatUptime()}
          change={0}
          icon={<Clock className="w-5 h-5 text-neon-magenta" />}
          accent="magenta"
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="skynt-protocol-stats">
        <div className="cosmic-card-glow p-4 page-enter" style={{ animationDelay: '400ms' }} data-testid="stat-iit-phi">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-neon-magenta" />
            <span className="stat-label">IIT Φ Score</span>
          </div>
          <div className="font-heading font-bold text-xl text-neon-magenta">
            {iitData?.phi?.toFixed(4) ?? "—"}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            Level: <span className="text-neon-cyan">{iitData?.level ?? "—"}</span>
          </div>
        </div>

        <div className="cosmic-card-glow p-4 page-enter" style={{ animationDelay: '500ms' }} data-testid="stat-treasury-yield">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-neon-green" />
            <span className="stat-label">Treasury Yield</span>
          </div>
          <div className="font-heading font-bold text-xl text-neon-green">
            {(treasuryData?.totalYieldGenerated ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs">SKYNT</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            APR: <span className="text-neon-orange">{treasuryData?.currentApr?.toFixed(1) ?? "—"}%</span>
          </div>
        </div>

        <div className="cosmic-card-glow p-4 page-enter" style={{ animationDelay: '600ms' }} data-testid="stat-mining-network">
          <div className="flex items-center gap-2 mb-2">
            <Pickaxe className="w-4 h-4 text-neon-orange" />
            <span className="stat-label">Mining Network</span>
          </div>
          <div className="font-heading font-bold text-xl text-neon-orange">
            {(miningNetwork?.activeMiners ?? 0).toLocaleString()} <span className="text-xs">active</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            Fees collected: <span className="text-neon-cyan">{(treasuryData?.totalFees ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SKYNT</span>
          </div>
        </div>

        <div className="cosmic-card-glow p-4 page-enter" style={{ animationDelay: '700ms' }} data-testid="stat-resonance">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-neon-cyan" />
            <span className="stat-label">Resonance</span>
          </div>
          <div className="font-heading font-bold text-xl text-neon-cyan">
            {resonanceData?.currentFrequency?.toFixed(2) ?? "7.83"} <span className="text-xs">Hz</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            Status: <span className={resonanceData?.status === "RESONANCE_ACTIVE" ? "text-neon-green" : "text-muted-foreground"}>
              {resonanceData?.status?.replace(/_/g, " ") ?? "DORMANT"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResonanceDrop />
        <div className="cosmic-card cosmic-card-cyan p-5 page-enter" style={{ animationDelay: '800ms' }} data-testid="chart-hashrate">
          <h3 className="stat-label mb-4">Network Hashrate (EH/s) — Live from mempool.space</h3>
          <div className="h-[200px] sm:h-[250px]">
            {hashrateLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Skeleton className="h-full w-full skeleton-shimmer bg-white/5" />
              </div>
            ) : hashrateError ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
                <span className="text-xs font-mono text-destructive">FAILED TO LOAD HASHRATE DATA</span>
                <Button variant="ghost" size="sm" onClick={() => refetchHashrate()} className="h-7 text-[10px] border border-destructive/20 text-destructive">
                  RETRY
                </Button>
              </div>
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

        <div className="cosmic-card cosmic-card-green p-5 page-enter" style={{ animationDelay: '900ms' }} data-testid="chart-blocks">
          <h3 className="stat-label mb-4">Recent Blocks — Transaction Count</h3>
          <div className="h-[200px] sm:h-[250px]">
            {!recentBlocks && !blocksError ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Skeleton className="h-full w-full skeleton-shimmer bg-white/5" />
              </div>
            ) : blocksError ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
                <span className="text-xs font-mono text-destructive">FAILED TO LOAD BLOCK DATA</span>
                <Button variant="ghost" size="sm" onClick={() => refetchBlocks()} className="h-7 text-[10px] border border-destructive/20 text-destructive">
                  RETRY
                </Button>
              </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="cosmic-card cosmic-card-orange p-5 page-enter" style={{ animationDelay: '1000ms' }} data-testid="card-difficulty">
          <h3 className="stat-label mb-4">Difficulty Adjustment Progress</h3>
          {diffLoading ? (
            <div className="flex items-center justify-center py-4">
              <Skeleton className="w-32 h-32 rounded-full skeleton-shimmer bg-white/5" />
            </div>
          ) : diffError ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
                <Button variant="ghost" size="sm" onClick={() => refetchDiff()} className="h-7 text-[10px] border border-destructive/20 text-destructive">
                  RETRY
                </Button>
              </div>
          ) : (
            <>
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
                    <span className="text-[10px] text-muted-foreground font-mono">{remainingBlocks.toLocaleString()} blocks left</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-[10px] font-mono text-muted-foreground mt-2">
                Est. change: <span className={diffChange >= 0 ? "text-neon-green" : "text-red-400"}>{diffChange >= 0 ? "+" : ""}{diffChange.toFixed(2)}%</span>
              </div>
            </>
          )}
        </div>

        <div className="cosmic-card cosmic-card-magenta p-5 page-enter" style={{ animationDelay: '1100ms' }} data-testid="card-retarget">
          <h3 className="stat-label mb-4">Next Difficulty Retarget</h3>
          {diffLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full skeleton-shimmer bg-white/5" />
              <Skeleton className="h-4 w-full skeleton-shimmer bg-white/5" />
            </div>
          ) : diffError ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
                <Button variant="ghost" size="sm" onClick={() => refetchDiff()} className="h-7 text-[10px] border border-destructive/20 text-destructive">
                  RETRY
                </Button>
              </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="cosmic-card cosmic-card-cyan p-5 page-enter" style={{ animationDelay: '1200ms' }} data-testid="card-mempool">
          <h3 className="stat-label mb-4">Mempool Status</h3>
          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-4 w-full skeleton-shimmer bg-white/5" />)}
            </div>
          ) : statsError ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
                <Button variant="ghost" size="sm" onClick={() => refetchStats()} className="h-7 text-[10px] border border-destructive/20 text-destructive">
                  RETRY
                </Button>
              </div>
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
            <table className="data-table min-w-[480px]">
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
                    <td className="text-neon-cyan font-semibold">
                      <span className="hidden sm:inline">{m.walletAddress}</span>
                      <span className="inline sm:hidden">{m.walletAddress.slice(0, 6)}...{m.walletAddress.slice(-4)}</span>
                    </td>
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
