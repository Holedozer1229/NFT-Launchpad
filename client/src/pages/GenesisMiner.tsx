import { useState, useEffect, useRef } from "react";
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
  ZapOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MERGE_MINING_CHAINS, 
  RANDOMX_CONFIG, 
  STX_LENDING_TIERS,
  type MergeMiningChainId,
  type StxLendingTierId
} from "@shared/schema";
import { OracleOverlay } from "@/components/OracleOverlay";

// --- Types ---

interface MergeMiningStats {
  isActive: boolean;
  hashRate: number;
  blocksFound: number;
  totalRewards: number;
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

// --- Components ---

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

      ctx.fillStyle = "rgba(10, 10, 15, 0.2)";
      ctx.fillRect(0, 0, w, h);

      if (isActive) {
        // RandomX "Matrix" style visualization but with a blue/purple theme
        const cols = 20;
        for (let i = 0; i < cols; i++) {
          const x = (i / cols) * w;
          const speed = 1 + (Math.sin(i * 0.5) * 0.5);
          const y = ((f * speed + i * 23) % (h + 30)) - 15;
          const char = Math.floor(Math.random() * 16).toString(16).toUpperCase();
          
          ctx.fillStyle = `hsla(${240 + Math.sin(f * 0.05 + i) * 20}, 80%, 60%, ${0.2 + Math.random() * 0.5})`;
          ctx.font = "9px monospace";
          ctx.fillText(char, x, y);
        }

        // Add some random "nodes" popping up
        if (f % 5 === 0) {
          ctx.beginPath();
          ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(100, 150, 255, 0.4)";
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, w, h);
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
      className="w-full h-24 rounded border border-white/10"
      style={{ imageRendering: "pixelated" }}
      data-testid="randomx-visualization"
    />
  );
}

