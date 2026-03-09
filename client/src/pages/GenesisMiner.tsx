import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Cpu, 
  Zap, 
  TrendingUp, 
  Coins, 
  Activity, 
  Hash, 
  Clock, 
  Users, 
  Power, 
  PowerOff, 
  Pickaxe, 
  Shield, 
  ChevronRight, 
  History, 
  Layers,
  Info,
  ArrowRight,
  Droplets,
  ZapOff,
  Flame,
  Terminal,
  Trophy,
  Star,
  CheckCircle2,
  Lock,
  Crown,
  Radio,
  Wifi,
  AlertTriangle,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  MERGE_MINING_CHAINS, 
  RANDOMX_CONFIG, 
  STX_LENDING_TIERS,
  type MergeMiningChainId,
  type StxLendingTierId
} from "@shared/schema";
import { OracleOverlay } from "@/components/OracleOverlay";
import { type MiningStats, type MiningEvent, type MiningMilestone } from "../../../server/background-miner";

interface MergeMiningStats {
  isActive: boolean;
  hashRate: number;
  blocksFound: number;
  totalRewards: number;
  rewardsEarned: number;
  difficulty: number;
}

interface UserMergeMiningStatus {
  [chainId: string]: MergeMiningStats;
}

interface RandomXStats {
  isActive: boolean;
  hashRate: number;
  noncesChecked: number;
  blocksFound: number;
  btcEarned: number;
  difficulty: number;
}

interface StxLendingState {
  stakedAmount: number;
  tierId: StxLendingTierId | null;
  yieldEarned: number;
  startTime: number | null;
}

interface GenesisBlock {
  height: number;
  hash: string;
  timestamp: number;
  reward: number;
  supply: number;
  halving: number;
}

interface BlockRecord {
  height: number;
  hash: string;
  miner: string;
  reward: number;
  timestamp: number;
  algorithm: string;
}

interface MempoolStats {
  mempoolSize: number;
  mempoolVSize: number;
  totalFee: number;
  fees: { fastest: number; halfHour: number; hour: number; economy: number; minimum: number };
  blockHeight: number;
}

interface MempoolBlock {
  id: string;
  height: number;
  timestamp: number;
  size: number;
  weight: number;
  tx_count: number;
  difficulty: number;
}

interface MempoolDifficulty {
  progressPercent: number;
  difficultyChange: number;
  remainingBlocks: number;
  remainingTime: number;
}

interface MempoolHashrate {
  hashrates: Array<{ timestamp: number; avgHashrate: number }>;
}

interface LiveNotification {
  id: number;
  type: "block" | "fee" | "hashrate" | "difficulty" | "mining";
  message: string;
  timestamp: number;
  color: string;
}

const NEON_COLORS = {
  cyan: "#00f0ff",
  green: "#39ff14",
  magenta: "#ff00ff",
  gold: "#ffd700",
  orange: "#ff6b00",
  blue: "#4d7cff",
  purple: "#a855f7",
  red: "#ff3b3b",
};

const CHAIN_NEON_COLORS: Record<string, string> = {
  auxpow_btc: NEON_COLORS.gold,
  eth_merge: NEON_COLORS.blue,
  zk_rollup: NEON_COLORS.purple,
  stx_pox: NEON_COLORS.orange,
  btc_fork: NEON_COLORS.cyan,
};

