import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Cpu, Zap, Activity, Layers, BarChart3, Play, Square,
  CircleDot, Hash, ArrowUpRight, Network, Atom, TrendingUp, Clock,
  Shield, ChevronRight, Wifi, WifiOff, AlertCircle, CheckCircle2,
  Fuel, Waves, KeyRound, Database, RefreshCw, Flame, Vault,
  GitMerge, ArrowRight, Bitcoin, Repeat2, Link2, Timer, Save, Wallet
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripleStackPoXState {
  active: boolean;
  network: "mainnet" | "testnet";
  currentCycle: number;
  enrolledCycle: number;
  sbtcBalance: number;
  totalSbtcClaimed: number;
  totalSbtcBridged: number;
  totalOiyeDeposited: number;
  totalStxConvertedToSbtc: number;
  miningEpochCount: number;
  liveStxBtcRate: number;
  lastCycleYield: number;
  yieldFactor: number;
  poxCycleEndBlock: number;
  blocksRemaining: number;
  blocksRemainingHours: number;
  wormholeVaaId: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  sbtcBalanceBtc: number;
  totalClaimedBtc: number;
  totalBridgedBtc: number;
  totalOiyeBtc: number;
}

interface DaemonStatus {
  running: boolean;
  epoch: number;
  uptime: number;
  totalEpochs: number;
  blocksFound: number;
  totalStxYield: number;
  lastEpoch: EpochData | null;
  hashRate: number;
  avgHashRate: number;
  bestXi: number;
  epochWinRate: number;
  xiPassRate: number;
  zkSyncBlock: string;
  moneroIntegrated: boolean;
  stacksYieldActive: boolean;
  networkDifficulty: number;
  mempoolFeeRate: number;
  pox?: TripleStackPoXState;
}

interface EpochData {
  epoch: number;
  spectralHash: string;
  quantumGaps: number[];
  chainCorr: number;
  latticeCorr: number;
  valknutXi: number;
  berryPhase: number;
  dysonFactor: number;
  specCube: number;
  qFib: number;
  xiPassed: boolean;
  btcBlockHeight: number;
  btcPrevHash: string;
  btcMerkleRoot: string;
  moneroSeedHash: string;
  zkSyncAnchor: string;
  auxpowHash: string | null;
  auxpowNonce: number | null;
  difficulty: number;
  stxYieldRouted: number;
  poxYieldFactor?: number;
  status: "running" | "found" | "failed";
  createdAt: string;
}

interface SentinelStatus {
  running: boolean;
  phase: "bootstrap" | "vault_active" | "harvesting" | "cloning";
  gasReserveEth: number;
  totalYieldAllocated: number;
  totalEthFunded: number;
  totalStxHarvested: number;
  fundingEvents: GasFundingEvent[];
  lastCheckAt: string | null;
  isHealthy: boolean;
  isCritical: boolean;
  projectedRunwayEpochs: number;
  vaultCloneCount: number;
  sentinelTriggers: number;
  bootstrapActive: boolean;
  childVaultDeployed: boolean;
}

interface GasFundingEvent {
  id: string;
  epoch: number | null;
  triggerReason: string;
  fundingMethod: string;
  ethFunded: number;
  stxConverted: number;
  gasBefore: number;
  gasAfter: number;
  reserveBalance: number;
  yieldAllocated: number;
  phase: string;
  status: string;
  txHash: string | null;
  createdAt: string;
}

