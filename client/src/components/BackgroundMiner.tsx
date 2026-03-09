import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Pickaxe, Power, PowerOff, Cpu, Zap, TrendingUp, Coins, Activity,
  Hash, Clock, Users, Send, Wallet, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
} from "lucide-react";

interface AutoPayoutConfig {
  enabled: boolean;
  externalWallet: string;
  threshold: number;
  pendingAmount: number;
  totalPaidOut: number;
  lastPayoutTime: number;
  payoutCount: number;
  payoutHistory: PayoutRecord[];
}

interface PayoutRecord {
  amount: number;
  fee: number;
  netAmount: number;
  toAddress: string;
  txHash: string;
  timestamp: number;
}

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
  autoPayout: AutoPayoutConfig;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

    if (!stats.isActive) {
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let lastFrameTime = 0;
    const targetInterval = 1000 / 30;

    const draw = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTime;
      if (elapsed < targetInterval) {
        animId = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = timestamp - (elapsed % targetInterval);

      frameRef.current++;
      const f = frameRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const cols = 32;
      ctx.font = "10px monospace";
      for (let i = 0; i < cols; i++) {
        const x = (i / cols) * w;
        const speed = 0.5 + (Math.sin(i * 0.7) * 0.3);
        const y = ((f * speed + i * 17) % (h + 20)) - 10;
        const char = Math.random() > 0.5 ? "1" : "0";
        ctx.fillStyle = `hsla(${150 + Math.sin(f * 0.02 + i) * 30}, 100%, ${50 + Math.sin(f * 0.05 + i * 0.3) * 20}%, ${0.3 + Math.random() * 0.4})`;
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

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
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

function AutoPayoutPanel({ stats }: { stats: MiningStats }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [threshold, setThreshold] = useState("");
  const ap = stats.autoPayout;

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/mining/auto-payout", { enabled });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      toast({
        title: data.config?.enabled ? "Auto-Payout Enabled" : "Auto-Payout Disabled",
        description: data.config?.enabled
          ? `Rewards above ${data.config.threshold} SKYNT will be sent to your connected wallet.`
          : "Mining rewards will stay in your internal wallet.",
      });
    },
    onError: (err: Error) => {
      const msg = err.message.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(msg);
        toast({ title: "Auto-Payout Error", description: parsed.message, variant: "destructive" });
      } catch {
        toast({ title: "Auto-Payout Error", description: msg, variant: "destructive" });
      }
    },
  });

  const thresholdMutation = useMutation({
    mutationFn: async (newThreshold: number) => {
      const res = await apiRequest("POST", "/api/mining/auto-payout", { threshold: newThreshold });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      toast({ title: "Threshold Updated", description: `Auto-payout threshold set to ${data.config?.threshold} SKYNT` });
      setThreshold("");
    },
    onError: (err: Error) => {
      const msg = err.message.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(msg);
        toast({ title: "Error", description: parsed.message, variant: "destructive" });
      } catch {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
  });

  const hasLinkedWallet = !!user?.walletAddress;

  return (
    <div className="border-t border-white/10">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-autopayout-panel"
      >
        <div className="flex items-center gap-2">
          <Send className={`w-3.5 h-3.5 ${ap.enabled ? "text-neon-green" : "text-muted-foreground"}`} />
          <span className="font-heading text-[11px] tracking-widest text-foreground">AUTO-PAYOUT</span>
          {ap.enabled && (
            <Badge variant="outline" className="text-[8px] border-neon-green/40 text-neon-green px-1.5 py-0">
              ON
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ap.pendingAmount > 0 && (
            <span className="text-[9px] font-mono text-amber-400" data-testid="text-pending-payout">
              {ap.pendingAmount.toFixed(4)} pending
            </span>
          )}
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {!hasLinkedWallet ? (
            <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-[10px] font-mono">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Link an external wallet first to enable auto-payout. Go to the Wallet page.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono text-muted-foreground">Send rewards to connected wallet</div>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-primary/70">
                    <Wallet className="w-3 h-3" />
                    <span data-testid="text-payout-wallet">{shortAddr(ap.externalWallet || user?.walletAddress || "")}</span>
                  </div>
                </div>
                <Switch
                  data-testid="switch-autopayout"
                  checked={ap.enabled}
                  onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                  disabled={toggleMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-black/30 rounded p-2 border border-white/5">
                  <div className="text-[8px] font-mono text-muted-foreground mb-0.5">THRESHOLD</div>
                  <div className="font-mono text-[11px] text-foreground" data-testid="text-payout-threshold">{ap.threshold} SKYNT</div>
                </div>
                <div className="bg-black/30 rounded p-2 border border-white/5">
                  <div className="text-[8px] font-mono text-muted-foreground mb-0.5">TOTAL SENT</div>
                  <div className="font-mono text-[11px] text-neon-green" data-testid="text-total-paid">{ap.totalPaidOut.toFixed(4)}</div>
                </div>
                <div className="bg-black/30 rounded p-2 border border-white/5">
                  <div className="text-[8px] font-mono text-muted-foreground mb-0.5">PAYOUTS</div>
                  <div className="font-mono text-[11px] text-foreground" data-testid="text-payout-count">{ap.payoutCount}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-payout-threshold"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder={`${ap.threshold}`}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="h-7 text-[10px] font-mono bg-black/30 border-white/10 flex-1"
                />
                <Button
                  data-testid="button-set-threshold"
                  size="sm"
                  className="h-7 px-3 text-[9px] font-heading bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                  disabled={!threshold || thresholdMutation.isPending}
                  onClick={() => {
                    const val = parseFloat(threshold);
                    if (val >= 0.1) thresholdMutation.mutate(val);
                  }}
                >
                  SET
                </Button>
              </div>

              {ap.payoutHistory.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-muted-foreground">RECENT PAYOUTS</div>
                  {ap.payoutHistory.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-black/20 rounded px-2 py-1.5 border border-white/5">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-neon-green" />
                        <span className="text-[9px] font-mono text-neon-green" data-testid={`text-payout-amount-${i}`}>
                          {p.netAmount.toFixed(4)} SKYNT
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground">
                        <span>→ {shortAddr(p.toAddress)}</span>
                        <span>{new Date(p.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {ap.enabled && ap.pendingAmount > 0 && (
                <div className="flex items-center gap-2 text-[9px] font-mono text-amber-400/80">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span data-testid="text-pending-info">
                    Accumulating: {ap.pendingAmount.toFixed(4)} / {ap.threshold} SKYNT until next payout
                  </span>
                </div>
              )}

              <div className="text-[8px] font-mono text-muted-foreground/50">
                0.5% network fee per payout · Min threshold: 0.1 SKYNT
              </div>
            </>
          )}
        </div>
      )}
    </div>
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

      {displayStats && <AutoPayoutPanel stats={displayStats} />}
    </div>
  );
}
