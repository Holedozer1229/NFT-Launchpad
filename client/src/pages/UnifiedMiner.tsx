import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { useEngineStream } from "@/hooks/use-engine-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Cpu, Zap, Activity, TrendingUp, RotateCcw, Play, Square,
  Pickaxe, Power, PowerOff, Hash, Coins, Clock, Users, Send, Wallet,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Atom, Radio,
  Layers, GitBranch, Orbit, Network, Shield, CircleDot, ArrowUpRight,
  Fuel, Waves, Database, RefreshCw, Flame, Vault, Trophy, Terminal,
  Wifi, WifiOff, Star, Crown, Bell, Download
} from "lucide-react";
import { MERGE_MINING_CHAINS, STX_LENDING_TIERS, type MergeMiningChainId, type StxLendingTierId } from "@shared/schema";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function fmtUptime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function shortAddr(a: string) { return a?.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—"; }
function short(s: string | null | undefined, n = 14) { if (!s) return "—"; return s.slice(0, n) + "…"; }

const NEON = { cyan: "#00f0ff", green: "#39ff14", magenta: "#ff00ff", gold: "#ffd700", orange: "#ff6b00", blue: "#4d7cff", purple: "#a855f7", red: "#ff3b3b" };
const CHAIN_NEON: Record<string, string> = { auxpow_btc: NEON.gold, eth_merge: NEON.blue, zk_rollup: NEON.purple, stx_pox: NEON.orange, btc_fork: NEON.cyan };

const PHASE_META: Record<string, { label: string; color: string; icon: typeof Flame }> = {
  bootstrap:    { label: "Bootstrap",    color: "text-orange-400",  icon: Flame },
  vault_active: { label: "Vault Active", color: "text-violet-400",  icon: Vault },
  harvesting:   { label: "Harvesting",   color: "text-emerald-400", icon: RefreshCw },
  cloning:      { label: "Cloning",      color: "text-sky-400",     icon: Database },
};

// ─── Shared canvas helpers ─────────────────────────────────────────────────────

function BinaryRainCanvas({ active, hue = 150 }: { active: boolean; hue?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let id: number;
    let last = 0;
    const draw = (ts: number) => {
      if (ts - last < 33) { id = requestAnimationFrame(draw); return; }
      last = ts; frame.current++;
      const f = frame.current, w = canvas.width, h = canvas.height;
      ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(0, 0, w, h);
      const cols = 28; ctx.font = "10px monospace";
      for (let i = 0; i < cols; i++) {
        const x = (i / cols) * w;
        const y = ((f * (0.5 + Math.sin(i * 0.7) * 0.3) + i * 17) % (h + 20)) - 10;
        const ch = active ? Math.floor(Math.random() * 16).toString(16).toUpperCase() : Math.random() > 0.5 ? "1" : "0";
        ctx.fillStyle = `hsla(${active ? (f * 2 + i * 12) % 360 : hue}, ${active ? 100 : 60}%, 60%, ${active ? 0.4 + Math.random() * 0.5 : 0.12})`;
        ctx.fillText(ch, x, y);
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [active, hue]);
  return <canvas ref={ref} width={320} height={80} className="w-full h-20 rounded border border-white/10" style={{ imageRendering: "pixelated" }} />;
}

function DysonCanvas({ boost, equilibrium, epoch }: { boost: number; equilibrium: number; epoch: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let id: number;
    const W = canvas.width = canvas.offsetWidth, H = canvas.height = canvas.offsetHeight;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.33;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
      g.addColorStop(0, "rgba(0,30,60,0.9)"); g.addColorStop(1, "rgba(0,5,15,0.95)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const rings = 5;
      for (let r = 0; r < rings; r++) {
        const radius = R * (0.3 + r * 0.175);
        const tilt = (Math.PI / 6) * (r % 2 === 0 ? 1 : -1);
        const speed = (0.3 + r * 0.1) * boost;
        const angle = t * 0.001 * speed;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * Math.abs(Math.sin(tilt + angle * 0.3)), angle, 0, Math.PI * 2);
        const hue = 180 + r * 30;
        ctx.strokeStyle = `hsla(${hue}, 90%, ${50 + equilibrium * 15}%, ${0.3 + equilibrium * 0.3})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
      const starCount = 40;
      for (let i = 0; i < starCount; i++) {
        const a = (i / starCount) * Math.PI * 2 + t * 0.0003;
        const dist = R * 0.2 + (i % 5) * R * 0.12;
        const x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist * 0.5;
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${200 + i * 5}, 100%, 80%, ${0.4 + Math.sin(t * 0.003 + i) * 0.3})`;
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.12, 0, Math.PI * 2);
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.12);
      sg.addColorStop(0, `rgba(255,220,100,${0.8 + equilibrium * 0.2})`);
      sg.addColorStop(1, "rgba(255,120,0,0)");
      ctx.fillStyle = sg; ctx.fill();
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [boost, equilibrium, epoch]);
  return <canvas ref={ref} className="w-full h-full" style={{ display: "block" }} />;
}

// ─── AutoPayout panel (reused from BackgroundMiner) ────────────────────────────

interface AutoPayoutConfig { enabled: boolean; externalWallet: string; threshold: number; pendingAmount: number; totalPaidOut: number; payoutCount: number; payoutHistory: { amount: number; fee: number; netAmount: number; toAddress: string; txHash: string; timestamp: number }[] }
interface MiningStats { isActive: boolean; hashRate: number; blocksFound: number; totalSkyntEarned: number; currentPhiBoost: number; cyclesCompleted: number; lastBlockHash: string; lastBlockTime: number; sessionStartedAt: number; uptimeSeconds: number; difficulty: number; noncesChecked: number; autoPayout: AutoPayoutConfig }

function AutoPayoutPanel({ stats }: { stats: MiningStats }) {
  const { toast } = useToast(); const { user } = useAuth(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [threshold, setThreshold] = useState(""); const ap = stats.autoPayout;
  const toggle = useMutation({ mutationFn: (en: boolean) => apiRequest("POST", "/api/mining/auto-payout", { enabled: en }).then(r => r.json()), onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["/api/mining/status"] }); toast({ title: d.config?.enabled ? "Auto-Payout ON" : "Auto-Payout OFF" }); } });
  const setThr = useMutation({ mutationFn: (v: number) => apiRequest("POST", "/api/mining/auto-payout", { threshold: v }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/mining/status"] }); setThreshold(""); toast({ title: "Threshold updated" }); } });
  return (
    <div className="border-t border-white/10 mt-2">
      <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors" onClick={() => setOpen(!open)} data-testid="button-toggle-autopayout-panel">
        <div className="flex items-center gap-2"><Send className={`w-3.5 h-3.5 ${ap.enabled ? "text-neon-green" : "text-muted-foreground"}`} /><span className="font-heading text-[11px] tracking-widest">AUTO-PAYOUT</span>{ap.enabled && <Badge variant="outline" className="text-[8px] border-neon-green/40 text-neon-green px-1">ON</Badge>}</div>
        <div className="flex items-center gap-2">{ap.pendingAmount > 0 && <span className="text-[9px] font-mono text-amber-400">{ap.pendingAmount.toFixed(4)} pending</span>}{open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}</div>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-3">
          {!user?.walletAddress ? <p className="text-[10px] font-mono text-amber-400 p-2 bg-amber-500/10 rounded border border-amber-500/20">Link a wallet first to enable auto-payout</p> : (
            <>
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-mono text-muted-foreground">Send to: <span className="text-primary/70">{shortAddr(ap.externalWallet || user?.walletAddress || "")}</span></p></div><Switch checked={ap.enabled} onCheckedChange={v => toggle.mutate(v)} disabled={toggle.isPending} data-testid="switch-autopayout" /></div>
              <div className="grid grid-cols-3 gap-2">
                {[["THRESHOLD", `${ap.threshold} SKYNT`, "text-foreground"], ["TOTAL SENT", ap.totalPaidOut.toFixed(4), "text-neon-green"], ["PAYOUTS", String(ap.payoutCount), "text-foreground"]].map(([l, v, c]) => <div key={l} className="bg-black/30 rounded p-2 border border-white/5"><p className="text-[8px] font-mono text-muted-foreground">{l}</p><p className={`font-mono text-[11px] ${c}`}>{v}</p></div>)}
              </div>
              <div className="flex gap-2"><Input type="number" step="0.1" min="0.1" placeholder={`${ap.threshold}`} value={threshold} onChange={e => setThreshold(e.target.value)} className="h-7 text-[10px] font-mono bg-black/30 border-white/10" data-testid="input-payout-threshold" /><Button size="sm" className="h-7 px-3 text-[9px]" disabled={!threshold} onClick={() => { const v = parseFloat(threshold); if (v >= 0.1) setThr.mutate(v); }} data-testid="button-set-threshold">SET</Button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB 1: SKYNT YIELD (background PoW miner) ────────────────────────────────

function SkyYieldTab() {
  const { toast } = useToast(); const qc = useQueryClient();
  const [local, setLocal] = useState<MiningStats | null>(null);
  const { data: stats, isLoading } = useQuery<MiningStats>({ queryKey: ["/api/mining/status"], refetchInterval: d => d.state.data?.isActive ? 5000 : 30000 });
  const { data: network } = useQuery<{ activeMiners: number }>({ queryKey: ["/api/mining/network"], refetchInterval: 15000 });
  const { on } = useEngineStream();
  useEffect(() => { if (stats) setLocal(stats); }, [stats]);
  useEffect(() => on("miner:block_found", () => { qc.invalidateQueries({ queryKey: ["/api/mining/status"] }); haptic("mining-block"); }), [on, qc]);
  const start = useMutation({ mutationFn: () => apiRequest("POST", "/api/mining/start").then(r => r.json()), onSuccess: (d: any) => { localStorage.setItem("skynt_mining_started", "1"); qc.invalidateQueries({ queryKey: ["/api/mining/status"] }); toast({ title: "Mining Started", description: "Earning SKYNT automatically" }); if (d.stats) setLocal(d.stats); } });
  const stop = useMutation({ mutationFn: () => apiRequest("POST", "/api/mining/stop").then(r => r.json()), onSuccess: (d: any) => { localStorage.removeItem("skynt_mining_started"); qc.invalidateQueries({ queryKey: ["/api/mining/status"] }); const earned = d.stats?.totalSkyntEarned?.toFixed(4) || "0"; toast({ title: "Mining Stopped", description: `Total earned: ${earned} SKYNT` }); if (d.stats) setLocal(d.stats); } });
  const active = local?.isActive || stats?.isActive || false;
  const s = local || stats;
  return (
    <div className="space-y-4">
      {/* Control card */}
      <Card className={`border transition-all duration-500 ${active ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(0,255,100,0.08)]" : "border-white/10 bg-card/50"}`} data-testid="card-sky-yield">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Pickaxe className={`w-4 h-4 ${active ? "text-emerald-400 animate-pulse" : "text-muted-foreground"}`} />
            <span className="font-heading text-sm tracking-widest">SKYNT YIELD MINER</span>
            <Badge variant="outline" className={`text-[9px] ${active ? "border-emerald-500/40 text-emerald-400" : "text-muted-foreground"}`}>{active ? "ACTIVE" : "IDLE"}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {network && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1" data-testid="text-active-miners"><Users className="w-3 h-3" /> {network.activeMiners} miners</span>}
            <Button size="sm" data-testid={active ? "button-stop-mining" : "button-start-mining"} className={`h-8 px-4 text-[11px] font-heading tracking-wider ${active ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30" : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"}`} onClick={() => active ? stop.mutate() : start.mutate()} disabled={start.isPending || stop.isPending || isLoading}>{active ? <><PowerOff className="w-3.5 h-3.5 mr-1" /> STOP</> : <><Power className="w-3.5 h-3.5 mr-1" /> START</>}</Button>
          </div>
        </div>
        {s && (active || s.blocksFound > 0) ? (
          <div className="p-4 space-y-4">
            <BinaryRainCanvas active={active} hue={150} />
            <div className="grid grid-cols-3 gap-3">
              {[["HASH RATE", `${s.hashRate} H/s`, "text-cyan-400", "text-hash-rate"], ["BLOCKS", String(s.blocksFound), "text-orange-400", "text-blocks-found"], ["EARNED", `${s.totalSkyntEarned.toFixed(4)} ◈`, "text-emerald-400", "text-skynt-earned"]].map(([l, v, c, dt]) => (
                <div key={l} className="bg-black/30 rounded-lg p-3 border border-white/5">
                  <p className="text-[9px] font-mono text-muted-foreground mb-1">{l}</p>
                  <p className={`font-mono text-sm font-bold ${c}`} data-testid={dt}>{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                <p className="text-[9px] font-mono text-muted-foreground mb-1.5">Φ BOOST</p>
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-amber-400" data-testid="text-phi-boost">{s.currentPhiBoost.toFixed(3)}x</span><Progress value={Math.min(100, (s.currentPhiBoost / 2) * 100)} className="flex-1 h-1.5" /></div>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                <p className="text-[9px] font-mono text-muted-foreground mb-1.5">DIFFICULTY</p>
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-foreground" data-testid="text-difficulty">{s.difficulty.toFixed(2)}</span><Progress value={Math.min(100, s.difficulty * 20)} className="flex-1 h-1.5" /></div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              <span data-testid="text-uptime" className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtUptime(s.uptimeSeconds)}</span>
              <span data-testid="text-cycles" className="flex items-center gap-1"><Activity className="w-3 h-3" />{s.cyclesCompleted} cycles</span>
              <span data-testid="text-nonces">{s.noncesChecked.toLocaleString()} nonces</span>
            </div>
            {s.lastBlockHash && <p className="text-[9px] font-mono text-muted-foreground/50 truncate" data-testid="text-last-hash">Last block: 0x{s.lastBlockHash}</p>}
          </div>
        ) : (
          <div className="p-8 text-center"><Pickaxe className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" /><p className="font-mono text-xs text-muted-foreground/40">Start mining to earn SKYNT automatically · 0.01 SKYNT/cycle fee</p></div>
        )}
        {s && <AutoPayoutPanel stats={s} />}
      </Card>

      {/* Leaderboard */}
      <LeaderboardCard />
    </div>
  );
}

function LeaderboardCard() {
  const { data: lb } = useQuery<Array<{ username: string; blocks: number; earned: number; bestStreak: number }>>({ queryKey: ["/api/mining/leaderboard"], refetchInterval: 30000 });
  if (!lb?.length) return null;
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-mono text-foreground flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" />Mining Leaderboard</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow className="border-border/30"><TableHead className="text-[10px]">Rank</TableHead><TableHead className="text-[10px]">Miner</TableHead><TableHead className="text-[10px] text-right">Blocks</TableHead><TableHead className="text-[10px] text-right">Earned (◈)</TableHead><TableHead className="text-[10px] text-right">Best Streak</TableHead></TableRow></TableHeader>
          <TableBody>
            {lb.slice(0, 10).map((m, i) => (
              <TableRow key={m.username} className="border-border/20" data-testid={`row-leaderboard-${i}`}>
                <TableCell className="text-[11px] font-mono">{i === 0 ? <Crown className="w-3.5 h-3.5 text-yellow-400" /> : i === 1 ? <Star className="w-3.5 h-3.5 text-zinc-300" /> : <span className="text-muted-foreground">#{i + 1}</span>}</TableCell>
                <TableCell className="text-[11px] font-mono font-medium">{m.username}</TableCell>
                <TableCell className="text-[11px] font-mono text-right text-orange-400">{m.blocks}</TableCell>
                <TableCell className="text-[11px] font-mono text-right text-emerald-400">{m.earned.toFixed(4)}</TableCell>
                <TableCell className="text-[11px] font-mono text-right text-cyan-400">{m.bestStreak}x</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── TAB 2: GENESIS BTC (merge mining) ────────────────────────────────────────

function GenesisBtcTab() {
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: status } = useQuery<{ mergeMining: Record<string, any>; randomx: any }>({ queryKey: ["/api/merge-mine/status"], refetchInterval: 5000 });
  const { data: mempool } = useQuery<{ blockHeight: number; fees: { fastest: number; halfHour: number; economy: number }; totalFee: number }>({ queryKey: ["/api/mempool/stats"], refetchInterval: 30000 });
  const { data: genesisInfo } = useQuery<{ height: number; hash: string; reward: number; supply: number }>({ queryKey: ["/api/merge-mine/genesis"] });
  const { data: recentBlocks } = useQuery<Array<{ height: number; hash: string; miner: string; reward: number; timestamp: number; algorithm: string }>>({ queryKey: ["/api/merge-mine/blocks/btc_fork"], refetchInterval: 15000 });
  const { data: lendingStatus } = useQuery<{ stakedAmount: number; tierId: string | null; yieldEarned: number }>({ queryKey: ["/api/stx-lending/status"], refetchInterval: 10000 });
  const { data: ethBlock } = useQuery<{ number: number; hash: string; timestamp: number; transactionCount: number }>({ queryKey: ["/api/chain/ethereum/block/latest"], refetchInterval: 12000 });

  const startChain = useMutation({ mutationFn: (chainId: string) => apiRequest("POST", "/api/merge-mine/start", { chainId }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/merge-mine/status"] }); toast({ title: "Merge mining started" }); haptic("success"); } });
  const stopChain = useMutation({ mutationFn: (chainId: string) => apiRequest("POST", "/api/merge-mine/stop", { chainId }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/merge-mine/status"] }); toast({ title: "Chain mining stopped" }); } });
  const stakeSTX = useMutation({ mutationFn: (tierId: string) => apiRequest("POST", "/api/stx-lending/stake", { tierId, amount: 100 }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/stx-lending/status"] }); toast({ title: "STX Staked" }); haptic("success"); } });

  const activeCount = Object.values(status?.mergeMining ?? {}).filter((v: any) => v.isActive).length;

  return (
    <div className="space-y-5">
      {/* Genesis block info */}
      {genesisInfo && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-2"><span className="text-[10px] font-mono text-muted-foreground">GENESIS BLOCK</span><span className="font-mono text-xs text-yellow-400">#{genesisInfo.height}</span></div>
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <div className="flex items-center gap-2"><span className="text-[10px] font-mono text-muted-foreground">SUPPLY</span><span className="font-mono text-xs text-emerald-400">{genesisInfo.supply?.toLocaleString()} ◈</span></div>
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <div className="flex items-center gap-2"><span className="text-[10px] font-mono text-muted-foreground">COINBASE</span><span className="font-mono text-xs text-cyan-400">{genesisInfo.reward} ◈</span></div>
          {mempool && <><Separator orientation="vertical" className="h-5 hidden sm:block" /><div className="flex items-center gap-2"><span className="text-[10px] font-mono text-muted-foreground">BTC HEIGHT</span><span className="font-mono text-xs text-foreground">#{mempool.blockHeight}</span></div></>}
          {ethBlock && <><Separator orientation="vertical" className="h-5 hidden sm:block" /><div className="flex items-center gap-2"><span className="text-[10px] font-mono text-muted-foreground">ETH HEIGHT</span><span className="font-mono text-xs text-blue-400">#{ethBlock.number}</span></div></>}
        </div>
      )}

      {/* Merge mining chains */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Merge Mining Chains</h3>
          <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">{activeCount} / {MERGE_MINING_CHAINS.length} active</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MERGE_MINING_CHAINS.map((chain) => {
            const cs = status?.mergeMining?.[chain.id];
            const color = CHAIN_NEON[chain.id] ?? NEON.cyan;
            return (
              <Card key={chain.id} className="border-border/50 bg-card/60 relative overflow-hidden" data-testid={`card-chain-${chain.id}`}>
                <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div><p className="font-heading text-sm font-bold" style={{ color }}>{chain.name}</p><p className="text-[10px] font-mono text-muted-foreground">{chain.algorithm}</p></div>
                    <Badge className={`text-[10px] ${cs?.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"}`}>{cs?.isActive ? "ACTIVE" : "IDLE"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div><span className="text-muted-foreground">Hash Rate</span><p style={{ color }}>{cs?.hashRate?.toFixed(0) ?? "0"} H/s</p></div>
                    <div><span className="text-muted-foreground">Blocks</span><p className="text-foreground">{cs?.blocksFound ?? 0}</p></div>
                    <div><span className="text-muted-foreground">Reward/Block</span><p className="text-emerald-400">{chain.rewardPerBlock} ◈</p></div>
                    <div><span className="text-muted-foreground">Earned</span><p className="text-emerald-400">{(cs?.rewardsEarned ?? 0).toFixed(4)} ◈</p></div>
                  </div>
                  <Button size="sm" className="w-full h-7 text-[10px] font-heading" style={cs?.isActive ? { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)", color: "#f87171" } : { backgroundColor: `${color}18`, borderColor: `${color}40`, color }} variant="outline" onClick={() => cs?.isActive ? stopChain.mutate(chain.id) : startChain.mutate(chain.id)} disabled={startChain.isPending || stopChain.isPending} data-testid={`button-chain-${chain.id}`}>{cs?.isActive ? "Stop Chain" : `Mine ${chain.name}`}</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* STX Lending */}
      <div>
        <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">STX Cross-Chain Lending</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STX_LENDING_TIERS.map((tier) => (
            <Card key={tier.id} className={`border-border/50 bg-card/60 ${lendingStatus?.tierId === tier.id ? "border-orange-500/40" : ""}`} data-testid={`card-stx-tier-${tier.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between"><p className="font-heading text-sm text-orange-400">{tier.name}</p><Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-400">{tier.apr}% APR</Badge></div>
                <p className="text-[10px] font-mono text-muted-foreground">{tier.lockDays}-day lock · PoX bonus: {tier.poxBonus}%</p>
                <Button size="sm" className="w-full h-7 text-[10px] bg-orange-500/15 border border-orange-500/40 text-orange-400 hover:bg-orange-500/25" disabled={stakeSTX.isPending || lendingStatus?.tierId === tier.id} onClick={() => stakeSTX.mutate(tier.id)} data-testid={`button-stake-${tier.id}`}>{lendingStatus?.tierId === tier.id ? "STAKED" : `Stake 100 STX (${tier.id})`}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {lendingStatus?.tierId && (
          <div className="mt-3 flex items-center gap-4 p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 text-[11px] font-mono">
            <span className="text-muted-foreground">Staked:</span><span className="text-orange-400">{lendingStatus.stakedAmount} STX</span>
            <span className="text-muted-foreground">Yield Earned:</span><span className="text-emerald-400">{lendingStatus.yieldEarned?.toFixed(4)} STX</span>
          </div>
        )}
      </div>

      {/* Recent blocks */}
      {recentBlocks && recentBlocks.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-mono flex items-center gap-2"><Hash className="w-4 h-4 text-cyan-400" />Recent SKYNT Genesis Blocks</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-border/30"><TableHead className="text-[10px]">Height</TableHead><TableHead className="text-[10px]">Hash</TableHead><TableHead className="text-[10px]">Miner</TableHead><TableHead className="text-[10px] text-right">Reward</TableHead><TableHead className="text-[10px]">Algo</TableHead></TableRow></TableHeader>
              <TableBody>
                {recentBlocks.slice(0, 8).map((b, i) => (
                  <TableRow key={i} className="border-border/20" data-testid={`row-block-${i}`}>
                    <TableCell className="text-[10px] font-mono text-cyan-400">#{b.height}</TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">{b.hash?.slice(0, 14)}…</TableCell>
                    <TableCell className="text-[10px] font-mono">{b.miner}</TableCell>
                    <TableCell className="text-[10px] font-mono text-right text-emerald-400">{b.reward} ◈</TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">{b.algorithm}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── TAB 3: BTC ZK DAEMON ─────────────────────────────────────────────────────

interface DaemonStatus { running: boolean; epoch: number; uptime: number; blocksFound: number; totalStxYield: number; hashRate: number; bestXi: number; epochWinRate: number; xiPassRate: number; networkDifficulty: number; mempoolFeeRate: number; moneroIntegrated: boolean; stacksYieldActive: boolean; lastEpoch: any | null }
interface SentinelStatus { running: boolean; phase: string; gasReserveEth: number; totalYieldAllocated: number; totalEthFunded: number; sentinelTriggers: number; isHealthy: boolean; isCritical: boolean; projectedRunwayEpochs: number; fundingEvents: any[] }

function XiBadge({ xi, passed }: { xi: number; passed: boolean }) {
  const c = passed ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : Math.abs(xi - 1) < 0.05 ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" : "bg-red-500/20 text-red-300 border-red-500/40";
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${c}`}>{passed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}ξ={xi.toFixed(4)}</span>;
}

function BtcZkTab() {
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: status, isLoading } = useQuery<DaemonStatus>({ queryKey: ["/api/btc-zk-daemon/status"], refetchInterval: 8000 });
  const { data: epochs } = useQuery<any[]>({ queryKey: ["/api/btc-zk-daemon/epochs"], refetchInterval: 15000 });
  const { data: sentinel } = useQuery<SentinelStatus>({ queryKey: ["/api/self-fund/status"], refetchInterval: 10000 });
  const { on } = useEngineStream();
  useEffect(() => on("btc_zk:epoch_result", () => { qc.invalidateQueries({ queryKey: ["/api/btc-zk-daemon/status"] }); qc.invalidateQueries({ queryKey: ["/api/btc-zk-daemon/epochs"] }); }), [on, qc]);
  const startMut = useMutation({ mutationFn: () => apiRequest("POST", "/api/btc-zk-daemon/start"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/btc-zk-daemon/status"] }); toast({ title: "BTC ZK Daemon started", description: "Valknut v9 AuxPoW active" }); haptic("success"); } });
  const stopMut = useMutation({ mutationFn: () => apiRequest("POST", "/api/btc-zk-daemon/stop"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/btc-zk-daemon/status"] }); toast({ title: "Daemon stopped" }); } });
  const last = status?.lastEpoch;
  const phaseMeta = PHASE_META[sentinel?.phase ?? "bootstrap"] ?? PHASE_META.bootstrap;
  const PhaseIcon = phaseMeta.icon;
  return (
    <div className="space-y-5">
      {/* Status + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center"><Cpu className="w-5 h-5 text-orange-400" /></div>
          <div><p className="font-heading text-lg font-bold">BTC AuxPoW ZK Miner</p><p className="text-[10px] font-mono text-muted-foreground">Monero RandomX → Bitcoin AuxPoW → zkSync Era → Self-Funding Gas</p></div>
        </div>
        <div className="flex items-center gap-3">
          {status?.running ? <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 gap-1.5"><CircleDot className="w-3 h-3 animate-pulse" />LIVE</Badge> : <Badge className="bg-zinc-700/40 text-zinc-400 border border-zinc-600/40 gap-1.5"><CircleDot className="w-3 h-3" />OFFLINE</Badge>}
          <Button data-testid="btn-daemon-toggle" onClick={() => status?.running ? stopMut.mutate() : startMut.mutate()} disabled={startMut.isPending || stopMut.isPending || isLoading} variant={status?.running ? "destructive" : "default"} size="sm" className="gap-2">{status?.running ? <><Square className="w-3.5 h-3.5" />Stop Daemon</> : <><Play className="w-3.5 h-3.5" />Start Daemon</>}</Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          ["Epoch", status?.epoch ?? 0, Hash, "text-violet-400"],
          ["Blocks", status?.blocksFound ?? 0, Zap, "text-yellow-400"],
          ["Hash Rate", `${((status?.hashRate ?? 0) / 1000).toFixed(1)}k H/s`, Activity, "text-sky-400"],
          ["Best ξ", (status?.bestXi ?? 0).toFixed(4), Atom, "text-pink-400"],
          ["ξ Pass %", `${((status?.xiPassRate ?? 0) * 100).toFixed(0)}%`, Shield, "text-emerald-400"],
          ["Net Diff", `${((status?.networkDifficulty ?? 0) / 1e12).toFixed(1)}T`, Network, "text-orange-400"],
          ["Fee Rate", `${status?.mempoolFeeRate ?? 0} s/vB`, Fuel, "text-cyan-400"],
          ["STX Yield", (status?.totalStxYield ?? 0).toFixed(2), TrendingUp, "text-green-400"],
        ].map(([l, v, Icon, c]: any) => (
          <Card key={l} className="bg-card/60 border-border/50"><CardContent className="p-3"><div className="flex items-center gap-1.5 mb-1"><Icon className={`w-3.5 h-3.5 ${c}`} /><span className="text-[9px] text-muted-foreground uppercase">{l}</span></div><p className={`font-mono text-sm font-bold ${c}`} data-testid={`stat-${String(l).toLowerCase().replace(/\s/g, "-")}`}>{v}</p></CardContent></Card>
        ))}
      </div>

      {/* Integration badges */}
      <div className="flex flex-wrap gap-2">
        <Badge className={status?.moneroIntegrated ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"}>{status?.moneroIntegrated ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}Monero RandomX {status?.moneroIntegrated ? "LIVE" : "Simulated"}</Badge>
        <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40"><Zap className="w-3 h-3 mr-1" />zkSync Era Anchor</Badge>
        <Badge className={status?.stacksYieldActive ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"}>{status?.stacksYieldActive ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}STX Yield {status?.stacksYieldActive ? "ACTIVE" : "KEY NEEDED"}</Badge>
      </div>

      {/* Last epoch + Sentinel side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last epoch */}
        {last && (
          <Card className="border-border/50 bg-card/60" data-testid="card-last-epoch">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-mono flex items-center gap-2"><Hash className="w-4 h-4 text-violet-400" />Last Epoch #{last.epoch}<XiBadge xi={last.valknutXi} passed={last.xiPassed} /></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                {[["Chain Corr", last.chainCorr?.toFixed(4)], ["Lattice Corr", last.latticeCorr?.toFixed(4)], ["Berry Phase", last.berryPhase?.toFixed(4)], ["Dyson Factor", last.dysonFactor?.toFixed(4)], ["Spec Cube", last.specCube?.toFixed(4)], ["Q-Fibonacci", last.qFib?.toFixed(4)]].map(([l, v]) => <div key={l}><p className="text-muted-foreground">{l}</p><p className="text-foreground">{v}</p></div>)}
              </div>
              <div className="p-2 bg-muted/30 rounded text-[9px] font-mono"><p className="text-muted-foreground mb-0.5">AuxPoW Hash</p><p className="text-foreground break-all">{short(last.auxpowHash, 32)}</p></div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground"><span>BTC #{last.btcBlockHeight}</span><span>STX yield: {last.stxYieldRouted?.toFixed(4)}</span><Badge className={`text-[9px] ${last.status === "found" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/20 text-zinc-400"}`}>{last.status}</Badge></div>
            </CardContent>
          </Card>
        )}

        {/* OIYE Sentinel */}
        {sentinel && (
          <Card className={`border ${sentinel.isCritical ? "border-red-500/40" : "border-violet-500/20"} bg-card/60`} data-testid="card-sentinel">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-mono flex items-center gap-2"><PhaseIcon className={`w-4 h-4 ${phaseMeta.color}`} />OIYE Gas Sentinel<Badge className={`ml-auto text-[9px] ${phaseMeta.color} border border-current/30 bg-current/10`}>{phaseMeta.label}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                {[["Gas Reserve", `${sentinel.gasReserveEth?.toFixed(8)} ETH`, sentinel.isCritical ? "text-red-400" : "text-emerald-400"], ["ETH Funded", `${sentinel.totalEthFunded?.toFixed(8)} ETH`, "text-cyan-400"], ["STX Allocated", sentinel.totalYieldAllocated?.toFixed(4), "text-orange-400"], ["Triggers", String(sentinel.sentinelTriggers), "text-foreground"]].map(([l, v, c]) => <div key={l}><p className="text-muted-foreground mb-0.5">{l}</p><p className={`font-bold ${c}`}>{v}</p></div>)}
              </div>
              {sentinel.isCritical && <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-mono"><AlertCircle className="w-3.5 h-3.5 shrink-0" />CRITICAL: Gas reserve exhausted — bootstrap more STX yield</div>}
              <div className="text-[9px] font-mono text-muted-foreground">Runway: {sentinel.projectedRunwayEpochs ?? 0} epochs</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent epochs */}
      {epochs && epochs.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-mono flex items-center gap-2"><Layers className="w-4 h-4 text-violet-400" />Epoch History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-border/30"><TableHead className="text-[10px]">Epoch</TableHead><TableHead className="text-[10px]">ξ</TableHead><TableHead className="text-[10px]">BTC Block</TableHead><TableHead className="text-[10px]">Chain Corr</TableHead><TableHead className="text-[10px]">STX Yield</TableHead><TableHead className="text-[10px]">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {epochs.slice(0, 8).map((ep: any) => (
                  <TableRow key={ep.epoch} className="border-border/20" data-testid={`row-epoch-${ep.epoch}`}>
                    <TableCell className="text-[10px] font-mono text-violet-400">#{ep.epoch}</TableCell>
                    <TableCell><XiBadge xi={ep.valknutXi ?? 0} passed={ep.xiPassed ?? false} /></TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">#{ep.btcBlockHeight}</TableCell>
                    <TableCell className="text-[10px] font-mono text-foreground">{ep.chainCorr?.toFixed(4)}</TableCell>
                    <TableCell className="text-[10px] font-mono text-orange-400">{ep.stxYieldRouted?.toFixed(4)}</TableCell>
                    <TableCell><Badge className={`text-[9px] ${ep.status === "found" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/20 text-zinc-400"}`}>{ep.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── TAB 4: DYSON SPHERE ──────────────────────────────────────────────────────

interface DysonState { primes: number[]; specGaps: number[]; latticeCorr: number; latticeCorrRot: number; quantumGaps: number[]; chainCorrelation: number; finalCorrOrig: number; finalCorrRot: number; eigenvalues: number[]; valknutPassRate: number; hashRateBoost: number; dysonEquilibrium: number; xiTolerance: number; epoch: number; lastUpdate: number }
interface Candidate { index: number; offset: number; xi: number; gap: number; passesFilter: boolean; hashRateBoost: number; dysonEquilibrium: number; berryPhase: number }
interface MineResult { nonce: number | null; blockHash: string | null; xi: number; dysonFactor: number; berryPhase: number; specCube: number; quantumFib: number; valknutPass: boolean; attempts: number; hashRateBoost: number }

function ValknutGauge({ xi, tolerance }: { xi: number; tolerance: number }) {
  const passes = Math.abs(xi - 1) <= tolerance;
  const pct = Math.min(100, ((2 - Math.abs(xi - 1)) / 2) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between"><span className="text-xs font-mono text-muted-foreground">Valknut ξ</span><div className="flex items-center gap-2"><span className="text-xs font-mono">{xi.toFixed(6)}</span><Badge className={`text-[10px] ${passes ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-muted/20 text-muted-foreground"}`}>{passes ? "✓ PASS" : "✗ MISS"}</Badge></div></div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden"><div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: passes ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#3b82f6,#6366f1)" }} /><div className="absolute inset-y-0 w-0.5 bg-yellow-400 opacity-80" style={{ left: "50%" }} /></div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground"><span>0.0</span><span className="text-yellow-400">1.0 ± {tolerance}</span><span>2.0</span></div>
    </div>
  );
}

function SpectralBar({ gaps, label }: { gaps: number[]; label: string }) {
  const max = Math.max(...gaps, 0.01);
  return (
    <div className="space-y-1"><p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-0.5 h-10">{gaps.slice(0, 10).map((g, i) => <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(6, (g / max) * 100)}%`, background: `hsl(${180 + i * 12},80%,${50 + i * 3}%)`, opacity: 0.8 }} title={`${g.toFixed(4)}`} />)}</div>
    </div>
  );
}

function DysonSphereTab() {
  const { toast } = useToast(); const qc = useQueryClient();
  const [mineResult, setMineResult] = useState<MineResult | null>(null);
  const [isMining, setIsMining] = useState(false);
  const { data: state } = useQuery<DysonState>({ queryKey: ["/api/dyson/state"], refetchInterval: 15000 });
  const { data: candidates } = useQuery<Candidate[]>({ queryKey: ["/api/dyson/candidates"], refetchInterval: 30000 });
  const { on } = useEngineStream();
  useEffect(() => on("dyson:evolution", () => { qc.invalidateQueries({ queryKey: ["/api/dyson/state"] }); }), [on, qc]);
  const mineMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dyson/mine", { blockData: `skynt:dyson:${Date.now()}`, maxAttempts: 5000 }),
    onMutate: () => setIsMining(true),
    onSuccess: async (res) => { const r: MineResult = await res.json(); setMineResult(r); setIsMining(false); if (r.valknutPass) { toast({ title: "⚡ Valknut Gate Passed!", description: `ξ=${r.xi.toFixed(5)} — nonce=${r.nonce} in ${r.attempts} attempts` }); haptic("success"); } else { toast({ title: "Mining cycle complete", description: `Best ξ=${r.xi.toFixed(5)}` }); } },
    onError: () => { setIsMining(false); toast({ title: "Mining error", variant: "destructive" }); },
  });
  const boost = state?.hashRateBoost ?? 1, equil = state?.dysonEquilibrium ?? 1, epoch = state?.epoch ?? 0, passRate = state?.valknutPassRate ?? 0, chainCorr = state?.chainCorrelation ?? 0;
  const passed = candidates?.filter(c => c.passesFilter) ?? [];
  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20"><Atom className="w-5 h-5 text-cyan-400" /></div><div><p className="font-heading text-lg font-bold">Dyson Sphere Miner</p><p className="text-[10px] font-mono text-muted-foreground">Valknut Dial v9 · Quantum Gravity · Spectral Lattice · R₉₀ Symmetry</p></div></div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-cyan-500/40 text-cyan-400">EPOCH {epoch}</Badge>
          <Badge variant="outline" className={`font-mono text-xs ${boost > 2 ? "border-emerald-500/40 text-emerald-400" : "border-muted"}`}>{boost.toFixed(2)}x BOOST</Badge>
          <Button onClick={() => mineMut.mutate()} disabled={isMining} size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5" data-testid="button-dyson-mine">{isMining ? <><RotateCcw className="w-3.5 h-3.5 animate-spin" />Mining…</> : <><Play className="w-3.5 h-3.5" />Run Valknut v9</>}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Dyson sphere canvas */}
        <Card className="border-cyan-500/20 bg-card/60 overflow-hidden" data-testid="card-dyson-sphere">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-mono text-cyan-400 flex items-center gap-2"><Orbit className="w-4 h-4" style={{ animation: "spin 8s linear infinite" }} />Dyson Sphere Equilibrium</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="h-64"><DysonCanvas boost={boost} equilibrium={equil} epoch={epoch} /></div>
            <div className="p-4 space-y-3 border-t border-border/40">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center"><p className="text-[10px] font-mono text-muted-foreground">Equilibrium</p><p className="text-xl font-bold text-cyan-400 font-mono">{equil.toFixed(3)}</p></div>
                <div className="bg-muted/30 rounded-lg p-3 text-center"><p className="text-[10px] font-mono text-muted-foreground">Hash Boost</p><p className="text-xl font-bold text-emerald-400 font-mono">{boost.toFixed(2)}x</p></div>
              </div>
              <div><div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1"><span>Valknut Pass Rate</span><span className="text-emerald-400">{(passRate * 100).toFixed(1)}%</span></div><Progress value={passRate * 100} className="h-1.5" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Spectral analysis */}
        <Card className="border-violet-500/20 bg-card/60" data-testid="card-spectral">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-mono text-violet-400 flex items-center gap-2"><Activity className="w-4 h-4" />Quantum Spectral Correlator</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SpectralBar gaps={state?.specGaps ?? []} label="Riemann Zeta Gaps (Δtₙ)" />
            <SpectralBar gaps={state?.quantumGaps ?? []} label="Quantum Energy Gaps (ΔEₙ)" />
            <SpectralBar gaps={state?.eigenvalues ?? []} label="Hamiltonian Eigenvalues" />
            <Separator className="opacity-30" />
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[["Lattice Corr", (state?.latticeCorr ?? 0).toFixed(5), "text-emerald-400"], ["R₉₀ Rotated", (state?.latticeCorrRot ?? 0).toFixed(5), "text-violet-400"], ["Final (orig)", (state?.finalCorrOrig ?? 0).toFixed(5), "text-cyan-400"], ["Final (rot)", (state?.finalCorrRot ?? 0).toFixed(5), "text-blue-400"]].map(([l, v, c]) => <div key={l}><p className="text-muted-foreground text-[10px]">{l}</p><p className={`font-bold ${c}`}>{v}</p></div>)}
            </div>
            <div className="bg-muted/30 rounded-lg p-3"><p className="text-[10px] font-mono text-muted-foreground mb-1">Chain Correlation Product</p><p className={`text-xl font-bold font-mono ${Math.abs(chainCorr) > 0.3 ? "text-yellow-400" : "text-foreground"}`}>{chainCorr.toFixed(6)}</p>{Math.abs(chainCorr) > 0.3 && <Badge className="mt-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px]">SIGNIFICANT CORRELATION</Badge>}</div>
          </CardContent>
        </Card>

        {/* Mine result + Candidates */}
        <div className="space-y-4">
          {mineResult && (
            <Card className={`border-2 ${mineResult.valknutPass ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/40 bg-card/60"}`} data-testid="card-mine-result">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-mono flex items-center gap-2"><Zap className={`w-4 h-4 ${mineResult.valknutPass ? "text-emerald-400" : "text-muted-foreground"}`} />{mineResult.valknutPass ? "Valknut Gate PASSED ✓" : "Mining Cycle"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ValknutGauge xi={mineResult.xi} tolerance={0.016} />
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">{[["Dyson Factor", mineResult.dysonFactor.toFixed(4), "text-cyan-400"], ["Berry Phase", mineResult.berryPhase.toFixed(4), "text-violet-400"], ["Spectral Cube", mineResult.specCube.toFixed(4), "text-blue-400"], ["Attempts", mineResult.attempts.toLocaleString(), "text-foreground"]].map(([l, v, c]) => <div key={l}><p className="text-muted-foreground text-[10px]">{l}</p><p className={c}>{v}</p></div>)}</div>
                {mineResult.blockHash && <div className="bg-muted/30 rounded p-2 text-[10px] font-mono"><p className="text-muted-foreground">Block Hash</p><p className="break-all">{mineResult.blockHash.slice(0, 32)}…</p></div>}
              </CardContent>
            </Card>
          )}
          <Card className="border-yellow-500/20 bg-card/60" data-testid="card-candidates">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-mono text-yellow-400 flex items-center gap-2"><GitBranch className="w-4 h-4" />Valknut Candidates<Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px]">{passed.length}/{candidates?.length ?? 0} pass</Badge></CardTitle></CardHeader>
            <CardContent>
              {candidates && candidates.length > 0 ? (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {candidates.slice(0, 12).map((c, i) => (
                    <div key={c.index} data-testid={`dyson-candidate-${c.index}`} className={`flex items-center gap-3 p-2 rounded-lg border text-xs font-mono ${c.passesFilter ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 bg-muted/20"}`}>
                      <span className="w-4 text-muted-foreground text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className={c.passesFilter ? "text-emerald-400" : "text-foreground"}>ξ={c.xi.toFixed(5)}</span><span className="text-muted-foreground/60">|ξ-1|={Math.abs(c.xi - 1).toFixed(5)}</span></div><p className="text-muted-foreground text-[9px]">D={c.dysonEquilibrium.toFixed(3)} B={c.berryPhase.toFixed(3)}</p></div>
                      {c.passesFilter && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]">✓</Badge>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs font-mono text-muted-foreground text-center py-4">Run Valknut v9 to generate candidates</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Unified Header Strip ──────────────────────────────────────────────────────

function MinerHeaderStrip() {
  const { data: miningStats } = useQuery<MiningStats>({ queryKey: ["/api/mining/status"], refetchInterval: 8000 });
  const { data: daemonStatus } = useQuery<DaemonStatus>({ queryKey: ["/api/btc-zk-daemon/status"], refetchInterval: 15000 });
  const { data: dysonState } = useQuery<DysonState>({ queryKey: ["/api/dyson/state"], refetchInterval: 30000 });
  const { data: network } = useQuery<{ activeMiners: number }>({ queryKey: ["/api/mining/network"], refetchInterval: 30000 });
  const { connected } = useEngineStream();
  const stats = [
    { label: "SKYNT Earned", value: `${(miningStats?.totalSkyntEarned ?? 0).toFixed(4)} ◈`, color: "text-emerald-400" },
    { label: "Hash Rate", value: `${miningStats?.hashRate ?? 0} H/s`, color: "text-cyan-400" },
    { label: "BTC Epoch", value: `#${daemonStatus?.epoch ?? 0}`, color: "text-orange-400" },
    { label: "Best ξ", value: (daemonStatus?.bestXi ?? 0).toFixed(4), color: "text-pink-400" },
    { label: "Dyson Boost", value: `${(dysonState?.hashRateBoost ?? 1).toFixed(2)}x`, color: "text-violet-400" },
    { label: "Active Miners", value: String(network?.activeMiners ?? 0), color: "text-yellow-400" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 rounded-xl border border-border/50 bg-card/40">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground uppercase">{label}</span>
          <span className={`font-mono text-xs font-bold ${color}`}>{value}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-1.5 text-[9px] font-mono">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
        <span className="text-muted-foreground">{connected ? "WS LIVE" : "WS OFF"}</span>
      </div>
    </div>
  );
}

// ─── Main UnifiedMiner Page ────────────────────────────────────────────────────

export default function UnifiedMiner() {
  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Pickaxe className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">SKYNT Mining Hub</h1>
            <p className="text-xs text-muted-foreground font-mono">Unified engine — SKYNT Yield · Genesis BTC · BTC ZK Daemon · Dyson Sphere</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 gap-1.5"><Zap className="w-3 h-3" />4 Engines</Badge>
          <Badge className="bg-violet-500/20 text-violet-300 border border-violet-500/40 gap-1.5"><Network className="w-3 h-3" />Multi-Chain</Badge>
          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 gap-1.5"><Activity className="w-3 h-3" />Real-Time WS</Badge>
        </div>
      </div>

      {/* Live stats strip */}
      <MinerHeaderStrip />

      {/* Engine tabs */}
      <Tabs defaultValue="yield" className="space-y-5">
        <TabsList className="grid grid-cols-4 w-full h-10" data-testid="mining-tabs">
          <TabsTrigger value="yield" className="text-[11px] gap-1.5 font-heading" data-testid="tab-yield"><Pickaxe className="w-3.5 h-3.5" />SKYNT YIELD</TabsTrigger>
          <TabsTrigger value="genesis" className="text-[11px] gap-1.5 font-heading" data-testid="tab-genesis"><Coins className="w-3.5 h-3.5" />GENESIS BTC</TabsTrigger>
          <TabsTrigger value="btczk" className="text-[11px] gap-1.5 font-heading" data-testid="tab-btczk"><Cpu className="w-3.5 h-3.5" />BTC ZK</TabsTrigger>
          <TabsTrigger value="dyson" className="text-[11px] gap-1.5 font-heading" data-testid="tab-dyson"><Atom className="w-3.5 h-3.5" />DYSON SPHERE</TabsTrigger>
        </TabsList>

        <TabsContent value="yield"><SkyYieldTab /></TabsContent>
        <TabsContent value="genesis"><GenesisBtcTab /></TabsContent>
        <TabsContent value="btczk"><BtcZkTab /></TabsContent>
        <TabsContent value="dyson"><DysonSphereTab /></TabsContent>
      </Tabs>
    </div>
  );
}