interface SpectralProof {
  id: number;
  epoch: number;
  btc_block_height: number;
  peak_bin: number;
  peak_magnitude: number;
  peak_phase: number;
  spectral_entropy: number;
  curve_scalar: string;
  height_binding: string;
  is_valid: boolean;
  entropy_source: string;
  ecrecover_message_hash: string | null;
  ecrecover_v: number | null;
  ecrecover_address: string | null;
  soundness_verified: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function short(s: string | null | undefined, n = 12) {
  if (!s) return "—";
  return s.slice(0, n) + "…";
}

function XiBadge({ xi, passed }: { xi: number; passed: boolean }) {
  const color = passed
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : Math.abs(xi - 1) < 0.05
      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
      : "bg-red-500/20 text-red-300 border-red-500/40";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${color}`}>
      {passed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      ξ={xi.toFixed(4)}
    </span>
  );
}

const PHASE_META: Record<string, { label: string; color: string; icon: typeof Fuel }> = {
  bootstrap:    { label: "Bootstrap",    color: "text-orange-400",  icon: Flame },
  vault_active: { label: "Vault Active", color: "text-violet-400",  icon: Vault },
  harvesting:   { label: "Harvesting",   color: "text-emerald-400", icon: RefreshCw },
  cloning:      { label: "Cloning",      color: "text-sky-400",     icon: Database },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BtcZkDaemon() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<DaemonStatus>({
    queryKey: ["/api/btc-zk-daemon/status"],
    refetchInterval: 8000,
  });

  const { data: epochs } = useQuery<EpochData[]>({
    queryKey: ["/api/btc-zk-daemon/epochs"],
    refetchInterval: 15000,
  });

  const { data: sentinel } = useQuery<SentinelStatus>({
    queryKey: ["/api/self-fund/status"],
    refetchInterval: 10000,
  });

  const { data: spectralProofs } = useQuery<SpectralProof[]>({
    queryKey: ["/api/spectral-pow/proofs"],
    refetchInterval: 20000,
  });

  const { data: payoutConfig } = useQuery<{ externalWallet: string; enabled: boolean; threshold: number; pendingAmount: number }>({
    queryKey: ["/api/mining/auto-payout"],
    refetchInterval: 30000,
  });

  const [btcAddress, setBtcAddress] = useState("");
  useEffect(() => {
    if (payoutConfig?.externalWallet) setBtcAddress(payoutConfig.externalWallet);
  }, [payoutConfig?.externalWallet]);

  const savePayoutAddress = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mining/auto-payout", { externalWallet: btcAddress.trim(), enabled: true }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/auto-payout"] });
      toast({ title: "BTC Payout Address Saved", description: "Block rewards will be sent to your address" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to save address", description: e.message, variant: "destructive" });
    },
  });

  const startMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/btc-zk-daemon/start"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/btc-zk-daemon/status"] });
      toast({ title: "BTC ZK Daemon started", description: "Monero RandomX + Valknut v9 mining active" });
    },
  });

  const stopMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/btc-zk-daemon/stop"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/btc-zk-daemon/status"] });
      toast({ title: "Daemon stopped", description: "BTC AuxPoW ZK miner halted" });
    },
  });

  const last = status?.lastEpoch;
  const latestProof = spectralProofs?.[0];
  const phaseMeta = PHASE_META[sentinel?.phase ?? "bootstrap"];
  const PhaseIcon = phaseMeta?.icon ?? Flame;
  const pox = status?.pox;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">BTC PoX Miner</h1>
            <p className="text-xs text-muted-foreground font-mono">
              Bitcoin Proof-of-Transfer · AuxPoW · Triple-Stack PoX · Stacks Yield · Self-Funding Gas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status?.running ? (
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 gap-1.5 px-3 py-1">
              <CircleDot className="w-3 h-3 animate-pulse" /> LIVE
            </Badge>
          ) : (
            <Badge className="bg-zinc-700/40 text-zinc-400 border border-zinc-600/40 gap-1.5 px-3 py-1">
              <CircleDot className="w-3 h-3" /> OFFLINE
            </Badge>
          )}
          <Button
            data-testid="btn-daemon-toggle"
            onClick={() => status?.running ? stopMut.mutate() : startMut.mutate()}
            disabled={startMut.isPending || stopMut.isPending}
            variant={status?.running ? "destructive" : "default"}
            size="sm"
            className="gap-2"
          >
            {status?.running ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {status?.running ? "Stop Daemon" : "Start Daemon"}
          </Button>
        </div>
      </div>

      {/* ── Top stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Epoch",       value: status?.epoch ?? 0,                                icon: Hash,       color: "text-violet-400" },
          { label: "Blocks",      value: status?.blocksFound ?? 0,                          icon: Zap,        color: "text-yellow-400" },
          { label: "Hash Rate",   value: `${((status?.hashRate ?? 0) / 1000).toFixed(1)}k H/s`, icon: Activity, color: "text-sky-400" },
          { label: "Best ξ",      value: (status?.bestXi ?? 0).toFixed(4),                 icon: Atom,       color: "text-pink-400"  },
          { label: "ξ Pass Rate", value: `${((status?.xiPassRate ?? 0) * 100).toFixed(0)}%`, icon: Shield,   color: "text-emerald-400" },
          { label: "Net Diff",    value: `${((status?.networkDifficulty ?? 0) / 1e12).toFixed(1)}T`, icon: Network, color: "text-orange-400" },
          { label: "Fee Rate",    value: `${status?.mempoolFeeRate ?? 0} s/vB`,            icon: Fuel,       color: "text-cyan-400"  },
          { label: "STX Yield",   value: (status?.totalStxYield ?? 0).toFixed(2),           icon: TrendingUp, color: "text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/60 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              <p className={`font-mono text-sm font-bold ${color}`} data-testid={`stat-${label.replace(/\s/g, "-").toLowerCase()}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Integration badges ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Badge className={status?.moneroIntegrated ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"}>
          {status?.moneroIntegrated ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
          Monero RandomX {status?.moneroIntegrated ? "LIVE" : "Simulated"}
        </Badge>
        <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40">
          <Zap className="w-3 h-3 mr-1" /> zkSync Era Anchor
        </Badge>
        <Badge className={status?.stacksYieldActive ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"}>
          {status?.stacksYieldActive ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
          STX Yield {status?.stacksYieldActive ? "ACTIVE" : "KEY NEEDED"}
        </Badge>
        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40">
          <Shield className="w-3 h-3 mr-1" /> Valknut Dial v9 ξ≤0.016
        </Badge>
        <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/40">
          <Waves className="w-3 h-3 mr-1" /> Spectral PoW (No DLP)
        </Badge>
        <Badge className={sentinel?.isHealthy ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : sentinel?.isCritical ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"}>
          <Fuel className="w-3 h-3 mr-1" /> Gas Self-Fund {sentinel?.isHealthy ? "HEALTHY" : sentinel?.isCritical ? "CRITICAL" : "LOW"}
        </Badge>
      </div>

      {/* ── BTC Payout Address ─────────────────────────────────────────────── */}
      <Card className="bg-card/60 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Wallet className="w-4 h-4 text-orange-400" />
              <span className="font-heading text-sm text-orange-300 tracking-wide">BTC Payout Address</span>
              {payoutConfig?.externalWallet && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> SET
                </Badge>
              )}
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                data-testid="input-btc-payout-address"
                placeholder="bc1q… or 1… or 3… — your Bitcoin address for block rewards"
                value={btcAddress}
                onChange={e => setBtcAddress(e.target.value)}
                className="font-mono text-xs bg-background/60 border-orange-500/30 focus-visible:ring-orange-500/40 flex-1"
              />
              <Button
                data-testid="button-save-btc-address"
                size="sm"
                disabled={savePayoutAddress.isPending || !btcAddress.trim() || btcAddress.trim() === payoutConfig?.externalWallet}
                onClick={() => savePayoutAddress.mutate()}
                className="gap-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-300 shrink-0"
                variant="outline"
              >
                {savePayoutAddress.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>
          {payoutConfig?.pendingAmount != null && payoutConfig.pendingAmount > 0 && (
            <p className="text-[10px] font-mono text-muted-foreground mt-2 flex items-center gap-1">
              <Bitcoin className="w-3 h-3 text-orange-400" />
              Pending payout: <span className="text-orange-400">{payoutConfig.pendingAmount.toFixed(8)} BTC</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Last Epoch + Quantum Gaps ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" /> Last Epoch
              {last && <XiBadge xi={last.valknutXi} passed={!!last.xiPassed} />}
              {last?.status === "found" && (
                <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 ml-auto text-[10px]">
                  <Zap className="w-2.5 h-2.5 mr-1" /> BLOCK FOUND
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs">
            {!last ? (
              <p className="text-muted-foreground text-center py-6">No epochs yet — start the daemon</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { k: "Epoch",       v: `#${last.epoch}` },
                    { k: "BTC Block",   v: last.btcBlockHeight?.toLocaleString() },
                    { k: "Spectral ξ",  v: last.valknutXi?.toFixed(6) },
                    { k: "Berry Phase", v: last.berryPhase?.toFixed(4) },
                    { k: "Dyson Factor",v: last.dysonFactor?.toFixed(4) },
                    { k: "Spec Cube",   v: last.specCube?.toFixed(4) },
                    { k: "Q-Fib",       v: last.qFib?.toFixed(6) },
                    { k: "Chain Corr",  v: last.chainCorr?.toFixed(4) },
                    { k: "Lattice Corr",v: last.latticeCorr?.toFixed(4) },
                    { k: "STX Yield",   v: `${last.stxYieldRouted?.toFixed(4)} STX` },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex justify-between bg-muted/20 rounded px-2 py-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground font-medium">{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2 opacity-30" />
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spectral Hash</span>
                    <span className="text-violet-400">{short(last.spectralHash, 20)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monero Seed</span>
                    <span className="text-orange-400">{short(last.moneroSeedHash, 20)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">zkSync Anchor</span>
                    <span className="text-sky-400">{short(last.zkSyncAnchor, 20)}</span>
                  </div>
                  {last.auxpowHash && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AuxPoW Hash</span>
                      <span className="text-yellow-400">{short(last.auxpowHash, 20)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-pink-400" /> Quantum Spectral Gaps
            </CardTitle>
            <CardDescription className="text-[10px]">
              Riemann ζ zeros → Quaternion resonator lattice → Valknut filter
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!last?.quantumGaps?.length ? (
              <p className="text-muted-foreground text-xs text-center py-6 font-mono">Awaiting epoch…</p>
            ) : (
              <div className="space-y-1.5">
                {last.quantumGaps.slice(0, 10).map((gap, i) => {
                  const pct = Math.min(100, Math.abs(gap) * 12);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}</span>
                      <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: `hsl(${270 + i * 12}, 70%, 55%)` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-14 text-right">
                        {gap.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Spectral PoW (No DLP) ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Waves className="w-4 h-4 text-cyan-400" /> Spectral PoW — Curve Binding Without DLP
            </CardTitle>
            <CardDescription className="text-[10px]">
              Entropy signal → DFT peak bin n → k = n mod N (secp256k1) → k ≡ blockHeight mod N
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            {!latestProof ? (
              <p className="text-muted-foreground text-center py-4">No spectral proofs yet</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { k: "Epoch",          v: `#${latestProof.epoch}` },
                    { k: "BTC Block",      v: latestProof.btc_block_height?.toLocaleString() },
                    { k: "Peak Bin n",     v: latestProof.peak_bin },
                    { k: "Peak Magnitude", v: latestProof.peak_magnitude?.toFixed(4) },
                    { k: "Peak Phase",     v: latestProof.peak_phase?.toFixed(4) + " rad" },
                    { k: "Spectral Entropy",v: latestProof.spectral_entropy?.toFixed(4) },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex justify-between bg-muted/20 rounded px-2 py-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Curve Scalar k</span>
                    <span className="text-cyan-400 text-[10px]">{latestProof.curve_scalar?.slice(0, 24)}…</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Height Binding</span>
                    <span className="text-orange-400 text-[10px]">{latestProof.height_binding?.toString().slice(0, 24)}…</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Entropy Source</span>
                    <span className="text-pink-400">{latestProof.entropy_source}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Curve Binding Valid</span>
                  <Badge className={latestProof.is_valid
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-zinc-700/30 text-zinc-400 border-zinc-600/40"}>
                    {latestProof.is_valid ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                    {latestProof.is_valid ? "k ≡ height mod N ✓" : "Spectral drift — k ≠ height mod N"}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ECRECOVER Proof */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-violet-400" /> ECRECOVER Circuit Proof
            </CardTitle>
            <CardDescription className="text-[10px]">
              s⁻¹(h·G + r·Q) = P → addr = Keccak256(Px‖Py)[12:] — soundness: addr = ECRECOVER(h,v,r,s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            {!latestProof?.ecrecover_message_hash ? (
              <p className="text-muted-foreground text-center py-4">Awaiting ECRECOVER proof generation</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Message Hash h</span>
                    <span className="text-violet-400">{latestProof.ecrecover_message_hash?.slice(0, 20)}…</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recovery ID v</span>
                    <span className="text-yellow-400 font-bold">{latestProof.ecrecover_v}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recovered Addr</span>
                    <span className="text-emerald-400">{latestProof.ecrecover_address?.slice(0, 20)}…</span>
                  </div>
                </div>

                <div className="bg-muted/20 rounded p-2 space-y-1 text-[10px]">
                  <p className="text-muted-foreground">ECDSA Check:</p>
                  <p className="text-sky-300 font-mono">s⁻¹(h·G + r·Q) = P</p>
                  <p className="text-muted-foreground mt-1">Curve Constraint:</p>
                  <p className="text-sky-300 font-mono">P = (Px, Py) ∈ secp256k1</p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Soundness Verified</span>
                  <Badge className={latestProof.soundness_verified
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-zinc-700/30 text-zinc-400 border-zinc-600/40"}>
                    {latestProof.soundness_verified
                      ? <><CheckCircle2 className="w-3 h-3 mr-1" />addr = ECRECOVER(h,v,r,s)</>
                      : <><AlertCircle className="w-3 h-3 mr-1" />Not verified</>}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Triple-Stack PoX Mining Engine ────────────────────────────────── */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-orange-400" />
            Triple-Stack PoX Mining Engine
            <Badge className={`ml-auto text-[10px] ${
              pox?.active
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-zinc-700/30 text-zinc-400 border-zinc-600/40"
            }`}>
              {pox?.active ? <><CircleDot className="w-2.5 h-2.5 mr-1 animate-pulse" />ACTIVE</> : "IDLE"}
            </Badge>
            <Badge className="text-[10px] bg-orange-500/10 text-orange-300 border-orange-500/30">
              {pox?.network ?? "mainnet"}
            </Badge>
          </CardTitle>
          <CardDescription className="text-[10px]">
            BTC mining → STX yield → sBTC peg-in → Dual Stacking → Wormhole NTT → OIYE Quantum Sentinel → ξ_yield dial
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Self-reinforcing loop visualization */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono mb-4 flex-wrap">
            {[
              { label: "BTC Mining", icon: Bitcoin, color: "text-orange-400", active: status?.running },
              { label: "STX Yield", icon: TrendingUp, color: "text-emerald-400", active: (status?.totalStxYield ?? 0) > 0 },
              { label: "sBTC Peg-In", icon: ArrowRight, color: "text-cyan-400", active: (pox?.sbtcBalance ?? 0) > 0 },
              { label: "Dual Stacking", icon: Layers, color: "text-violet-400", active: (pox?.enrolledCycle ?? 0) > 0 },
              { label: "Wormhole NTT", icon: Link2, color: "text-pink-400", active: !!pox?.wormholeVaaId },
              { label: "OIYE Sentinel", icon: Repeat2, color: "text-yellow-400", active: (pox?.totalOiyeDeposited ?? 0) > 0 },
              { label: "ξ_yield Boost", icon: Atom, color: "text-sky-400", active: (pox?.yieldFactor ?? 0) > 0.01 },
            ].map(({ label, icon: Icon, color, active }, idx, arr) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                  active
                    ? "bg-muted/30 border-border/50"
                    : "bg-muted/10 border-border/20 opacity-40"
                }`}>
                  <Icon className={`w-2.5 h-2.5 ${active ? color : "text-muted-foreground"}`} />
                  <span className={active ? color : "text-muted-foreground"}>{label}</span>
                </span>
                {idx < arr.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                )}
              </span>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              {
                label: "sBTC Balance",
                value: `${(pox?.sbtcBalance ?? 0).toLocaleString()} μsBTC`,
                sub: `${(pox?.sbtcBalanceBtc ?? 0).toFixed(8)} sBTC`,
                color: "text-orange-400",
              },
              {
                label: "ξ_yield Factor",
                value: (pox?.yieldFactor ?? 0).toFixed(6),
                sub: "Valknut dial component [0,1]",
                color: (pox?.yieldFactor ?? 0) > 0.5 ? "text-emerald-400" : (pox?.yieldFactor ?? 0) > 0.1 ? "text-yellow-400" : "text-zinc-400",
              },
              {
                label: "Dual Stacking Cycle",
                value: pox?.enrolledCycle ? `#${pox.enrolledCycle}` : "—",
                sub: pox?.currentCycle ? `Current: #${pox.currentCycle}` : "Awaiting enrollment",
                color: "text-violet-400",
              },
              {
                label: "STX → sBTC Recycled",
                value: `${(pox?.totalStxConvertedToSbtc ?? 0).toFixed(4)} STX`,
                sub: "5% of each epoch's STX yield",
                color: "text-cyan-400",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-muted/20 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                <p className={`font-mono text-sm font-bold ${color}`} data-testid={`pox-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* ξ_yield progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span className="font-mono">ξ_yield dial strength</span>
              <span className="font-mono text-sky-400">{((pox?.yieldFactor ?? 0) * 100).toFixed(2)}%</span>
            </div>
            <Progress value={(pox?.yieldFactor ?? 0) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Higher ξ_yield → Valknut Xi gate easier to pass → more blocks found → more STX → more sBTC
            </p>
          </div>

          {/* Lifetime totals */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: "Total sBTC Claimed", value: `${(pox?.totalSbtcClaimed ?? 0).toLocaleString()} μsBTC`, color: "text-emerald-400" },
              { label: "Wormhole Bridged", value: `${(pox?.totalSbtcBridged ?? 0).toLocaleString()} μsBTC`, color: "text-pink-400" },
              { label: "OIYE Deposited", value: `${(pox?.totalOiyeDeposited ?? 0).toLocaleString()} μsBTC`, color: "text-yellow-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-muted/10 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                <p className={`font-mono text-xs font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Wormhole VAA + error */}
          {pox?.wormholeVaaId && (
            <div className="flex items-center gap-2 text-[10px] font-mono bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2 mb-3">
              <Link2 className="w-3 h-3 text-pink-400 shrink-0" />
              <span className="text-muted-foreground">Last Wormhole VAA:</span>
              <span className="text-pink-300">{pox.wormholeVaaId}</span>
            </div>
          )}
          {pox?.lastError && (
            <div className="flex items-center gap-2 text-[10px] font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-red-300">{pox.lastError}</span>
            </div>
          )}

          {/* Cycle metadata: countdown + live rate */}
          <div className="mt-3 grid sm:grid-cols-3 gap-3">
            {(pox?.blocksRemaining ?? 0) > 0 && (
              <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cycle Ends In</p>
                  <p className="font-mono text-xs font-bold text-violet-400" data-testid="pox-blocks-remaining">
                    {pox!.blocksRemaining.toLocaleString()} blocks
                    {" "}·{" "}
                    {pox!.blocksRemainingHours >= 24
                      ? `${Math.floor(pox!.blocksRemainingHours / 24)}d ${Math.round(pox!.blocksRemainingHours % 24)}h`
                      : `${pox!.blocksRemainingHours}h`}
                  </p>
                </div>
              </div>
            )}
            {(pox?.liveStxBtcRate ?? 0) > 0 && (
              <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Live STX Rate</p>
                  <p className="font-mono text-xs font-bold text-emerald-400" data-testid="pox-live-rate">
                    {(pox!.liveStxBtcRate).toFixed(0)} μsBTC/STX
                  </p>
                </div>
              </div>
            )}
            {(pox?.miningEpochCount ?? 0) > 0 && (
              <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                <Repeat2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mining Epochs</p>
                  <p className="font-mono text-xs font-bold text-orange-400" data-testid="pox-epoch-count">
                    {pox!.miningEpochCount} recycled
                  </p>
                </div>
              </div>
            )}
          </div>
          {(pox?.poxCycleEndBlock ?? 0) > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono mt-2">
              Enrollment expires at block #{pox!.poxCycleEndBlock.toLocaleString()}
              {pox?.lastRunAt && <> · Last PoX run: {new Date(pox.lastRunAt).toLocaleTimeString()}</>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── OIYE Self-Funding Gas Sentinel ────────────────────────────────── */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Fuel className="w-4 h-4 text-cyan-400" /> OIYE $0-Bootstrap Self-Funding Gas Sentinel
            {sentinel && (
              <Badge className={`ml-auto text-[10px] ${
                sentinel.phase === "bootstrap"    ? "bg-orange-500/20 text-orange-300 border-orange-500/40" :
                sentinel.phase === "vault_active" ? "bg-violet-500/20 text-violet-300 border-violet-500/40" :
                sentinel.phase === "harvesting"   ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                                                    "bg-sky-500/20 text-sky-300 border-sky-500/40"
              }`}>
                <PhaseIcon className="w-2.5 h-2.5 mr-1" />
                {phaseMeta?.label ?? "—"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-[10px]">
            10% of each epoch STX yield → ETH gas reserve → auto-sweep when balance critical
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              {
                label: "Gas Reserve",
                value: `${(sentinel?.gasReserveEth ?? 0).toFixed(8)} ETH`,
                sub: sentinel?.isCritical ? "CRITICAL" : sentinel?.isHealthy ? "Healthy" : "Low",
                color: sentinel?.isCritical ? "text-red-400" : sentinel?.isHealthy ? "text-emerald-400" : "text-yellow-400",
              },
              {
                label: "Runway",
                value: `~${sentinel?.projectedRunwayEpochs ?? 0} epochs`,
                sub: "Projected",
                color: "text-sky-400",
              },
              {
                label: "STX Harvested",
                value: `${(sentinel?.totalStxHarvested ?? 0).toFixed(4)} STX`,
                sub: "Total allocated",
                color: "text-emerald-400",
              },
              {
                label: "Vault Clones",
                value: sentinel?.vaultCloneCount ?? 0,
                sub: `${sentinel?.sentinelTriggers ?? 0} sentinel triggers`,
                color: "text-violet-400",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-muted/20 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                <p className={`font-mono text-sm font-bold ${color}`} data-testid={`gas-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Phase pipeline */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-4 flex-wrap">
            {[
              { label: "Airdrops / Mining", active: true, color: "text-orange-400" },
              { label: "Bootstrap Capital",  active: sentinel?.phase !== "bootstrap" || true, color: "text-orange-400" },
              { label: "Child Vault",        active: sentinel?.childVaultDeployed, color: "text-violet-400" },
              { label: "Yield Allocation",   active: (sentinel?.totalYieldAllocated ?? 0) > 0, color: "text-emerald-400" },
              { label: "Sentinel Bot",       active: sentinel?.running, color: "text-cyan-400" },
              { label: "Auto-Sweep",         active: (sentinel?.sentinelTriggers ?? 0) > 0, color: "text-sky-400" },
            ].map((step, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                <span className={step.active ? step.color : "text-zinc-600"}>
                  {step.active ? <CheckCircle2 className="inline w-3 h-3 mr-0.5" /> : <CircleDot className="inline w-3 h-3 mr-0.5" />}
                  {step.label}
                </span>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-border" />}
              </span>
            ))}
          </div>

          {/* Recent funding events */}
          {sentinel?.fundingEvents?.length ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Recent Funding Events</p>
              {sentinel.fundingEvents.slice(0, 8).map((ev, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-mono bg-muted/10 rounded px-2 py-1">
                  <span className={ev.triggerReason === "EPOCH_YIELD_HARVEST"
                    ? "text-emerald-400" : ev.status === "failed" ? "text-red-400" : "text-cyan-400"}>
                    {ev.triggerReason.replace(/_/g, " ")}
                  </span>
                  <span className="text-muted-foreground">{ev.stxConverted?.toFixed(4)} STX</span>
                  <span className="text-yellow-400">+{ev.ethFunded?.toFixed(8)} ETH</span>
                  <Badge className={ev.status === "executed"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-1 py-0"
                    : "bg-red-500/10 text-red-400 border-red-500/20 text-[9px] px-1 py-0"}>
                    {ev.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center py-2 font-mono">
              Sentinel active — awaiting yield harvest events
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Xi + ξ_yield Trend Chart ──────────────────────────────────────── */}
      {epochs && epochs.length > 1 && (
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" /> Valknut Xi + ξ_yield Trend
            </CardTitle>
            <CardDescription className="text-[10px]">
              ξ_best (orange) and PoX ξ_yield factor (cyan) over the last {Math.min(epochs.length, 40)} epochs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={[...epochs].reverse().slice(0, 40).map(e => ({
                  epoch: `#${e.epoch}`,
                  xi: parseFloat(e.valknutXi.toFixed(4)),
                  yf: parseFloat(((e.poxYieldFactor ?? 0)).toFixed(4)),
                  passed: e.xiPassed,
                }))}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="epoch" tick={{ fontSize: 9, fill: "#888" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: "#888" }} />
                <RechartTooltip
                  contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, fontSize: 11 }}
                  formatter={(val: number, name: string) => [val.toFixed(4), name === "xi" ? "ξ_best" : "ξ_yield"]}
                />
                <ReferenceLine y={1} stroke="rgba(251,146,60,0.25)" strokeDasharray="4 2" label={{ value: "Xi=1.0 target", fontSize: 9, fill: "rgba(251,146,60,0.5)", position: "insideTopRight" }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} formatter={(v) => v === "xi" ? "ξ_best (Valknut)" : "ξ_yield (PoX factor)"} />
                <Line type="monotone" dataKey="xi" stroke="#fb923c" strokeWidth={1.5} dot={false} name="xi" />
                <Line type="monotone" dataKey="yf" stroke="#38bdf8" strokeWidth={1.5} dot={false} name="yf" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Spectral Proof History ─────────────────────────────────────────── */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" /> Spectral PoW Proof Log
          </CardTitle>
          <CardDescription className="text-[10px]">Persisted to spectral_pow_proofs table — ECRECOVER soundness per epoch</CardDescription>
        </CardHeader>
        <CardContent>
          {!spectralProofs?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4 font-mono">No proofs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-1.5 pr-3">Epoch</th>
                    <th className="text-left py-1.5 pr-3">BTC Block</th>
                    <th className="text-left py-1.5 pr-3">Peak Bin</th>
                    <th className="text-left py-1.5 pr-3">Magnitude</th>
                    <th className="text-left py-1.5 pr-3">Entropy</th>
                    <th className="text-left py-1.5 pr-3">Curve Valid</th>
                    <th className="text-left py-1.5 pr-3">ECRECOVER</th>
                    <th className="text-left py-1.5">Recovered Addr</th>
                  </tr>
                </thead>
                <tbody>
                  {spectralProofs.slice(0, 15).map((p) => (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-muted/10" data-testid={`proof-row-${p.epoch}`}>
                      <td className="py-1.5 pr-3 text-violet-400">#{p.epoch}</td>
                      <td className="py-1.5 pr-3 text-foreground">{p.btc_block_height?.toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-cyan-400">{p.peak_bin}</td>
                      <td className="py-1.5 pr-3 text-pink-400">{p.peak_magnitude?.toFixed(3)}</td>
                      <td className="py-1.5 pr-3 text-orange-400">{p.spectral_entropy?.toFixed(3)}</td>
                      <td className="py-1.5 pr-3">
                        {p.is_valid
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />}
                      </td>
                      <td className="py-1.5 pr-3">
                        {p.soundness_verified
                          ? <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">v={p.ecrecover_v}</Badge>
                          : <span className="text-zinc-500">—</span>}
                      </td>
                      <td className="py-1.5 text-emerald-400">{short(p.ecrecover_address, 14)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Epoch History ─────────────────────────────────────────────────── */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Network className="w-4 h-4 text-sky-400" /> Epoch History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!epochs?.length ? (
            <p className="text-muted-foreground text-xs text-center py-4 font-mono">No epochs recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-1.5 pr-3">Epoch</th>
                    <th className="text-left py-1.5 pr-3">BTC Block</th>
                    <th className="text-left py-1.5 pr-3">Best ξ</th>
                    <th className="text-left py-1.5 pr-3">ξ Gate</th>
                    <th className="text-left py-1.5 pr-3">Chain Corr</th>
                    <th className="text-left py-1.5 pr-3">STX Yield</th>
                    <th className="text-left py-1.5 pr-3">AuxPoW</th>
                    <th className="text-left py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {epochs.slice(0, 25).map((ep) => (
                    <tr key={ep.epoch} className="border-b border-border/20 hover:bg-muted/10" data-testid={`epoch-row-${ep.epoch}`}>
                      <td className="py-1.5 pr-3 text-violet-400">#{ep.epoch}</td>
                      <td className="py-1.5 pr-3">{ep.btcBlockHeight?.toLocaleString()}</td>
                      <td className="py-1.5 pr-3">
                        <XiBadge xi={ep.valknutXi ?? 0} passed={!!ep.xiPassed} />
                      </td>
                      <td className="py-1.5 pr-3">
                        {ep.xiPassed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                      </td>
                      <td className="py-1.5 pr-3 text-sky-400">{ep.chainCorr?.toFixed(4)}</td>
                      <td className="py-1.5 pr-3 text-emerald-400">{ep.stxYieldRouted?.toFixed(3)} STX</td>
                      <td className="py-1.5 pr-3">
                        {ep.auxpowHash
                          ? <span className="text-yellow-400">{short(ep.auxpowHash, 10)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-1.5">
                        <Badge className={
                          ep.status === "found"   ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-[10px]" :
                          ep.status === "running" ? "bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]"          :
                                                    "bg-red-500/20 text-red-300 border-red-500/40 text-[10px]"
                        }>{ep.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Architecture Pipeline ─────────────────────────────────────────── */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" /> Full Pipeline Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-muted-foreground">
            {[
              { label: "Monero RandomX",          color: "text-orange-400" },
              { sep: true },
              { label: "BTC AuxPoW Header",        color: "text-yellow-400" },
              { sep: true },
              { label: "Quantum Spectral Correlator", color: "text-pink-400" },
              { sep: true },
              { label: "Valknut Dial v9 ξ Filter", color: "text-violet-400" },
              { sep: true },
              { label: "Spectral PoW (No DLP)",    color: "text-cyan-400"  },
              { sep: true },
              { label: "ECRECOVER Proof",          color: "text-violet-300" },
              { sep: true },
              { label: "zkSync Era Anchor",         color: "text-sky-400"  },
              { sep: true },
              { label: "ZK-Wormhole STX",          color: "text-emerald-400" },
              { sep: true },
              { label: "OIYE Gas Self-Fund",        color: "text-cyan-300" },
            ].map((item, i) =>
              item.sep
                ? <ChevronRight key={i} className="w-3 h-3 text-border" />
                : <span key={i} className={item.color}>{item.label}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            <strong className="text-cyan-400">Spectral PoW:</strong> entropy signal → DFT → dominant bin n → k = n mod N → k ≡ height mod N (no DLP).
            <strong className="text-violet-400 ml-2">ECRECOVER:</strong> s⁻¹(h·G + r·Q) = P; addr = Keccak256(Px‖Py)[12:].
            <strong className="text-emerald-400 ml-2">OIYE Sentinel:</strong> 10% STX yield → ETH gas reserve → auto-sweep below {`< 0.005 ETH`}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