export default function GenesisMiner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("mining");

  // --- Queries ---

  const { data: miningStatus } = useQuery<{ mergeMining: UserMergeMiningStatus; randomx: RandomXStats }>({
    queryKey: ["/api/merge-mine/status"],
    refetchInterval: 5000,
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

  // --- Mutations ---

  const startMergeMining = useMutation({
    mutationFn: async (chain: string) => {
      const res = await apiRequest("POST", "/api/merge-mine/start", { chain });
      return res.json();
    },
    onSuccess: (_, chain) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merge-mine/status"] });
      toast({ title: "Merge Mining Started", description: `Active on ${chain.toUpperCase()}` });
    },
  });

  const stopMergeMining = useMutation({
    mutationFn: async (chain: string) => {
      const res = await apiRequest("POST", "/api/merge-mine/stop", { chain });
      return res.json();
    },
    onSuccess: (_, chain) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merge-mine/status"] });
      toast({ title: "Merge Mining Stopped", description: `Stopped on ${chain.toUpperCase()}` });
    },
  });

  const stakeLending = useMutation({
    mutationFn: async ({ amount, tier }: { amount: number; tier: string }) => {
      const res = await apiRequest("POST", "/api/stx-lending/stake", { amount, tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stx-lending/status"] });
      toast({ title: "Stake Successful", description: "Your STX is now earning cross-chain yield." });
    },
  });

  // --- Helpers ---

  const formatHashRate = (h: number) => {
    if (h >= 1000000) return `${(h / 1000000).toFixed(2)} MH/s`;
    if (h >= 1000) return `${(h / 1000).toFixed(2)} KH/s`;
    return `${h.toFixed(2)} H/s`;
  };

  return (
    <div className="space-y-8 pb-20" data-testid="genesis-miner-page">
      <OracleOverlay />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg p-8 bg-black/40 border border-white/10">
        <div className="absolute top-0 right-0 p-4">
          <Badge variant="outline" className="border-neon-green text-neon-green animate-pulse" data-testid="status-mainnet">
            MAINNET ACTIVE
          </Badge>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter text-white" data-testid="text-hero-title">
            BTC HARD FORK <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sphinx-gold via-orange-400 to-sphinx-gold oracle-glow">
              GENESIS MINER
            </span>
          </h1>
          <p className="text-muted-foreground font-mono max-w-2xl">
            Satoshi's original vision, reborn through the SphinxSkynet. Mine the hard fork from block 0 using cross-chain AuxPoW and solo RandomX.
          </p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-sphinx-gold/10 blur-[100px] rounded-full pointer-events-none"></div>
      </div>

      {/* Genesis Block & Stats Bar */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="cosmic-card cosmic-card-orange md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-xs font-heading uppercase tracking-widest text-sphinx-gold">Genesis Block Information</CardTitle>
            <Shield className="w-4 h-4 text-sphinx-gold" />
          </CardHeader>
          <CardContent>
            {genesisInfo ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[10px] font-mono text-muted-foreground">HASH</span>
                  <span className="text-[10px] font-mono text-white truncate max-w-[200px]" data-testid="text-genesis-hash">{genesisInfo.hash}</span>
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
              <div className="h-20 animate-pulse bg-white/5 rounded"></div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Card className="bg-black/40 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-neon-cyan" />
                <span className="text-[10px] font-heading uppercase text-muted-foreground">Network Hashrate</span>
              </div>
              <p className="text-xl font-heading text-white" data-testid="text-total-hashrate">12.45 PH/s</p>
            </CardContent>
          </Card>
          <Card className="bg-black/40 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-neon-green" />
                <span className="text-[10px] font-heading uppercase text-muted-foreground">Blocks Found</span>
              </div>
              <p className="text-xl font-heading text-white" data-testid="text-total-blocks">4,281</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-black/40 border border-white/10 w-full justify-start h-auto p-1 gap-1">
          <TabsTrigger value="mining" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary flex items-center gap-2 py-2 px-4">
            <Cpu className="w-4 h-4" /> Merge Mining
          </TabsTrigger>
          <TabsTrigger value="randomx" className="data-[state=active]:bg-neon-blue/20 data-[state=active]:text-neon-blue flex items-center gap-2 py-2 px-4">
            <Zap className="w-4 h-4" /> RandomX Solo
          </TabsTrigger>
          <TabsTrigger value="lending" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green flex items-center gap-2 py-2 px-4">
            <Droplets className="w-4 h-4" /> STX Yield
          </TabsTrigger>
        </TabsList>

        {/* Merge Mining Panel */}
        <TabsContent value="mining" className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(MERGE_MINING_CHAINS).map(([id, chain]) => {
              const stats = miningStatus?.mergeMining[id];
              const active = stats?.isActive;
              
              return (
                <Card 
                  key={id} 
                  className={`transition-all duration-500 overflow-hidden ${
                    active 
                      ? `border-${chain.id === 'auxpow_btc' ? 'sphinx-gold' : 'primary'}/50 bg-${chain.id === 'auxpow_btc' ? 'sphinx-gold' : 'primary'}/5 shadow-[0_0_15px_rgba(255,200,0,0.1)]` 
                      : 'bg-black/40 border-white/10'
                  }`}
                  data-testid={`card-chain-${id}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-xl" style={{ color: chain.color }}>
                        {chain.icon}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-heading uppercase">{chain.name}</CardTitle>
                        <Badge variant="outline" className="text-[8px] h-4 mt-0.5 border-white/20 text-muted-foreground">
                          {chain.algorithm.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    {active && <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/30 p-2 rounded border border-white/5">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">Difficulty</p>
                        <p className="text-xs font-mono text-white" data-testid={`text-difficulty-${id}`}>{chain.difficultyFactor}x</p>
                      </div>
                      <div className="bg-black/30 p-2 rounded border border-white/5">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">Reward</p>
                        <p className="text-xs font-mono text-white" data-testid={`text-reward-mult-${id}`}>{chain.rewardMultiplier} BTC</p>
                      </div>
                    </div>

                    {active && stats && (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">HASHRATE</span>
                          <span className="text-neon-cyan" data-testid={`text-hashrate-${id}`}>{formatHashRate(stats.hashRate)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">EARNED</span>
                          <span className="text-neon-green" data-testid={`text-rewards-${id}`}>{stats.totalRewards.toFixed(8)} {chain.symbol}</span>
                        </div>
                        <Progress value={Math.random() * 100} className="h-1 bg-white/5" />
                      </div>
                    )}

                    <Button
                      variant={active ? "destructive" : "outline"}
                      className={`w-full h-9 text-xs font-heading tracking-widest ${
                        !active && "border-white/20 hover:border-white/40 hover:bg-white/5"
                      }`}
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

        {/* RandomX Solo Miner */}
        <TabsContent value="randomx" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-black/40 border-white/10 overflow-hidden relative" data-testid="card-randomx-solo">
              <div className="absolute top-0 right-0 p-4">
                <Badge className="bg-neon-blue/20 text-neon-blue border-neon-blue/30 flex items-center gap-1">
                  <Pickaxe className="w-3 h-3" /> SOLO MINING
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="text-neon-blue" />
                  RandomX CPU Miner
                </CardTitle>
                <p className="text-xs text-muted-foreground font-mono">CPU-optimized solo mining algorithm for fair distribution.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <RandomXVisualization isActive={miningStatus?.randomx?.isActive ?? false} />

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Hashrate</p>
                    <p className="text-xl font-heading text-neon-blue" data-testid="text-randomx-hashrate">
                      {miningStatus?.randomx ? formatHashRate(miningStatus.randomx.hashRate) : "0 H/s"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Nonces</p>
                    <p className="text-xl font-heading text-white" data-testid="text-randomx-nonces">
                      {miningStatus?.randomx?.noncesChecked.toLocaleString() ?? "0"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Blocks Found</p>
                    <p className="text-xl font-heading text-sphinx-gold" data-testid="text-randomx-blocks">
                      {miningStatus?.randomx?.blocksFound ?? "0"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase">Total BTC</p>
                    <p className="text-xl font-heading text-neon-green" data-testid="text-randomx-rewards">
                      {miningStatus?.randomx?.btcEarned.toFixed(8) ?? "0.00000000"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button 
                    className="flex-1 bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue border border-neon-blue/40 font-heading tracking-widest h-12"
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
              <Card className="bg-black/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-neon-blue" />
                    RandomX Config
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">SCRATCHPAD</span>
                    <span className="text-white">{(RANDOMX_CONFIG.scratchpadSize / 1024 / 1024).toFixed(0)}MB</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">ITERATIONS</span>
                    <span className="text-white">{RANDOMX_CONFIG.iterationsPerHash}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">DIFFICULTY</span>
                    <span className="text-white">{RANDOMX_CONFIG.soloMiningDifficulty}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">BLOCK REWARD</span>
                    <span className="text-neon-green">{RANDOMX_CONFIG.blockReward} BTC</span>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 rounded-lg bg-neon-blue/5 border border-neon-blue/20">
                <h4 className="text-[10px] font-heading text-neon-blue uppercase mb-2">AuxPoW Proof Flow</h4>
                <div className="space-y-3 relative">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-[10px] font-mono text-primary">P</div>
                    <div className="h-px flex-1 bg-white/10"></div>
                    <div className="w-6 h-6 rounded bg-neon-blue/20 flex items-center justify-center text-[10px] font-mono text-neon-blue">A</div>
                    <div className="h-px flex-1 bg-white/10"></div>
                    <div className="w-6 h-6 rounded bg-sphinx-gold/20 flex items-center justify-center text-[10px] font-mono text-sphinx-gold">C</div>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground leading-relaxed">
                    Parent (SKYNT) block finds hash → AuxProof header generated → Child (BTC) chain verifies proof and mints block.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* STX Lending Panel */}
        <TabsContent value="lending" className="mt-6">
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 grid md:grid-cols-3 gap-6">
              {Object.values(STX_LENDING_TIERS).map((tier) => (
                <Card 
                  key={tier.id} 
                  className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                    lendingStatus?.tierId === tier.id 
                      ? `border-[${tier.color}]/50 bg-[${tier.color}]/5` 
                      : 'bg-black/40 border-white/10'
                  }`}
                  data-testid={`card-lending-tier-${tier.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-sm font-heading" style={{ color: tier.color }}>{tier.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center py-4 bg-black/30 rounded border border-white/5">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">Annual Yield</p>
                      <p className="text-3xl font-heading" style={{ color: tier.color }}>{tier.aprPercent}% APR</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-muted-foreground">MIN STAKE</span>
                        <span className="text-white">{tier.minStake} STX</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-muted-foreground">LOCK PERIOD</span>
                        <span className="text-white">{tier.lockDays} Days</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-muted-foreground">POX BONUS</span>
                        <span className="text-neon-green">{tier.poxBonus}x</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-10 text-[10px] font-heading tracking-widest"
                      style={{ backgroundColor: `${tier.color}20`, color: tier.color, borderColor: `${tier.color}40` }}
                      variant="outline"
                      data-testid={`button-stake-${tier.id}`}
                      onClick={() => stakeLending.mutate({ amount: tier.minStake, tier: tier.id })}
                      disabled={stakeLending.isPending || lendingStatus?.tierId !== null}
                    >
                      {lendingStatus?.tierId === tier.id ? "CURRENT TIER" : `STAKE ${tier.minStake} STX`}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-black/40 border-white/10">
              <CardHeader>
                <CardTitle className="text-xs font-heading uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-neon-green" />
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
                      <p className="text-lg font-heading text-neon-green" data-testid="text-yield-earned">{lendingStatus.yieldEarned.toFixed(6)} STX</p>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex justify-between text-[10px] font-mono mb-2">
                        <span className="text-muted-foreground">Ratio BTC/STX</span>
                        <span className="text-white">1:42,500</span>
                      </div>
                      <Progress value={45} className="h-1 bg-white/5" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 opacity-30">
                    <Droplets className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-[10px] font-mono">No active positions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Block Explorer Section */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h3 className="text-xl font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <History className="text-sphinx-gold" />
            Recent Hard Fork Blocks
          </h3>
          <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground border-white/10">
            SYNCED WITH MAINNET
          </Badge>
        </div>

        <div className="cosmic-card overflow-x-auto">
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
                  <td className="text-neon-cyan">#{block.height}</td>
                  <td className="font-mono">{block.hash.slice(0, 16)}...</td>
                  <td className="text-muted-foreground">{block.miner.slice(0, 10)}...</td>
                  <td className="text-neon-green">{block.reward} BTC</td>
                  <td>
                    <Badge variant="outline" className="text-[9px] h-4 uppercase border-white/10">
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
    </div>
  );
}