function RandomXVisualization({ isActive }: { isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      frameRef.current++;
      const f = frameRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "rgba(5, 5, 15, 0.15)";
      ctx.fillRect(0, 0, w, h);

      const cols = 25;
      for (let i = 0; i < cols; i++) {
        const x = (i / cols) * w;
        const speed = 1.5 + Math.sin(i * 0.5) * 0.5;
        const y = ((f * speed + i * 23) % (h + 30)) - 15;
        const char = Math.floor(Math.random() * 16).toString(16).toUpperCase();
        
        if (isActive) {
          const hue = (f * 2 + i * 15) % 360;
          ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${0.3 + Math.random() * 0.6})`;
        } else {
          const hue = (f * 0.5 + i * 15) % 360;
          ctx.fillStyle = `hsla(${hue}, 60%, 50%, ${0.1 + Math.random() * 0.2})`;
        }
        ctx.font = "10px monospace";
        ctx.fillText(char, x, y);
      }

      if (f % 3 === 0) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 3, 0, Math.PI * 2);
        const hue = isActive ? (f * 3) % 360 : 200;
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${isActive ? 0.6 : 0.15})`;
        ctx.fill();
      }

      if (isActive && f % 10 === 0) {
        const x1 = Math.random() * w;
        const y1 = Math.random() * h;
        const x2 = Math.random() * w;
        const y2 = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsla(${(f * 5) % 360}, 100%, 60%, 0.15)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={100}
      className="w-full h-24 rounded border border-cyan-500/30"
      style={{ imageRendering: "pixelated" }}
      data-testid="randomx-visualization"
    />
  );
}

function LiveNotificationBanner({ notifications }: { notifications: LiveNotification[] }) {
  if (notifications.length === 0) return null;
  const latest = notifications[0];
  return (
    <div 
      className="flex items-center gap-3 px-4 py-2 rounded-lg border animate-pulse"
      style={{ 
        borderColor: `${latest.color}40`,
        backgroundColor: `${latest.color}08`,
      }}
    >
      <Bell className="w-4 h-4 shrink-0" style={{ color: latest.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono truncate" style={{ color: latest.color }}>
          {latest.message}
        </p>
      </div>
      <span className="text-[9px] font-mono text-muted-foreground shrink-0">
        {new Date(latest.timestamp).toLocaleTimeString([], { hour12: false })}
      </span>
    </div>
  );
}

function NeonStatCard({ icon: Icon, label, value, color, glow, pulse }: {
  icon: any;
  label: string;
  value: string;
  color: string;
  glow?: boolean;
  pulse?: boolean;
}) {
  return (
    <Card 
      className="relative overflow-hidden border transition-all duration-300"
      style={{
        borderColor: `${color}30`,
        backgroundColor: `${color}06`,
        boxShadow: glow ? `0 0 20px ${color}15, inset 0 0 20px ${color}05` : undefined,
      }}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${pulse ? 'animate-pulse' : ''}`} style={{ color }} />
          <span className="text-[10px] font-heading uppercase text-muted-foreground tracking-wider">{label}</span>
        </div>
        <p className="text-xl font-heading font-bold" style={{ color }}>
          {value}
        </p>
      </CardContent>
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ backgroundColor: `${color}10` }} />
    </Card>
  );
}

export default function GenesisMiner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("mining");
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const notifIdRef = useRef(0);
  const prevBlockHeightRef = useRef<number | null>(null);
  const prevHashrateRef = useRef<number | null>(null);

  const addNotification = useCallback((type: LiveNotification["type"], message: string, color: string) => {
    const id = ++notifIdRef.current;
    setNotifications(prev => [{ id, type, message, timestamp: Date.now(), color }, ...prev].slice(0, 15));
  }, []);

  const { data: miningStatus } = useQuery<{ mergeMining: UserMergeMiningStatus; randomx: RandomXStats | null }>({
    queryKey: ["/api/merge-mine/status"],
    refetchInterval: 5000,
  });

  const { data: backgroundMiningStatus } = useQuery<MiningStats>({
    queryKey: ["/api/mining/status"],
    refetchInterval: 5000,
  });

  const { data: leaderboard } = useQuery<Array<{ username: string; blocks: number; earned: number; bestStreak: number }>>({
    queryKey: ["/api/mining/leaderboard"],
    refetchInterval: 30000,
  });

  const { data: genesisInfo } = useQuery<GenesisBlock>({
    queryKey: ["/api/merge-mine/genesis"],
  });

  const { data: lendingStatus } = useQuery<StxLendingState>({
    queryKey: ["/api/stx-lending/status"],
    refetchInterval: 10000,
  });

  const { data: recentBlocks } = useQuery<BlockRecord[]>({
    queryKey: ["/api/merge-mine/blocks/btc_fork"],
    refetchInterval: 15000,
  });

  const { data: mempoolStats } = useQuery<MempoolStats>({
    queryKey: ["/api/mempool/stats"],
    refetchInterval: 30000,
  });

  const { data: mempoolBlocks } = useQuery<MempoolBlock[]>({
    queryKey: ["/api/mempool/blocks"],
    refetchInterval: 30000,
  });

  const { data: mempoolHashrate } = useQuery<MempoolHashrate>({
    queryKey: ["/api/mempool/hashrate"],
    refetchInterval: 60000,
  });

  const { data: mempoolDifficulty } = useQuery<MempoolDifficulty>({
    queryKey: ["/api/mempool/difficulty"],
    refetchInterval: 60000,
  });

  const { data: networkInfo } = useQuery<{ activeMiners: number }>({
    queryKey: ["/api/mining/network"],
    refetchInterval: 15000,
  });

  const { data: liveChainStatus } = useQuery<{ configured: boolean; chains: Record<string, any> }>({
    queryKey: ["/api/chain/status"],
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: ethLatestBlock } = useQuery<{ number: number; hash: string; timestamp: number; transactionCount: number; baseFeePerGas: string | null }>({
    queryKey: ["/api/chain/ethereum/block/latest"],
    refetchInterval: 12000,
    staleTime: 10000,
  });

  useEffect(() => {
    if (mempoolStats?.blockHeight && prevBlockHeightRef.current !== null && mempoolStats.blockHeight !== prevBlockHeightRef.current) {
      addNotification("block", `New BTC block #${mempoolStats.blockHeight} confirmed on mainnet`, NEON_COLORS.cyan);
      toast({ title: "New Block Mined", description: `BTC block #${mempoolStats.blockHeight} confirmed` });
    }
    if (mempoolStats?.blockHeight) prevBlockHeightRef.current = mempoolStats.blockHeight;
  }, [mempoolStats?.blockHeight, addNotification, toast]);

  useEffect(() => {
    if (mempoolHashrate?.hashrates?.length) {
      const latest = mempoolHashrate.hashrates[mempoolHashrate.hashrates.length - 1]?.avgHashrate;
      if (latest && prevHashrateRef.current !== null) {
        const diff = ((latest - prevHashrateRef.current) / prevHashrateRef.current) * 100;
        if (Math.abs(diff) > 2) {
          addNotification("hashrate",
            `Network hashrate ${diff > 0 ? "surged" : "dropped"} ${Math.abs(diff).toFixed(1)}%`,
            diff > 0 ? NEON_COLORS.green : NEON_COLORS.orange
          );
        }
      }
      if (latest) prevHashrateRef.current = latest;
    }
  }, [mempoolHashrate, addNotification]);

  useEffect(() => {
    if (mempoolStats?.fees) {
      const feeRate = mempoolStats.fees.fastest;
      if (feeRate >= 50) {
        addNotification("fee", `High fee alert: ${feeRate} sat/vB priority rate`, NEON_COLORS.red);
      }
    }
  }, [mempoolStats?.fees?.fastest, addNotification]);

  const startMergeMining = useMutation({
    mutationFn: async (chain: string) => {
      const res = await apiRequest("POST", "/api/merge-mine/start", { chain });
      return res.json();
    },
    onSuccess: (_, chain) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merge-mine/status"] });
      addNotification("mining", `Merge mining activated on ${chain.toUpperCase()}`, NEON_COLORS.green);
      toast({ title: "Mining Started", description: `Active on ${chain.toUpperCase()}` });
    },
  });

  const stopMergeMining = useMutation({
    mutationFn: async (chain: string) => {
      const res = await apiRequest("POST", "/api/merge-mine/stop", { chain });
      return res.json();
    },
    onSuccess: (_, chain) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merge-mine/status"] });
      addNotification("mining", `Mining stopped on ${chain.toUpperCase()}`, NEON_COLORS.orange);
      toast({ title: "Mining Stopped", description: `Stopped on ${chain.toUpperCase()}` });
    },
  });

  const stakeLending = useMutation({
    mutationFn: async ({ amount, tier }: { amount: number; tier: string }) => {
      const res = await apiRequest("POST", "/api/stx-lending/stake", { amount, tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stx-lending/status"] });
      addNotification("mining", "STX staking position opened", NEON_COLORS.green);
      toast({ title: "Stake Successful", description: "Your STX is now earning cross-chain yield." });
    },
  });

  const activatePremium = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/premium-pass");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
        addNotification("mining", "Premium Mining Pass activated!", NEON_COLORS.gold);
        toast({ title: "Premium Activated", description: data.message });
      } else {
        toast({ title: "Activation Failed", description: data.message, variant: "destructive" });
      }
    },
  });

  const formatHashRate = (h: number) => {
    if (h >= 1e21) return `${(h / 1e21).toFixed(2)} ZH/s`;
    if (h >= 1e18) return `${(h / 1e18).toFixed(2)} EH/s`;
    if (h >= 1e15) return `${(h / 1e15).toFixed(2)} PH/s`;
    if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
    if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
    if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
    if (h >= 1e3) return `${(h / 1e3).toFixed(2)} KH/s`;
    return `${h.toFixed(2)} H/s`;
  };

  const latestHashrate = mempoolHashrate?.hashrates?.length
    ? mempoolHashrate.hashrates[mempoolHashrate.hashrates.length - 1]?.avgHashrate
    : null;

  return (
    <div className="space-y-6 pb-20" data-testid="genesis-miner-page">
      <OracleOverlay />

      <div className="relative overflow-hidden rounded-lg p-8 border"
        style={{ 
          borderColor: `${NEON_COLORS.gold}25`,
          background: `linear-gradient(135deg, rgba(255,215,0,0.03) 0%, rgba(0,0,0,0.6) 50%, rgba(0,240,255,0.03) 100%)`,
        }}
      >
        <div className="absolute top-0 right-0 p-4 flex items-center gap-3 flex-wrap justify-end">
          {backgroundMiningStatus && (
            <div className="flex items-center gap-2">
              {backgroundMiningStatus.hasPremiumPass ? (
                <div className="flex flex-col items-end">
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black border-none font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(255,180,0,0.4)]">
                    <Crown className="w-3 h-3" /> VIP PREMIUM
                  </Badge>
                  <span className="text-[9px] font-mono text-yellow-400 mt-1">
                    {Math.max(0, Math.ceil((backgroundMiningStatus.premiumPassExpiry - Date.now()) / 3600000))}h remaining
                  </span>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] transition-all"
                  onClick={() => activatePremium.mutate()}
                  disabled={activatePremium.isPending}
                  data-testid="button-activate-premium"
                >
                  ACTIVATE PREMIUM — 5 SKYNT
                </Button>
              )}
            </div>
          )}
          <Badge 
            className="flex items-center gap-1.5 border-none font-bold shadow-[0_0_12px_rgba(57,255,20,0.3)]"
            style={{ backgroundColor: `${NEON_COLORS.green}20`, color: NEON_COLORS.green }}
          >
            <Wifi className="w-3 h-3 animate-pulse" /> MAINNET LIVE
          </Badge>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter text-white" data-testid="text-hero-title">
            BTC HARD FORK <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-cyan-400">
              GENESIS MINER
            </span>
          </h1>
          <p className="text-muted-foreground font-mono max-w-2xl text-sm">
            Satoshi's original vision, reborn through the SphinxSkynet. Mine the hard fork from block 0 using cross-chain AuxPoW and solo RandomX.
          </p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 blur-[100px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${NEON_COLORS.gold}15, ${NEON_COLORS.cyan}10, transparent)` }} />
        <div className="absolute -top-10 -left-10 w-40 h-40 blur-[80px] rounded-full pointer-events-none"
          style={{ background: `${NEON_COLORS.magenta}08` }} />
      </div>

      <LiveNotificationBanner notifications={notifications} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <NeonStatCard
          icon={Activity}
          label="BTC Hashrate"
          value={latestHashrate ? formatHashRate(latestHashrate) : "Loading..."}
          color={NEON_COLORS.cyan}
          glow
          pulse
        />
        <NeonStatCard
          icon={Layers}
          label="Block Height"
          value={mempoolStats?.blockHeight?.toLocaleString() ?? "—"}
          color={NEON_COLORS.green}
          glow
        />
        <NeonStatCard
          icon={Zap}
          label="Fee Rate"
          value={mempoolStats?.fees ? `${mempoolStats.fees.fastest} sat/vB` : "—"}
          color={mempoolStats?.fees && mempoolStats.fees.fastest >= 50 ? NEON_COLORS.red : NEON_COLORS.gold}
          glow
        />
        <NeonStatCard
          icon={TrendingUp}
          label="Difficulty Adj."
          value={mempoolDifficulty ? `${mempoolDifficulty.difficultyChange > 0 ? "+" : ""}${mempoolDifficulty.difficultyChange.toFixed(2)}%` : "—"}
          color={NEON_COLORS.purple}
          glow
        />
      </div>

      {ethLatestBlock && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NeonStatCard
            icon={Layers}
            label="ETH Block"
            value={`#${ethLatestBlock.number.toLocaleString()}`}
            color={NEON_COLORS.blue}
            glow
            pulse
          />
          <NeonStatCard
            icon={Activity}
            label="ETH Txns"
            value={ethLatestBlock.transactionCount.toLocaleString()}
            color={NEON_COLORS.magenta}
            glow
          />
          <NeonStatCard
            icon={Zap}
            label="ETH Base Fee"
            value={ethLatestBlock.baseFeePerGas ? `${parseFloat(ethLatestBlock.baseFeePerGas).toFixed(1)} gwei` : "—"}
            color={NEON_COLORS.gold}
            glow
          />
          <NeonStatCard
            icon={TrendingUp}
            label="Anchor Hash"
            value={backgroundMiningStatus?.anchoredHash ? `${backgroundMiningStatus.anchoredHash.slice(0, 10)}...` : ethLatestBlock.hash.slice(0, 12) + "..."}
            color={NEON_COLORS.cyan}
          />
        </div>
      )}

      {backgroundMiningStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NeonStatCard
            icon={Flame}
            label="Current Streak"
            value={`${backgroundMiningStatus.streak}`}
            color={backgroundMiningStatus.streak > 0 ? NEON_COLORS.orange : NEON_COLORS.cyan}
            pulse={backgroundMiningStatus.streak > 0}
          />
          <NeonStatCard
            icon={Trophy}
            label="Best Streak"
            value={`${backgroundMiningStatus.bestStreak}`}
            color={NEON_COLORS.gold}
          />
          <NeonStatCard
            icon={Pickaxe}
            label="Lifetime Blocks"
            value={backgroundMiningStatus.lifetimeBlocksFound.toLocaleString()}
            color={NEON_COLORS.blue}
          />
          <NeonStatCard
            icon={Coins}
            label="Lifetime Earned"
            value={`${backgroundMiningStatus.lifetimeSkyntEarned.toFixed(2)} SKYNT`}
            color={NEON_COLORS.green}
          />
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="md:col-span-2 border transition-all"
          style={{ borderColor: `${NEON_COLORS.gold}20`, backgroundColor: `${NEON_COLORS.gold}04` }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-xs font-heading uppercase tracking-widest" style={{ color: NEON_COLORS.gold }}>
              Genesis Block Information
            </CardTitle>
            <Shield className="w-4 h-4" style={{ color: NEON_COLORS.gold }} />
          </CardHeader>
          <CardContent>
            {genesisInfo ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[10px] font-mono text-muted-foreground">HASH</span>
                  <span className="text-[10px] font-mono truncate max-w-[200px]" style={{ color: NEON_COLORS.cyan }} data-testid="text-genesis-hash">
                    {genesisInfo.hash}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Supply</p>
                    <p className="text-sm font-heading text-white">{genesisInfo.supply / 1000000}M</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Reward</p>
                    <p className="text-sm font-heading text-white">{genesisInfo.reward} BTC</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Halving</p>
                    <p className="text-sm font-heading text-white">{genesisInfo.halving / 1000}K</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-20 animate-pulse rounded" style={{ backgroundColor: `${NEON_COLORS.gold}08` }} />
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <NeonStatCard
            icon={Users}
            label="Active Miners"
            value={networkInfo?.activeMiners?.toLocaleString() ?? "0"}
            color={NEON_COLORS.magenta}
            glow
          />
          <NeonStatCard
            icon={Radio}
            label="Mempool Size"
            value={mempoolStats?.mempoolSize ? `${(mempoolStats.mempoolSize).toLocaleString()} tx` : "—"}
            color={NEON_COLORS.cyan}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border" style={{ borderColor: `${NEON_COLORS.gold}15`, backgroundColor: `${NEON_COLORS.gold}03` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" style={{ color: NEON_COLORS.gold }} />
                Milestone Achievements
              </CardTitle>
              {backgroundMiningStatus && (
                <div className="text-[10px] font-mono" style={{ color: NEON_COLORS.gold }}>
                  {backgroundMiningStatus.milestones.filter(m => m.achieved).length} / {backgroundMiningStatus.milestones.length} UNLOCKED
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {backgroundMiningStatus?.milestones.map((milestone, idx) => {
                const milestoneColor = milestone.achieved 
                  ? [NEON_COLORS.gold, NEON_COLORS.cyan, NEON_COLORS.green, NEON_COLORS.magenta, NEON_COLORS.purple, NEON_COLORS.blue, NEON_COLORS.orange, NEON_COLORS.red][idx % 8]
                  : "#666";
                return (
                  <div 
                    key={idx} 
                    className="flex-shrink-0 w-36 p-3 rounded-lg border transition-all duration-500"
                    style={{
                      borderColor: milestone.achieved ? `${milestoneColor}40` : "rgba(255,255,255,0.05)",
                      backgroundColor: milestone.achieved ? `${milestoneColor}08` : "rgba(0,0,0,0.3)",
                      boxShadow: milestone.achieved ? `0 0 15px ${milestoneColor}15` : undefined,
                      opacity: milestone.achieved ? 1 : 0.4,
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="p-1.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.5)", color: milestoneColor }}>
                        {milestone.achieved ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </div>
                      <Badge variant="outline" className="text-[8px] h-4" style={{ borderColor: `${milestoneColor}30`, color: milestoneColor }}>
                        {milestone.reward} SKYNT
                      </Badge>
                    </div>
                    <h4 className="text-[11px] font-heading text-white truncate mb-1">{milestone.title}</h4>
                    <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight mb-2">{milestone.desc}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-mono">
                        <span>PROGRESS</span>
                        <span style={{ color: milestoneColor }}>
                          {Math.min(100, Math.floor((backgroundMiningStatus.lifetimeBlocksFound / milestone.blocks) * 100))}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, (backgroundMiningStatus.lifetimeBlocksFound / milestone.blocks) * 100)} 
                        className="h-0.5"
                        style={{ backgroundColor: `${milestoneColor}15` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-[280px] border" style={{ borderColor: `${NEON_COLORS.cyan}15`, backgroundColor: `${NEON_COLORS.cyan}03` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" style={{ color: NEON_COLORS.cyan }} />
              Live Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <div className="h-full overflow-y-auto font-mono text-[10px] p-4 space-y-1 scrollbar-hide">
              {notifications.length === 0 && backgroundMiningStatus?.recentEvents.length === 0 && (
                <p className="text-muted-foreground italic">Streaming live data...</p>
              )}
              {notifications.map((notif) => (
                <div key={notif.id} className="flex gap-2 leading-relaxed border-b pb-1" style={{ borderColor: `${notif.color}10` }}>
                  <span className="text-muted-foreground/50 shrink-0">
                    [{new Date(notif.timestamp).toLocaleTimeString([], { hour12: false })}]
                  </span>
                  <span className="font-bold shrink-0 uppercase" style={{ color: notif.color }}>
                    {notif.type} —
                  </span>
                  <span className="text-white/90">{notif.message}</span>
                </div>
              ))}
              {backgroundMiningStatus?.recentEvents.map((event, idx) => {
                const colors: Record<string, string> = {
                  block_found: NEON_COLORS.gold,
                  streak: NEON_COLORS.orange,
                  milestone: NEON_COLORS.purple,
                  difficulty_up: NEON_COLORS.cyan,
                  premium: NEON_COLORS.green,
                  fee: NEON_COLORS.magenta,
                };
                return (
                  <div key={`event-${idx}`} className="flex gap-2 leading-relaxed border-b pb-1" style={{ borderColor: `${colors[event.type] || NEON_COLORS.cyan}10` }}>
                    <span className="text-muted-foreground/50 shrink-0">
                      [{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}]
                    </span>
                    <span className="font-bold shrink-0 uppercase" style={{ color: colors[event.type] || NEON_COLORS.cyan }}>
                      {event.type.replace('_', ' ')} —
                    </span>
                    <span className="text-white/90">{event.message}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {mempoolBlocks && mempoolBlocks.length > 0 && (
        <Card className="border" style={{ borderColor: `${NEON_COLORS.cyan}15`, backgroundColor: `${NEON_COLORS.cyan}03` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" style={{ color: NEON_COLORS.cyan }} />
                Live BTC Mainnet Blocks
              </CardTitle>
              <Badge className="border-none text-[9px]" style={{ backgroundColor: `${NEON_COLORS.green}15`, color: NEON_COLORS.green }}>
                <Wifi className="w-3 h-3 mr-1 animate-pulse" /> SYNCED
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {mempoolBlocks.slice(0, 6).map((block, idx) => {
                const blockColor = [NEON_COLORS.cyan, NEON_COLORS.green, NEON_COLORS.gold, NEON_COLORS.purple, NEON_COLORS.blue, NEON_COLORS.magenta][idx % 6];
                return (
                  <div key={block.id} className="flex-shrink-0 w-44 p-3 rounded-lg border transition-all hover:scale-[1.02]"
                    style={{ borderColor: `${blockColor}25`, backgroundColor: `${blockColor}05` }}
                    data-testid={`card-mainnet-block-${block.height}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-heading font-bold" style={{ color: blockColor }}>#{block.height}</span>
                      <span className="text-[8px] font-mono text-muted-foreground">
                        {new Date(block.timestamp * 1000).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-muted-foreground">TXs</span>
                        <span className="text-white">{block.tx_count?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-muted-foreground">SIZE</span>
                        <span className="text-white">{(block.size / 1e6).toFixed(2)} MB</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border w-full justify-start h-auto p-1 gap-1" style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)" }}>
          <TabsTrigger value="mining" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_10px_rgba(0,240,255,0.1)] flex items-center gap-2 py-2 px-4">
            <Cpu className="w-4 h-4" /> Merge Mining
          </TabsTrigger>
          <TabsTrigger value="randomx" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_0_10px_rgba(77,124,255,0.1)] flex items-center gap-2 py-2 px-4">
            <Zap className="w-4 h-4" /> RandomX Solo
          </TabsTrigger>
          <TabsTrigger value="lending" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 data-[state=active]:shadow-[0_0_10px_rgba(57,255,20,0.1)] flex items-center gap-2 py-2 px-4">
            <Droplets className="w-4 h-4" /> STX Yield
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400 data-[state=active]:shadow-[0_0_10px_rgba(255,215,0,0.1)] flex items-center gap-2 py-2 px-4">
            <Trophy className="w-4 h-4" /> Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mining" className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(MERGE_MINING_CHAINS).map(([id, chain]) => {
              const stats = miningStatus?.mergeMining?.[id];
              const active = stats?.isActive;
              const chainColor = CHAIN_NEON_COLORS[id] || NEON_COLORS.cyan;
              
              return (
                <Card 
                  key={id} 
                  className="transition-all duration-500 overflow-hidden border"
                  style={{
                    borderColor: active ? `${chainColor}50` : `${chainColor}15`,
                    backgroundColor: active ? `${chainColor}08` : `${chainColor}03`,
                    boxShadow: active ? `0 0 25px ${chainColor}15, inset 0 0 25px ${chainColor}05` : undefined,
                  }}
                  data-testid={`card-chain-${id}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl border"
                        style={{ borderColor: `${chainColor}30`, backgroundColor: `${chainColor}10`, color: chainColor }}
                      >
                        {chain.icon}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-heading uppercase" style={{ color: chainColor }}>{chain.name}</CardTitle>
                        <Badge variant="outline" className="text-[8px] h-4 mt-0.5" style={{ borderColor: `${chainColor}30`, color: chainColor }}>
                          {chain.algorithm.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    {active && (
                      <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: NEON_COLORS.green, boxShadow: `0 0 8px ${NEON_COLORS.green}` }} />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 rounded border" style={{ borderColor: `${chainColor}10`, backgroundColor: `${chainColor}05` }}>
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">Difficulty</p>
                        <p className="text-xs font-mono" style={{ color: chainColor }} data-testid={`text-difficulty-${id}`}>{chain.difficultyFactor}x</p>
                      </div>
                      <div className="p-2 rounded border" style={{ borderColor: `${chainColor}10`, backgroundColor: `${chainColor}05` }}>
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">Reward</p>
                        <p className="text-xs font-mono" style={{ color: NEON_COLORS.green }} data-testid={`text-reward-mult-${id}`}>{chain.rewardMultiplier} BTC</p>
                      </div>
                    </div>

                    {active && stats && (
                      <div className="space-y-2 pt-2 border-t" style={{ borderColor: `${chainColor}15` }}>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">HASHRATE</span>
                          <span style={{ color: NEON_COLORS.cyan }} data-testid={`text-hashrate-${id}`}>{formatHashRate(stats.hashRate)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">EARNED</span>
                          <span style={{ color: NEON_COLORS.green }} data-testid={`text-rewards-${id}`}>{(stats.totalRewards || stats.rewardsEarned || 0).toFixed(8)} {chain.symbol}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${chainColor}15` }}>
                          <div className="h-full rounded-full transition-all duration-1000 animate-pulse" 
                            style={{ width: `${30 + Math.random() * 70}%`, backgroundColor: chainColor }} />
                        </div>
                      </div>
                    )}

                    <Button
                      variant={active ? "destructive" : "outline"}
                      className="w-full h-9 text-xs font-heading tracking-widest transition-all"
                      style={!active ? { 
                        borderColor: `${chainColor}40`, 
                        color: chainColor,
                        backgroundColor: `${chainColor}08`,
                      } : undefined}
                      data-testid={`button-mine-${id}`}
                      onClick={() => active ? stopMergeMining.mutate(id) : startMergeMining.mutate(id)}
                      disabled={startMergeMining.isPending || stopMergeMining.isPending}
                    >
                      {active ? (
                        <><PowerOff className="w-3.5 h-3.5 mr-2" /> STOP MINING</>
                      ) : (
                        <><Power className="w-3.5 h-3.5 mr-2" /> START MINING</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="randomx" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 overflow-hidden relative border"
              style={{ borderColor: `${NEON_COLORS.blue}20`, backgroundColor: `${NEON_COLORS.blue}04` }}
              data-testid="card-randomx-solo"
            >
              <div className="absolute top-0 right-0 p-4">
                <Badge className="flex items-center gap-1 border-none shadow-[0_0_10px_rgba(77,124,255,0.2)]"
                  style={{ backgroundColor: `${NEON_COLORS.blue}20`, color: NEON_COLORS.blue }}
                >
                  <Pickaxe className="w-3 h-3" /> SOLO MINING
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap style={{ color: NEON_COLORS.blue }} />
                  <span style={{ color: NEON_COLORS.blue }}>RandomX CPU Miner</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground font-mono">CPU-optimized solo mining algorithm for fair distribution.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <RandomXVisualization isActive={miningStatus?.randomx?.isActive ?? false} />

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Hashrate</p>
                    <p className="text-xl font-heading" style={{ color: NEON_COLORS.blue }} data-testid="text-randomx-hashrate">
                      {miningStatus?.randomx ? formatHashRate(miningStatus.randomx.hashRate) : "0 H/s"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Nonces</p>
                    <p className="text-xl font-heading text-white" data-testid="text-randomx-nonces">
                      {miningStatus?.randomx?.noncesChecked?.toLocaleString() ?? "0"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Blocks Found</p>
                    <p className="text-xl font-heading" style={{ color: NEON_COLORS.gold }} data-testid="text-randomx-blocks">
                      {miningStatus?.randomx?.blocksFound ?? "0"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Total BTC</p>
                    <p className="text-xl font-heading" style={{ color: NEON_COLORS.green }} data-testid="text-randomx-rewards">
                      {miningStatus?.randomx?.btcEarned?.toFixed(8) ?? "0.00000000"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button 
                    className="flex-1 font-heading tracking-widest h-12 border transition-all"
                    style={{
                      backgroundColor: `${NEON_COLORS.blue}15`,
                      color: NEON_COLORS.blue,
                      borderColor: `${NEON_COLORS.blue}40`,
                    }}
                    data-testid="button-randomx-toggle"
                    onClick={() => {
                      const active = miningStatus?.randomx?.isActive;
                      if (active) stopMergeMining.mutate("randomx");
                      else startMergeMining.mutate("randomx");
                    }}
                  >
                    {miningStatus?.randomx?.isActive ? (
                      <><ZapOff className="w-4 h-4 mr-2" /> TERMINATE SESSION</>
                    ) : (
                      <><Zap className="w-4 h-4 mr-2" /> INITIALIZE CPU MINER</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border" style={{ borderColor: `${NEON_COLORS.blue}15`, backgroundColor: `${NEON_COLORS.blue}04` }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" style={{ color: NEON_COLORS.blue }} />
                    RandomX Config
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "SCRATCHPAD", value: `${(RANDOMX_CONFIG.scratchpadSize / 1024 / 1024).toFixed(0)}MB`, color: NEON_COLORS.cyan },
                    { label: "ITERATIONS", value: `${RANDOMX_CONFIG.iterationsPerHash}`, color: NEON_COLORS.blue },
                    { label: "DIFFICULTY", value: `${RANDOMX_CONFIG.soloMiningDifficulty}`, color: NEON_COLORS.purple },
                    { label: "BLOCK REWARD", value: `${RANDOMX_CONFIG.blockReward} BTC`, color: NEON_COLORS.green },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">{label}</span>
                      <span style={{ color }}>{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="p-4 rounded-lg border" style={{ borderColor: `${NEON_COLORS.blue}20`, backgroundColor: `${NEON_COLORS.blue}05` }}>
                <h4 className="text-[10px] font-heading uppercase mb-2" style={{ color: NEON_COLORS.blue }}>AuxPoW Proof Flow</h4>
                <div className="space-y-3 relative">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono" style={{ backgroundColor: `${NEON_COLORS.cyan}20`, color: NEON_COLORS.cyan }}>P</div>
                    <div className="h-px flex-1" style={{ backgroundColor: `${NEON_COLORS.cyan}20` }} />
                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono" style={{ backgroundColor: `${NEON_COLORS.blue}20`, color: NEON_COLORS.blue }}>A</div>
                    <div className="h-px flex-1" style={{ backgroundColor: `${NEON_COLORS.blue}20` }} />
                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono" style={{ backgroundColor: `${NEON_COLORS.gold}20`, color: NEON_COLORS.gold }}>C</div>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground leading-relaxed">
                    Parent (SKYNT) block finds hash → AuxProof header generated → Child (BTC) chain verifies proof and mints block.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lending" className="mt-6">
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 grid md:grid-cols-3 gap-6">
              {Object.values(STX_LENDING_TIERS).map((tier) => {
                const isActive = lendingStatus?.tierId === tier.id;
                return (
                  <Card 
                    key={tier.id} 
                    className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border"
                    style={{
                      borderColor: isActive ? `${tier.color}50` : `${tier.color}15`,
                      backgroundColor: isActive ? `${tier.color}08` : `${tier.color}03`,
                      boxShadow: isActive ? `0 0 20px ${tier.color}15` : undefined,
                    }}
                    data-testid={`card-lending-tier-${tier.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-sm font-heading" style={{ color: tier.color }}>{tier.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{tier.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="text-center py-4 rounded border" style={{ borderColor: `${tier.color}15`, backgroundColor: `${tier.color}05` }}>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">Annual Yield</p>
                        <p className="text-3xl font-heading" style={{ color: tier.color }}>{tier.aprPercent}% APR</p>
                      </div>

                      <div className="space-y-2">
                        {[
                          { label: "MIN STAKE", value: `${tier.minStake} STX` },
                          { label: "LOCK PERIOD", value: `${tier.lockDays} Days` },
                          { label: "POX BONUS", value: `${tier.poxBonus}x`, highlight: true },
                        ].map(({ label, value, highlight }) => (
                          <div key={label} className="flex justify-between text-[10px] font-mono">
                            <span className="text-muted-foreground">{label}</span>
                            <span style={{ color: highlight ? NEON_COLORS.green : "white" }}>{value}</span>
                          </div>
                        ))}
                      </div>

                      <Button 
                        className="w-full h-10 text-[10px] font-heading tracking-widest border transition-all"
                        style={{ backgroundColor: `${tier.color}10`, color: tier.color, borderColor: `${tier.color}40` }}
                        variant="outline"
                        data-testid={`button-stake-${tier.id}`}
                        onClick={() => stakeLending.mutate({ amount: tier.minStake, tier: tier.id })}
                        disabled={stakeLending.isPending || lendingStatus?.tierId !== null}
                      >
                        {isActive ? "CURRENT TIER" : `STAKE ${tier.minStake} STX`}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="border" style={{ borderColor: `${NEON_COLORS.green}15`, backgroundColor: `${NEON_COLORS.green}04` }}>
              <CardHeader>
                <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" style={{ color: NEON_COLORS.green }} />
                  Your Positions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {lendingStatus?.tierId ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[9px] font-mono text-muted-foreground uppercase">Staked Amount</p>
                      <p className="text-lg font-heading text-white" data-testid="text-staked-amount">{lendingStatus.stakedAmount} STX</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-muted-foreground uppercase">Accumulated Yield</p>
                      <p className="text-lg font-heading" style={{ color: NEON_COLORS.green }} data-testid="text-yield-earned">
                        {lendingStatus.yieldEarned.toFixed(6)} STX
                      </p>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex justify-between text-[10px] font-mono mb-2">
                        <span className="text-muted-foreground">Ratio BTC/STX</span>
                        <span style={{ color: NEON_COLORS.cyan }}>1:42,500</span>
                      </div>
                      <Progress value={45} className="h-1" style={{ backgroundColor: `${NEON_COLORS.green}15` }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 opacity-30">
                    <Droplets className="w-10 h-10 mx-auto mb-2" style={{ color: NEON_COLORS.green }} />
                    <p className="text-[10px] font-mono">No active positions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <Card className="overflow-hidden border" style={{ borderColor: `${NEON_COLORS.gold}15`, backgroundColor: `${NEON_COLORS.gold}03` }}>
            <CardHeader className="border-b" style={{ borderColor: `${NEON_COLORS.gold}10`, backgroundColor: `${NEON_COLORS.gold}05` }}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-heading flex items-center gap-2">
                    <Trophy style={{ color: NEON_COLORS.gold }} />
                    <span style={{ color: NEON_COLORS.gold }}>Global Mining Hall of Fame</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-1">Real-time ranking of top earners in the SKYNT network.</p>
                </div>
                <Badge className="border-none" style={{ backgroundColor: `${NEON_COLORS.gold}15`, color: NEON_COLORS.gold }}>
                  TOP 20 ACTIVE
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent" style={{ borderColor: `${NEON_COLORS.gold}10` }}>
                    <TableHead className="w-[80px] text-[10px] font-heading uppercase text-muted-foreground">Rank</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase text-muted-foreground">Miner</TableHead>
                    <TableHead className="text-right text-[10px] font-heading uppercase text-muted-foreground">Blocks Found</TableHead>
                    <TableHead className="text-right text-[10px] font-heading uppercase text-muted-foreground">Best Streak</TableHead>
                    <TableHead className="text-right text-[10px] font-heading uppercase text-muted-foreground">Total Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground font-mono">
                        No mining data available yet. Start mining to join the board!
                      </TableCell>
                    </TableRow>
                  )}
                  {leaderboard?.map((entry, idx) => {
                    const rowColor = idx === 0 ? NEON_COLORS.gold : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "white";
                    return (
                      <TableRow key={idx} className="hover:bg-white/5" style={{ borderColor: `${rowColor}10` }}>
                        <TableCell className="font-mono">
                          {idx === 0 ? <Crown className="w-4 h-4" style={{ color: NEON_COLORS.gold }} /> : 
                           idx === 1 ? <Trophy className="w-4 h-4" style={{ color: "#c0c0c0" }} /> :
                           idx === 2 ? <Trophy className="w-4 h-4" style={{ color: "#cd7f32" }} /> : 
                           `#${idx + 1}`}
                        </TableCell>
                        <TableCell className="font-heading text-white">{entry.username}</TableCell>
                        <TableCell className="text-right font-mono" style={{ color: NEON_COLORS.cyan }}>{entry.blocks.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono" style={{ color: NEON_COLORS.orange }}>
                          {entry.bestStreak > 0 ? `${entry.bestStreak}` : '0'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold" style={{ color: NEON_COLORS.green }}>
                          {entry.earned.toFixed(2)} SKYNT
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h3 className="text-xl font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <History style={{ color: NEON_COLORS.gold }} />
            Recent Hard Fork Blocks
          </h3>
          <Badge className="text-[9px] font-mono border-none" style={{ backgroundColor: `${NEON_COLORS.green}10`, color: NEON_COLORS.green }}>
            <Wifi className="w-3 h-3 mr-1 animate-pulse" /> SYNCED WITH MAINNET
          </Badge>
        </div>

        <div className="rounded-lg border overflow-x-auto" style={{ borderColor: `${NEON_COLORS.gold}10`, backgroundColor: `${NEON_COLORS.gold}03` }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Height</th>
                <th>Hash</th>
                <th>Miner</th>
                <th>Reward</th>
                <th>Algorithm</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentBlocks?.map((block) => (
                <tr key={block.hash} data-testid={`row-block-${block.height}`}>
                  <td style={{ color: NEON_COLORS.cyan }}>#{block.height}</td>
                  <td className="font-mono">{block.hash.slice(0, 16)}...</td>
                  <td className="text-muted-foreground">{block.miner.slice(0, 10)}...</td>
                  <td style={{ color: NEON_COLORS.green }}>{block.reward} BTC</td>
                  <td>
                    <Badge variant="outline" className="text-[9px] h-4 uppercase" style={{ borderColor: `${NEON_COLORS.purple}30`, color: NEON_COLORS.purple }}>
                      {block.algorithm}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground">{new Date(block.timestamp).toLocaleTimeString()}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground opacity-30">
                    Discovering the blockchain...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {notifications.length > 0 && (
        <Card className="border" style={{ borderColor: `${NEON_COLORS.cyan}15`, backgroundColor: `${NEON_COLORS.cyan}03` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" style={{ color: NEON_COLORS.cyan }} />
              Notification History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide font-mono text-[10px]">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-2 py-0.5">
                  <span className="text-muted-foreground/50 shrink-0">[{new Date(n.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                  <span className="font-bold uppercase shrink-0" style={{ color: n.color }}>{n.type}</span>
                  <span className="text-white/80">{n.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
