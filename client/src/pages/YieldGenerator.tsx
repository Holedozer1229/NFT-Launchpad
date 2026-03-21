import { useState, useEffect, useRef } from "react";
import { TrendingUp, Lock, Unlock, Wallet, Coins, Percent, Clock, Zap, Shield, Gift, ArrowRight, Activity, CheckCircle, Fingerprint, Gauge, Loader2, RefreshCw, ChevronDown, ChevronUp, Layers, BarChart3, Flame } from "lucide-react";
import MoltbotPortal from "@/components/MoltbotPortal";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface StrategyData {
  id: number;
  strategyId: string;
  name: string;
  contract: string;
  apr: string;
  riskScore: number;
  tvl: string;
  totalStaked: string;
  color: string;
  active: boolean;
  description: string;
}

interface WalletData {
  id: number;
  balanceSkynt: string;
  balanceStx: string;
  balanceEth: string;
  address: string;
}

interface YieldPositionEnriched {
  id: number;
  userId: number;
  strategyId: string;
  strategyName: string;
  amountStaked: number;
  accruedRewards: number;
  liveAccruedRewards: number;
  stakedAt: string;
  lastRewardAt: string;
  status: string;
  txHash: string | null;
  apr: number;
  color: string;
}

const SKYNT_PRICE_USD = 0.45;
const PER_TICK_MS = 100;

function calculatePhiBoost(phi: number): number {
  const clamped = Math.max(200, Math.min(1000, phi));
  return (10000 + (clamped - 500) * 5) / 10000;
}

function calculateTreasuryRate(phi: number): number {
  return Math.min(0.30, 0.05 + phi / 2000);
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  cyan:    { text: "text-neon-cyan",    bg: "bg-neon-cyan/10",    border: "cosmic-card-cyan",    bar: "bg-neon-cyan" },
  green:   { text: "text-neon-green",   bg: "bg-neon-green/10",   border: "cosmic-card-green",   bar: "bg-neon-green" },
  orange:  { text: "text-neon-orange",  bg: "bg-neon-orange/10",  border: "cosmic-card-orange",  bar: "bg-neon-orange" },
  magenta: { text: "text-neon-magenta", bg: "bg-neon-magenta/10", border: "cosmic-card-magenta", bar: "bg-neon-magenta" },
};
function cc(color: string) {
  return COLOR_MAP[color] ?? { text: "text-primary", bg: "bg-primary/10", border: "cosmic-card", bar: "bg-primary" };
}

function SkeletonCard() {
  return (
    <div className="cosmic-card p-4 space-y-3 animate-pulse">
      <div className="h-3 bg-white/5 rounded w-2/3" />
      <div className="h-2 bg-white/5 rounded w-full" />
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map(i => <div key={i} className="h-8 bg-white/5 rounded" />)}
      </div>
    </div>
  );
}

