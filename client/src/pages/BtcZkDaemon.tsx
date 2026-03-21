import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Cpu, Zap, Activity, Layers, BarChart3, Play, Square,
  CircleDot, Hash, ArrowUpRight, Network, Atom, TrendingUp, Clock,
  Shield, ChevronRight, Wifi, WifiOff, AlertCircle, CheckCircle2
} from "lucide-react";

interface DaemonStatus {
  running: boolean;
  epoch: number;
  uptime: number;
  totalEpochs: number;
  blocksFound: number;
  totalStxYield: number;
  lastEpoch: EpochData | null;
  hashRate: number;
  zkSyncBlock: string;
  moneroIntegrated: boolean;
  stacksYieldActive: boolean;
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
  status: "running" | "found" | "failed";
  createdAt: string;
}

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

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">BTC AuxPoW ZK Miner</h1>
              <p className="text-xs text-muted-foreground font-mono">
                Monero RandomX → Bitcoin AuxPoW → zkSync Era → STX Yield via ZK-Wormhole
              </p>
            </div>
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

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Current Epoch", value: status?.epoch ?? 0, icon: Hash, color: "text-violet-400" },
          { label: "Blocks Found", value: status?.blocksFound ?? 0, icon: Zap, color: "text-yellow-400" },
          { label: "Hash Rate", value: `${(status?.hashRate ?? 0).toLocaleString()} H/s`, icon: Activity, color: "text-sky-400" },
          { label: "STX Yield", value: `${(status?.totalStxYield ?? 0).toFixed(2)}`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Uptime", value: status?.running ? formatUptime(status.uptime) : "—", icon: Clock, color: "text-orange-400" },
          { label: "zkSync Block", value: short(status?.zkSyncBlock, 8), icon: Layers, color: "text-pink-400" },
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

      {/* Integration status row */}
      <div className="flex flex-wrap gap-2">
        <Badge className={status?.moneroIntegrated
          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
          : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"} >
          {status?.moneroIntegrated ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
          Monero RandomX {status?.moneroIntegrated ? "LIVE" : "Simulated"}
        </Badge>
        <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40">
          <Zap className="w-3 h-3 mr-1" /> zkSync Era Anchor
        </Badge>
        <Badge className={status?.stacksYieldActive
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : "bg-zinc-700/30 text-zinc-500 border-zinc-600/40"}>
          {status?.stacksYieldActive ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
          STX Yield {status?.stacksYieldActive ? "ACTIVE" : "KEY NEEDED"}
        </Badge>
        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40">
          <Shield className="w-3 h-3 mr-1" /> Valknut Dial v9 ξ≤0.016
        </Badge>
        <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/40">
          <Atom className="w-3 h-3 mr-1" /> Quantum Spectral Correlator (28 modes)
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Last Epoch Panel */}
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
                    { k: "Epoch", v: `#${last.epoch}` },
                    { k: "BTC Block", v: `${last.btcBlockHeight?.toLocaleString()}` },
                    { k: "Spectral ξ", v: last.valknutXi?.toFixed(6) },
                    { k: "Berry Phase", v: last.berryPhase?.toFixed(4) },
                    { k: "Dyson Factor", v: last.dysonFactor?.toFixed(4) },
                    { k: "Spec Cube", v: last.specCube?.toFixed(4) },
                    { k: "Q-Fib", v: last.qFib?.toFixed(6) },
                    { k: "Chain Corr", v: last.chainCorr?.toFixed(4) },
                    { k: "Lattice Corr", v: last.latticeCorr?.toFixed(4) },
                    { k: "STX Yield", v: `${last.stxYieldRouted?.toFixed(4)} STX` },
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

        {/* Quantum Gaps Visualization */}
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
                          style={{
                            width: `${pct}%`,
                            background: `hsl(${270 + i * 12}, 70%, 55%)`,
                          }}
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

      {/* Epoch History */}
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
                    <th className="text-left py-1.5 pr-3">Valknut ξ</th>
                    <th className="text-left py-1.5 pr-3">ξ Gate</th>
                    <th className="text-left py-1.5 pr-3">Chain Corr</th>
                    <th className="text-left py-1.5 pr-3">STX Yield</th>
                    <th className="text-left py-1.5 pr-3">AuxPoW</th>
                    <th className="text-left py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {epochs.slice(0, 25).map((ep) => (
                    <tr
                      key={ep.epoch}
                      className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                      data-testid={`epoch-row-${ep.epoch}`}
                    >
                      <td className="py-1.5 pr-3 text-violet-400">#{ep.epoch}</td>
                      <td className="py-1.5 pr-3 text-foreground">{ep.btcBlockHeight?.toLocaleString()}</td>
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
                        <Badge
                          className={
                            ep.status === "found"
                              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-[10px]"
                              : ep.status === "running"
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]"
                                : "bg-red-500/20 text-red-300 border-red-500/40 text-[10px]"
                          }
                        >
                          {ep.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Architecture Legend */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" /> Pipeline Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-muted-foreground">
            {[
              { label: "Monero RandomX", color: "text-orange-400" },
              { sep: true },
              { label: "BTC AuxPoW Header", color: "text-yellow-400" },
              { sep: true },
              { label: "Quantum Spectral Correlator", color: "text-pink-400" },
              { sep: true },
              { label: "Valknut Dial v9 ξ Filter", color: "text-violet-400" },
              { sep: true },
              { label: "zkSync Era Anchor", color: "text-sky-400" },
              { sep: true },
              { label: "ZK-Wormhole", color: "text-emerald-400" },
              { sep: true },
              { label: "STX Yield → Stacks", color: "text-green-400" },
            ].map((item, i) =>
              item.sep
                ? <ChevronRight key={i} className="w-3 h-3 text-border" />
                : <span key={i} className={item.color}>{item.label}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            Valknut v9 components: spec_cube = ζ(data)³, berry = Thue-Morse phase, q_fib = ℏ·Σgeom(Fib)/γmv,
            dyson = tanh(relativistic pressure)·2. Gate: |ξ − 1| &lt; 0.016.
            Quantum Spectral Correlator: 28-mode quaternion resonator lattice with R₉₀ rotational symmetry, Riemann ζ zero gaps.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
