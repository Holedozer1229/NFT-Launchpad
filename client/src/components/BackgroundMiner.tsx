import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pickaxe, Power, PowerOff, Cpu, Zap, TrendingUp, Coins, Activity, Hash, Clock, Users } from "lucide-react";

interface MiningStats {
  isActive: boolean;
  hashRate: number;
  blocksFound: number;
  totalSkyntEarned: number;
  currentPhiBoost: number;
  cyclesCompleted: number;
  lastBlockHash: string;
  lastBlockTime: number;
  sessionStartedAt: number;
  uptimeSeconds: number;
  difficulty: number;
  noncesChecked: number;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function MinerVisualization({ stats }: { stats: MiningStats }) {
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

      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      if (stats.isActive) {
        const cols = 32;
        for (let i = 0; i < cols; i++) {
          const x = (i / cols) * w;
          const speed = 0.5 + (Math.sin(i * 0.7) * 0.3);
          const y = ((f * speed + i * 17) % (h + 20)) - 10;
          const char = Math.random() > 0.5 ? "1" : "0";
          ctx.fillStyle = `hsla(${150 + Math.sin(f * 0.02 + i) * 30}, 100%, ${50 + Math.sin(f * 0.05 + i * 0.3) * 20}%, ${0.3 + Math.random() * 0.4})`;
          ctx.font = "10px monospace";
          ctx.fillText(char, x, y);
        }

        if (f % 3 === 0) {
          const px = Math.random() * w;
          const py = Math.random() * h;
          const radius = 1 + Math.random() * 2;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${120 + stats.currentPhiBoost * 60}, 100%, 70%, 0.6)`;
          ctx.fill();
        }

        if (stats.lastBlockTime && Date.now() - stats.lastBlockTime < 3000) {
          const pulse = 1 - ((Date.now() - stats.lastBlockTime) / 3000);
          ctx.strokeStyle = `hsla(45, 100%, 60%, ${pulse * 0.8})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(2, 2, w - 4, h - 4);
        }
      } else {
        if (f % 60 === 0) {
          ctx.fillStyle = "rgba(0,0,0,0.9)";
          ctx.fillRect(0, 0, w, h);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [stats.isActive, stats.currentPhiBoost, stats.lastBlockTime]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className="w-full h-20 rounded border border-white/10"
      style={{ imageRendering: "pixelated" }}
      data-testid="miner-visualization"
    />
  );
}

export function BackgroundMiner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localStats, setLocalStats] = useState<MiningStats | null>(null);

  const { data: stats, isLoading } = useQuery<MiningStats>({
    queryKey: ["/api/mining/status"],
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isActive ? 5000 : 30000;
    },
  });

  const { data: network } = useQuery<{ activeMiners: number }>({
    queryKey: ["/api/mining/network"],
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (stats) setLocalStats(stats);
  }, [stats]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/start");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/network"] });
      toast({ title: "Mining Started", description: "Background PoW mining is now active. Earning SKYNT automatically." });
      if (data.stats) setLocalStats(data.stats);
    },
    onError: (err: Error) => {
      const msg = err.message.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(msg);
        toast({ title: "Cannot Start Mining", description: parsed.message, variant: "destructive" });
      } catch {
        toast({ title: "Cannot Start Mining", description: msg, variant: "destructive" });
      }
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/stop");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/network"] });
      const earned = data.stats?.totalSkyntEarned?.toFixed(4) || "0";
      toast({ title: "Mining Stopped", description: `Session ended. Total earned: ${earned} SKYNT` });
      if (data.stats) setLocalStats(data.stats);
    },
  });

  const active = localStats?.isActive || stats?.isActive || false;
  const displayStats = localStats || stats;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-500 ${active ? "border-neon-green/40 bg-neon-green/5 shadow-[0_0_20px_rgba(0,255,100,0.1)]" : "border-white/10 bg-white/5"}`} data-testid="background-miner">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Pickaxe className={`w-4 h-4 ${active ? "text-neon-green animate-pulse" : "text-muted-foreground"}`} />
          <span className="font-heading text-sm tracking-widest text-foreground">BACKGROUND MINER</span>
          <Badge variant="outline" className={`text-[9px] ${active ? "border-neon-green/40 text-neon-green" : "text-muted-foreground"}`}>
            {active ? "ACTIVE" : "IDLE"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {network && (
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1" data-testid="text-active-miners">
              <Users className="w-3 h-3" /> {network.activeMiners} miners
            </span>
          )}
          <Button
            size="sm"
            data-testid={active ? "button-stop-mining" : "button-start-mining"}
            className={`h-7 px-3 text-[10px] font-heading tracking-wider ${
              active
                ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
                : "bg-neon-green/20 border border-neon-green/40 text-neon-green hover:bg-neon-green/30"
            }`}
            onClick={() => active ? stopMutation.mutate() : startMutation.mutate()}
            disabled={startMutation.isPending || stopMutation.isPending || isLoading}
          >
            {active ? (
              <><PowerOff className="w-3 h-3 mr-1" /> STOP</>
            ) : (
              <><Power className="w-3 h-3 mr-1" /> START</>
            )}
          </Button>
        </div>
      </div>

      {displayStats && (active || displayStats.blocksFound > 0) && (
        <div className="p-4 space-y-3">
          <MinerVisualization stats={displayStats} />

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/30 rounded p-2 border border-white/5">
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-1"><Cpu className="w-3 h-3" /> HASH RATE</div>
              <div className="font-mono text-sm text-neon-cyan" data-testid="text-hash-rate">{displayStats.hashRate} H/s</div>
            </div>
            <div className="bg-black/30 rounded p-2 border border-white/5">
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-1"><Hash className="w-3 h-3" /> BLOCKS</div>
              <div className="font-mono text-sm text-neon-orange" data-testid="text-blocks-found">{displayStats.blocksFound}</div>
            </div>
            <div className="bg-black/30 rounded p-2 border border-white/5">
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-1"><Coins className="w-3 h-3" /> EARNED</div>
              <div className="font-mono text-sm text-neon-green" data-testid="text-skynt-earned">{displayStats.totalSkyntEarned.toFixed(4)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 rounded p-2 border border-white/5">
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-1"><Zap className="w-3 h-3" /> Φ BOOST</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-amber-400" data-testid="text-phi-boost">{displayStats.currentPhiBoost.toFixed(3)}x</span>
                <Progress value={Math.min(100, (displayStats.currentPhiBoost / 2.0) * 100)} className="flex-1 h-1.5" />
              </div>
            </div>
            <div className="bg-black/30 rounded p-2 border border-white/5">
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-1"><TrendingUp className="w-3 h-3" /> DIFFICULTY</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-foreground" data-testid="text-difficulty">{displayStats.difficulty.toFixed(2)}</span>
                <Progress value={Math.min(100, displayStats.difficulty * 20)} className="flex-1 h-1.5" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1" data-testid="text-uptime"><Clock className="w-3 h-3" /> {formatUptime(displayStats.uptimeSeconds)}</span>
            <span className="flex items-center gap-1" data-testid="text-cycles"><Activity className="w-3 h-3" /> {displayStats.cyclesCompleted} cycles</span>
            <span data-testid="text-nonces">{displayStats.noncesChecked.toLocaleString()} nonces</span>
          </div>

          {displayStats.lastBlockHash && (
            <div className="text-[9px] font-mono text-muted-foreground/60 truncate" data-testid="text-last-hash">
              Last block: 0x{displayStats.lastBlockHash}
            </div>
          )}
        </div>
      )}

      {!active && (!displayStats || displayStats.blocksFound === 0) && (
        <div className="p-4 text-center">
          <Pickaxe className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="font-mono text-xs text-muted-foreground/50 mb-1">Background PoW mining</p>
          <p className="font-mono text-[10px] text-muted-foreground/30">Start mining to earn SKYNT automatically (0.01 SKYNT/cycle fee)</p>
        </div>
      )}
    </div>
  );
}