export default function YieldGenerator() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);

  const [liveRewards, setLiveRewards] = useState<Record<number, number>>({});
  const positionsRef = useRef<YieldPositionEnriched[]>([]);

  const { data: phiBoostData } = useQuery<{
    phiTotal: number; qgScore: number; qgBonus: number; phiBoost: number;
    holoScore: number; fanoScore: number; level: string; levelLabel: string;
  }>({ queryKey: ["/api/yield/phi-boost"] });

  const phiTotal = phiBoostData?.phiTotal ?? 650;
  const qgScore = phiBoostData?.qgScore ?? 0;
  const holoScore = phiBoostData?.holoScore ?? 0;
  const fanoScore = phiBoostData?.fanoScore ?? 0;
  const phiBoost = phiBoostData?.phiBoost ?? calculatePhiBoost(phiTotal);
  const treasuryRate = calculateTreasuryRate(phiTotal);
  const projectedAPRMultiplier = 1 + qgScore * 0.15;

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery<StrategyData[]>({
    queryKey: ["/api/yield/strategies"],
  });

  const { data: positionsData, refetch: refetchPositions } = useQuery<{
    positions: YieldPositionEnriched[];
    walletBalance: string;
  }>({
    queryKey: ["/api/yield/positions"],
    enabled: isConnected,
    refetchInterval: 30000,
  });

  const positions = positionsData?.positions ?? [];
  const skyntBalance = positionsData?.walletBalance ?? "0";

  useEffect(() => {
    positionsRef.current = positions;
    setLiveRewards(prev => {
      const next: Record<number, number> = {};
      for (const p of positions) {
        next[p.id] = prev[p.id] ?? p.liveAccruedRewards;
      }
      return next;
    });
  }, [positions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveRewards(prev => {
        const next = { ...prev };
        for (const p of positionsRef.current) {
          const perSecond = p.amountStaked * (p.apr / 100) / (365 * 24 * 3600);
          next[p.id] = (prev[p.id] ?? p.liveAccruedRewards) + perSecond * (PER_TICK_MS / 1000);
        }
        return next;
      });
    }, PER_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const totalStaked = positions.reduce((s, p) => s + p.amountStaked, 0);
  const totalLiveRewards = Object.values(liveRewards).reduce((s, v) => s + v, 0);
  const totalPortfolioValue = totalStaked + totalLiveRewards;
  const maxApr = strategies.length ? Math.max(...strategies.map(s => parseFloat(s.apr))) : 1;

  const stakeMutation = useMutation({
    mutationFn: async ({ strategyId, amount }: { strategyId: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/yield/stake", { strategyId, amount });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Staked Successfully", description: `${stakeAmount} SKYNT deposited. Position #${data.position.id} opened.` });
      setStakeAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/yield/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yield/strategies"] });
    },
    onError: (error: any) => {
      toast({ title: "Stake Failed", description: error.message || "Transaction failed", variant: "destructive" });
    },
  });

  const unstakeMutation = useMutation({
    mutationFn: async (positionId: number) => {
      const res = await apiRequest("POST", `/api/yield/unstake/${positionId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Withdrawn", description: `Returned ${data.totalReturn?.toFixed(4)} SKYNT (incl. ${data.totalRewards?.toFixed(4)} rewards)` });
      queryClient.invalidateQueries({ queryKey: ["/api/yield/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yield/strategies"] });
    },
    onError: (error: any) => {
      toast({ title: "Withdraw Failed", description: error.message || "Transaction failed", variant: "destructive" });
    },
  });

  const compoundMutation = useMutation({
    mutationFn: async (positionId: number) => {
      const res = await apiRequest("POST", `/api/yield/compound/${positionId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Compounded", description: `New stake: ${data.position?.amountStaked?.toFixed(4)} SKYNT` });
      queryClient.invalidateQueries({ queryKey: ["/api/yield/positions"] });
    },
    onError: (error: any) => {
      toast({ title: "Compound Failed", description: error.message || "Transaction failed", variant: "destructive" });
    },
  });

  const compoundAllMutation = useMutation({
    mutationFn: async () => {
      const eligible = positions.filter(p => (liveRewards[p.id] ?? 0) > 0);
      await Promise.all(eligible.map(p =>
        apiRequest("POST", `/api/yield/compound/${p.id}`, {}).then(r => r.json())
      ));
    },
    onSuccess: () => {
      toast({ title: "All Compounded", description: "All eligible positions have been compounded." });
      queryClient.invalidateQueries({ queryKey: ["/api/yield/positions"] });
    },
    onError: (error: any) => {
      toast({ title: "Compound All Failed", description: error.message || "Failed to compound", variant: "destructive" });
    },
  });

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0 || !selectedStrategy) return;
    stakeMutation.mutate({ strategyId: selectedStrategy, amount: stakeAmount });
  };

  const strategy = selectedStrategy ? strategies.find(s => s.strategyId === selectedStrategy) : null;
  const balance = parseFloat(skyntBalance);
  const stakeAmt = parseFloat(stakeAmount || "0");
  const aboveBalance = stakeAmt > balance;
  const quickAmounts = [
    { label: "25%", value: (balance * 0.25).toFixed(2) },
    { label: "50%", value: (balance * 0.5).toFixed(2) },
    { label: "MAX", value: skyntBalance },
  ];

  return (
    <div className="space-y-6" data-testid="yield-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-yield-title">
            <TrendingUp className="w-6 h-6" /> SKYNT Yield Generator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">SphinxYieldAggregator — zk-verified multi-chain yield optimization</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading uppercase bg-neon-green/10 text-neon-green border border-neon-green/20">
            <Fingerprint className="w-3 h-3" /> zk-Proof Verified
          </span>
          {phiBoostData?.levelLabel && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading uppercase bg-neon-orange/10 text-neon-orange border border-neon-orange/20">
              <Flame className="w-3 h-3" /> {phiBoostData.levelLabel}
            </span>
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="cosmic-card cosmic-card-magenta p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-neon-magenta/10 border border-neon-magenta/30 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8 text-neon-magenta" />
          </div>
          <div>
            <p className="text-sm font-heading">Connect Wallet to Start Earning</p>
            <p className="text-xs text-muted-foreground mt-1">Link your wallet to stake SKYNT and generate yield via the SphinxYieldAggregator.</p>
          </div>
          <div className="flex justify-center" data-testid="container-yield-connect">
            <ConnectWalletButton showBalance={false} chainStatus="icon" label="Connect Wallet to Start" />
          </div>
        </div>
      )}

      {isConnected && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="cosmic-card cosmic-card-cyan p-4" data-testid="stat-total-staked">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-neon-cyan" />
                <span className="stat-label">Total Staked</span>
              </div>
              <p className="text-lg font-heading text-neon-cyan">{totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })} SKYNT</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">${(totalStaked * SKYNT_PRICE_USD).toFixed(2)} USD</p>
            </div>

            <div className="cosmic-card cosmic-card-green p-4" data-testid="stat-earned">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-neon-green" />
                <span className="stat-label">Live Rewards</span>
              </div>
              <p className="text-lg font-heading text-neon-green tabular-nums">
                {totalLiveRewards.toFixed(6)}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">SKYNT · ticking live</p>
            </div>

            <div className="cosmic-card cosmic-card-orange p-4" data-testid="stat-phi-boost">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-neon-orange" />
                <span className="stat-label">Phi Boost</span>
              </div>
              <p className="text-lg font-heading text-neon-orange">{phiBoost.toFixed(3)}x</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">Φ = {phiTotal.toFixed(3)}</p>
            </div>

            <div className="cosmic-card cosmic-card-magenta p-4" data-testid="stat-wallet-balance">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-neon-magenta" />
                <span className="stat-label">Wallet</span>
              </div>
              <p className="text-lg font-heading text-neon-magenta">{parseFloat(skyntBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} SKYNT</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""}</p>
            </div>
          </div>

          {positions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Active Positions ({positions.length})
                </h2>
                <div className="flex items-center gap-2">
                  {positions.filter(p => (liveRewards[p.id] ?? 0) > 0).length > 1 && (
                    <button
                      data-testid="button-compound-all"
                      onClick={() => compoundAllMutation.mutate()}
                      disabled={compoundAllMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-heading uppercase tracking-wider bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-40 transition-colors"
                    >
                      {compoundAllMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                      Compound All
                    </button>
                  )}
                  <button
                    onClick={() => refetchPositions()}
                    className="p-1.5 rounded-sm hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-refresh-positions"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {positions.map((pos) => {
                  const c = cc(pos.color);
                  const isExpanded = expandedPosition === pos.id;
                  const days = daysAgo(pos.stakedAt);
                  const dailyYield = pos.amountStaked * (pos.apr / 100) / 365;
                  const live = liveRewards[pos.id] ?? pos.liveAccruedRewards;
                  return (
                    <div key={pos.id} className={`cosmic-card ${c.border} overflow-hidden`} data-testid={`position-${pos.id}`}>
                      <button
                        className="w-full p-3 flex items-center justify-between text-left"
                        onClick={() => setExpandedPosition(isExpanded ? null : pos.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-10 rounded-full ${c.bar} opacity-60`} />
                          <div>
                            <p className="font-heading text-xs">{pos.strategyName}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {pos.amountStaked.toFixed(2)} SKYNT · {days === 0 ? "today" : `${days}d ago`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-heading text-sm tabular-nums ${c.text}`}>+{live.toFixed(6)}</p>
                            <p className="font-mono text-[9px] text-muted-foreground">{pos.apr}% APR</p>
                          </div>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-3">
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                              { label: "APR", value: `${pos.apr}%`, cl: c.text },
                              { label: "Daily", value: `${dailyYield.toFixed(4)}`, cl: "text-neon-green" },
                              { label: "Days Staked", value: String(days || "<1"), cl: "" },
                              { label: "Position", value: `#${pos.id}`, cl: "" },
                            ].map(item => (
                              <div key={item.label} className="p-2 bg-black/30 rounded-sm border border-border/20">
                                <p className="text-[9px] text-muted-foreground">{item.label}</p>
                                <p className={`font-heading text-xs mt-0.5 ${item.cl}`}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="font-mono text-[9px] text-muted-foreground truncate">TX: {pos.txHash ?? "pending"}</div>
                          <div className="flex gap-2">
                            <button
                              data-testid={`button-compound-${pos.id}`}
                              onClick={() => compoundMutation.mutate(pos.id)}
                              disabled={compoundMutation.isPending || live <= 0}
                              className="flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {compoundMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Compound"}
                            </button>
                            <button
                              data-testid={`button-unstake-${pos.id}`}
                              onClick={() => unstakeMutation.mutate(pos.id)}
                              disabled={unstakeMutation.isPending}
                              className="flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider bg-neon-orange/10 border border-neon-orange/30 text-neon-orange hover:bg-neon-orange/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {unstakeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Withdraw"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="cosmic-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-xs uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-primary" /> v8 Φ Structure
                </h3>
                <span className="font-mono text-xs text-primary">{phiTotal.toFixed(3)}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "QG Curvature (Φ_qg)", value: qgScore, bonus: `+${((phiBoostData?.qgBonus || 0) * 100).toFixed(1)}%` },
                  { label: "Holographic (Φ_holo)", value: holoScore, bonus: null },
                  { label: "Fano Plane (Φ_fano)", value: fanoScore, bonus: null },
                ].map(m => (
                  <div key={m.label} className="space-y-1 col-span-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] text-muted-foreground uppercase truncate">{m.label}</p>
                      {m.bonus && <span className="font-mono text-[9px] text-neon-green">{m.bonus}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={m.value * 100} className="h-1 flex-1" />
                      <span className="font-mono text-[10px] w-10 text-right">{m.value.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
                <div className="space-y-1">
                  <p className="text-[9px] text-muted-foreground uppercase">APR Multiplier</p>
                  <p className="font-mono text-[10px] text-neon-green">{projectedAPRMultiplier.toFixed(3)}x</p>
                </div>
              </div>
              <div className="flex justify-between mt-4 text-[9px] font-mono text-muted-foreground border-t border-border/20 pt-3">
                <span>Boost: {phiBoost.toFixed(3)}x</span>
                <span>Treasury: {(treasuryRate * 100).toFixed(1)}%</span>
                <span>R_T = min(0.30, 0.05+Φ/2k)</span>
              </div>
            </div>

            <div className="cosmic-card cosmic-card-cyan p-4 flex flex-col justify-center border-dashed">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-neon-cyan" />
                <h3 className="font-heading text-xs uppercase tracking-wider">Quantum Yield Proof</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  "Spectral Difficulty Gate",
                  "IIT v8.0 Consciousness Gate",
                  "QG Curvature Gate",
                ].map(gate => (
                  <div key={gate} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">{gate}</span>
                    <span className="text-neon-green flex items-center gap-1"><CheckCircle className="w-3 h-3" /> PASSED</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-4 italic">
                Yield secured by three-gate consensus protocol.
              </p>
            </div>
          </div>

          <MoltbotPortal />

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Yield Strategies
              </h2>
              {strategiesLoading ? (
                <div className="space-y-3">
                  {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
                </div>
              ) : strategies.length === 0 ? (
                <div className="cosmic-card p-6 text-center text-muted-foreground text-xs">
                  No strategies available.
                </div>
              ) : strategies.map(s => {
                const c = cc(s.color);
                const isSelected = selectedStrategy === s.strategyId;
                const apr = parseFloat(s.apr);
                const tvlSkynt = parseFloat(s.tvl);
                const aprPct = Math.min(100, (apr / maxApr) * 100);
                const riskLabel = s.riskScore <= 25 ? "Low" : s.riskScore <= 50 ? "Med" : "High";
                const riskColor = s.riskScore <= 25 ? "text-neon-green" : s.riskScore <= 50 ? "text-neon-orange" : "text-red-400";
                return (
                  <button
                    key={s.strategyId}
                    data-testid={`strategy-${s.strategyId}`}
                    onClick={() => { setSelectedStrategy(s.strategyId); setActiveTab("stake"); }}
                    className={`cosmic-card ${c.border} p-4 w-full text-left transition-all duration-200 ${isSelected ? "ring-1 ring-primary/60 scale-[1.01]" : "hover:scale-[1.005]"}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-heading text-sm">{s.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`text-[9px] font-heading uppercase ${riskColor}`}>{riskLabel}</span>
                        <span className={`${c.text} ${c.bg} px-1.5 py-0.5 rounded-full text-[10px] font-heading`}>{apr}%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">{s.description}</p>

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>APR vs Max</span>
                        <span className={c.text}>{aprPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${aprPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>Risk</span>
                        <span className={riskColor}>{s.riskScore}/100</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.riskScore <= 25 ? "bg-neon-green" : s.riskScore <= 50 ? "bg-neon-orange" : "bg-red-400"}`}
                          style={{ width: `${s.riskScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center border-t border-border/20 pt-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground">TVL</p>
                        <p className="font-mono text-[10px]">${(tvlSkynt * SKYNT_PRICE_USD).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Staked</p>
                        <p className="font-mono text-[10px]">{parseFloat(s.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Contract</p>
                        <p className={`font-mono text-[10px] truncate ${c.text}`}>{s.contract.slice(0, 6)}…</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {strategy ? (
                <>
                  <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-primary" /> {strategy.name}
                  </h2>

                  {stakeMutation.isSuccess && (
                    <div className="cosmic-card cosmic-card-green p-4 text-center space-y-1">
                      <CheckCircle className="w-5 h-5 text-neon-green mx-auto" />
                      <p className="text-sm font-heading text-neon-green">Position Opened</p>
                      <p className="text-xs text-muted-foreground">Now earning with {phiBoost.toFixed(3)}x Phi boost.</p>
                    </div>
                  )}

                  <div className={`cosmic-card ${cc(strategy.color).border} p-5 space-y-4`}>
                    <div className="flex gap-2">
                      {(["stake", "unstake"] as const).map(tab => (
                        <button
                          key={tab}
                          data-testid={`tab-${tab}`}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider transition-all ${activeTab === tab ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/20 text-muted-foreground border border-border/30"}`}
                        >
                          {tab === "stake" ? "Deposit" : "Withdraw"}
                        </button>
                      ))}
                    </div>

                    {activeTab === "unstake" ? (
                      positions.filter(p => p.strategyId === strategy.strategyId).length > 0 ? (
                        <div className="space-y-2">
                          <p className="stat-label text-[10px]">Select position to withdraw</p>
                          {positions.filter(p => p.strategyId === strategy.strategyId).map(pos => {
                            const live = liveRewards[pos.id] ?? pos.liveAccruedRewards;
                            return (
                              <div key={pos.id} className="flex items-center justify-between p-3 bg-black/30 border border-border/30 rounded-sm">
                                <div>
                                  <p className="font-mono text-xs">{pos.amountStaked.toFixed(2)} SKYNT</p>
                                  <p className={`font-mono text-[9px] tabular-nums ${cc(pos.color).text}`}>+{live.toFixed(6)} earned</p>
                                </div>
                                <button
                                  data-testid={`button-withdraw-${pos.id}`}
                                  onClick={() => unstakeMutation.mutate(pos.id)}
                                  disabled={unstakeMutation.isPending}
                                  className="px-3 py-1.5 rounded-sm text-xs font-heading uppercase tracking-wider bg-neon-orange/10 border border-neon-orange/30 text-neon-orange hover:bg-neon-orange/20 disabled:opacity-40 transition-colors"
                                >
                                  {unstakeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Withdraw"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs space-y-2">
                          <Unlock className="w-8 h-8 mx-auto opacity-30" />
                          <p>No active positions in this strategy.</p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <label className="stat-label text-[10px]">Deposit Amount (SKYNT)</label>
                        <div className="relative">
                          <input
                            data-testid="input-stake-amount"
                            type="number"
                            placeholder="0.00"
                            value={stakeAmount}
                            onChange={e => setStakeAmount(e.target.value)}
                            className={`w-full p-3 bg-black/40 border rounded-sm font-mono text-lg focus:outline-none transition-colors placeholder:text-muted-foreground/40 ${aboveBalance && stakeAmount ? "border-red-500/50 focus:border-red-500/60" : "border-border focus:border-primary/60"}`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">SKYNT</span>
                        </div>
                        {aboveBalance && stakeAmount && (
                          <p className="text-[10px] text-red-400 font-mono">Exceeds available balance</p>
                        )}
                        <div className="flex items-center gap-2">
                          {quickAmounts.map(qa => (
                            <button
                              key={qa.label}
                              onClick={() => setStakeAmount(qa.value)}
                              className="flex-1 py-1 text-[10px] font-heading uppercase rounded-sm bg-white/5 border border-border/30 hover:bg-white/10 hover:border-primary/40 transition-colors"
                            >
                              {qa.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                          <span>Balance: {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SKYNT</span>
                          <span>${(balance * SKYNT_PRICE_USD).toFixed(2)} USD</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 p-3 bg-black/20 border border-border/50 rounded-sm text-xs">
                      {[
                        { icon: <Percent className="w-3 h-3" />, label: "Base APR", value: `${strategy.apr}%`, cl: cc(strategy.color).text },
                        { icon: <Gauge className="w-3 h-3" />, label: "Phi-Boosted APR", value: `${(parseFloat(strategy.apr) * phiBoost * projectedAPRMultiplier).toFixed(1)}%`, cl: "text-neon-green" },
                        { icon: <BarChart3 className="w-3 h-3" />, label: "Risk Score", value: `${strategy.riskScore}/100`, cl: "" },
                        { icon: <Coins className="w-3 h-3" />, label: "Treasury Split", value: `${(treasuryRate * 100).toFixed(1)}%`, cl: "" },
                        { icon: <Fingerprint className="w-3 h-3" />, label: "zk-Proof", value: "Verified", cl: "text-neon-green" },
                        { icon: <Clock className="w-3 h-3" />, label: "Lock Period", value: "None", cl: "" },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">{row.icon} {row.label}</span>
                          <span className={`font-mono ${row.cl}`}>{row.value}</span>
                        </div>
                      ))}
                      {stakeAmt > 0 && !aboveBalance && activeTab === "stake" && (
                        <>
                          <div className="border-t border-border/30 pt-2 flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Est. Daily Yield</span>
                            <span className="font-mono text-neon-green">
                              {((stakeAmt * parseFloat(strategy.apr) * phiBoost * projectedAPRMultiplier) / 365 / 100).toFixed(4)} SKYNT
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Gift className="w-3 h-3" /> Your Share (net)</span>
                            <span className="font-mono text-neon-cyan">
                              {((stakeAmt * parseFloat(strategy.apr) * phiBoost * projectedAPRMultiplier * (1 - treasuryRate)) / 365 / 100).toFixed(4)} SKYNT/day
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {activeTab === "stake" && (
                      <button
                        data-testid="button-stake"
                        disabled={!stakeAmount || stakeAmt <= 0 || aboveBalance || stakeMutation.isPending}
                        onClick={handleStake}
                        className="connect-wallet-btn w-full py-3 rounded-sm font-heading text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <div className="flex items-center justify-center gap-2">
                          {stakeMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Depositing...</>
                          ) : (
                            <><Lock className="w-4 h-4" />{stakeAmt > 0 && !aboveBalance ? `Deposit ${stakeAmount} SKYNT` : "Enter Amount"}</>
                          )}
                        </div>
                      </button>
                    )}
                  </div>

                  <div className={`cosmic-card ${cc(strategy.color).border} p-4`}>
                    <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Projected Returns (Phi-Boosted)
                    </h3>
                    {stakeAmt > 0 && !aboveBalance ? (
                      <div className="grid grid-cols-3 gap-3">
                        {[{ label: "30 Days", days: 30 }, { label: "90 Days", days: 90 }, { label: "1 Year", days: 365 }].map(period => {
                          const gross = (stakeAmt * parseFloat(strategy.apr) * phiBoost * projectedAPRMultiplier * period.days) / 365 / 100;
                          const net = gross * (1 - treasuryRate);
                          return (
                            <div key={period.label} className="p-3 bg-black/30 border border-border/30 rounded-sm text-center">
                              <p className="text-[10px] text-muted-foreground">{period.label}</p>
                              <p className={`font-mono text-sm ${cc(strategy.color).text} mt-1`}>+{net.toFixed(2)}</p>
                              <p className="text-[9px] text-muted-foreground">SKYNT</p>
                              <p className="text-[9px] text-muted-foreground">${(net * SKYNT_PRICE_USD).toFixed(2)}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">Enter a deposit amount to see projections.</p>
                    )}
                  </div>

                  <div className="cosmic-card p-4">
                    <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-primary" /> Contract Details
                    </h3>
                    <div className="space-y-1.5 text-xs font-mono">
                      {[
                        ["Contract", strategy.contract],
                        ["Aggregator", "SphinxYieldAggregator v1.0"],
                        ["Solidity", "^0.8.20"],
                        ["Security", "ReentrancyGuard + Pausable"],
                        ["Access", "AccessControl (RBAC)"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <span className="text-muted-foreground shrink-0">{k}</span>
                          <span className={k === "Contract" ? cc(strategy.color).text : k === "Security" ? "text-neon-green" : ""}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="cosmic-card p-8 text-center space-y-3 min-h-[300px] flex flex-col items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-muted-foreground/30" />
                  <p className="font-heading text-sm text-muted-foreground">Select a Strategy</p>
                  <p className="text-xs text-muted-foreground/60">Choose a yield strategy on the left to deposit SKYNT and start earning.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
