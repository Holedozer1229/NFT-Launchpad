import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Orbit, Activity, Zap, Network, Radio, Atom, CircleDot,
  TrendingUp, Shield, Link2, Waves, ArrowRightLeft, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, Cell, LineChart, Line,
} from "recharts";

interface BerryPhaseState {
  phase: number;
  phasePi: string;
  geometricAmplitude: number;
  cycleCount: number;
  holonomyClass: string;
}

interface PageCurvePoint {
  timestamp: number;
  entropy: number;
  subsystemSize: number;
  maxEntropy: number;
  scrambled: boolean;
}

interface EntanglementPair {
  id: string;
  blockA: number;
  blockB: number;
  concurrence: number;
  bellState: string;
  fidelity: number;
  erBridgeActive: boolean;
  tunnelStrength: number;
}

interface BlockShareNode {
  blockHeight: number;
  shareWeight: number;
  entangledWith: number[];
  phiContribution: number;
  berryContribution: number;
}

interface TunnelState {
  id: string;
  sourceBlock: number;
  targetBlock: number;
  tunnelPhase: number;
  transmissionCoeff: number;
  reflectionCoeff: number;
  eprFidelity: number;
  wormholeMetric: number;
  active: boolean;
}

interface Snapshot {
  berryPhase: BerryPhaseState;
  pageCurve: PageCurvePoint[];
  entanglementPairs: EntanglementPair[];
  blockShares: BlockShareNode[];
  tunnels: TunnelState[];
  phiTotal: number;
  qgScore: number;
  holoScore: number;
  temporalDepth: number;
  networkCoherence: number;
  timestamp: number;
}

const NEON = {
  magenta: "#ff2d78",
  cyan: "#00f0ff",
  green: "#39ff14",
  amber: "#ffb300",
  purple: "#a855f7",
  blue: "#3b82f6",
};

function GlowCard({ children, className = "", glow = NEON.cyan }: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <Card className={`bg-black/60 border-white/10 backdrop-blur-sm ${className}`}
      style={{ boxShadow: `0 0 20px ${glow}15, inset 0 1px 0 ${glow}10` }}>
      {children}
    </Card>
  );
}

function BerryPhaseGauge({ phase, phasePi, amplitude, holonomy }: {
  phase: number; phasePi: string; amplitude: number; holonomy: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = Math.min(280, canvas.parentElement?.clientWidth || 280);
    const w = canvas.width = containerWidth;
    const h = canvas.height = containerWidth;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(110, containerWidth * 0.39);
    let lastFrame = 0;

    const draw = (ts: number) => {
      if (ts - lastFrame < 33) { animRef.current = requestAnimationFrame(draw); return; }
      lastFrame = ts;
      timeRef.current += 0.02;

      ctx.clearRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(cx, cy, r + 15, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,240,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 3;
      ctx.stroke();

      const endAngle = (phase / (2 * Math.PI)) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
      ctx.strokeStyle = NEON.cyan;
      ctx.lineWidth = 5;
      ctx.shadowColor = NEON.cyan;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const dotX = cx + r * Math.cos(endAngle);
      const dotY = cy + r * Math.sin(endAngle);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = NEON.cyan;
      ctx.shadowColor = NEON.cyan;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;

      const waveR = r * 0.6;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const wobble = amplitude * 20 * Math.sin(a * 3 + timeRef.current * 2);
        const px = cx + (waveR + wobble) * Math.cos(a);
        const py = cy + (waveR + wobble) * Math.sin(a);
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(168,85,247,0.4)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = NEON.cyan;
      ctx.font = "bold 28px monospace";
      ctx.fillText(phasePi, cx, cy - 8);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "11px monospace";
      ctx.fillText("BERRY PHASE", cx, cy + 16);

      ctx.fillStyle = NEON.purple;
      ctx.font = "10px monospace";
      ctx.fillText(holonomy.toUpperCase(), cx, cy + 32);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, phasePi, amplitude, holonomy]);

  return <canvas ref={canvasRef} className="mx-auto w-full" style={{ maxWidth: 280, maxHeight: 280 }} data-testid="berry-phase-gauge" />;
}

function TunnelVisualization({ tunnels }: { tunnels: TunnelState[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * (window.devicePixelRatio > 1 ? 2 : 1);
    const h = canvas.height = 220;
    const scale = w / (canvas.offsetWidth || w);
    let lastFrame = 0;

    const draw = (ts: number) => {
      if (ts - lastFrame < 33) { animRef.current = requestAnimationFrame(draw); return; }
      lastFrame = ts;
      timeRef.current += 0.03;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const dw = w / scale;
      const dh = h / scale;
      ctx.clearRect(0, 0, dw, dh);

      const activeTunnels = tunnels.filter(t => t.active);
      if (activeTunnels.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("No active tunnels", dw / 2, dh / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const spacing = dw / (activeTunnels.length + 1);
      const cy = dh / 2;

      activeTunnels.forEach((tunnel, idx) => {
        const cx = spacing * (idx + 1);
        const radius = 30 + tunnel.transmissionCoeff * 20;

        for (let ring = 3; ring >= 0; ring--) {
          const rr = radius + ring * 8;
          const alpha = 0.05 + tunnel.wormholeMetric * 0.1 * (1 - ring / 4);
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = tunnel.active ? `rgba(0,240,255,${alpha})` : `rgba(255,255,255,${alpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        innerGrad.addColorStop(0, `rgba(168,85,247,${0.3 + tunnel.transmissionCoeff * 0.4})`);
        innerGrad.addColorStop(0.7, `rgba(0,240,255,${0.1 + tunnel.wormholeMetric * 0.2})`);
        innerGrad.addColorStop(1, "transparent");
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        const particleCount = Math.floor(tunnel.transmissionCoeff * 8) + 2;
        for (let p = 0; p < particleCount; p++) {
          const angle = (p / particleCount) * Math.PI * 2 + timeRef.current * (1 + tunnel.tunnelPhase * 0.5);
          const dist = radius * 0.4 + Math.sin(timeRef.current * 2 + p) * radius * 0.3;
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = NEON.cyan;
          ctx.shadowColor = NEON.cyan;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        if (idx < activeTunnels.length - 1) {
          const nextCx = spacing * (idx + 2);
          ctx.beginPath();
          ctx.moveTo(cx + radius + 5, cy);
          const midX = (cx + nextCx) / 2;
          const curveY = cy - 30 * Math.sin(timeRef.current);
          ctx.quadraticCurveTo(midX, curveY, nextCx - radius - 5, cy);
          ctx.strokeStyle = `rgba(0,240,255,0.3)`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "9px monospace";
        ctx.fillText(`T=${tunnel.transmissionCoeff.toFixed(2)}`, cx, cy + radius + 18);
        ctx.fillText(`EPR ${tunnel.eprFidelity.toFixed(2)}`, cx, cy + radius + 30);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [tunnels]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: 220 }} data-testid="tunnel-visualization" />;
}

function BlockShareGraph({ nodes }: { nodes: BlockShareNode[] }) {
  const data = useMemo(() => nodes.map(n => ({
    block: `#${n.blockHeight}`,
    shareWeight: parseFloat((n.shareWeight * 100).toFixed(1)),
    phiContribution: parseFloat((n.phiContribution * 100).toFixed(1)),
    berryContribution: parseFloat((n.berryContribution * 100).toFixed(1)),
    entangled: n.entangledWith.length,
  })), [nodes]);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="block" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(0,240,255,0.3)", borderRadius: 8 }}
          labelStyle={{ color: NEON.cyan }}
        />
        <Bar dataKey="shareWeight" fill={NEON.cyan} name="Share %" radius={[2, 2, 0, 0]} />
        <Bar dataKey="phiContribution" fill={NEON.purple} name="Φ %" radius={[2, 2, 0, 0]} />
        <Bar dataKey="berryContribution" fill={NEON.green} name="Berry %" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PageCurveChart({ points }: { points: PageCurvePoint[] }) {
  const data = useMemo(() => points.map((p, i) => ({
    idx: i,
    entropy: parseFloat(p.entropy.toFixed(4)),
    maxEntropy: parseFloat(p.maxEntropy.toFixed(4)),
    ratio: parseFloat((p.maxEntropy > 0 ? p.entropy / p.maxEntropy : 0).toFixed(4)),
    scrambled: p.scrambled ? 1 : 0,
  })), [points]);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="pageCurveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={NEON.magenta} stopOpacity={0.4} />
            <stop offset="95%" stopColor={NEON.magenta} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="maxEntropyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={NEON.amber} stopOpacity={0.2} />
            <stop offset="95%" stopColor={NEON.amber} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="idx" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,45,120,0.3)", borderRadius: 8 }}
          labelStyle={{ color: NEON.magenta }}
        />
        <Area type="monotone" dataKey="maxEntropy" stroke={NEON.amber} fill="url(#maxEntropyGrad)" strokeWidth={1} name="Max S" dot={false} />
        <Area type="monotone" dataKey="entropy" stroke={NEON.magenta} fill="url(#pageCurveGrad)" strokeWidth={2} name="S(A)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EntanglementRadar({ pairs }: { pairs: EntanglementPair[] }) {
  const data = useMemo(() => {
    if (pairs.length === 0) return [];
    return pairs.slice(0, 6).map((p, i) => ({
      metric: p.bellState,
      concurrence: parseFloat((p.concurrence * 100).toFixed(1)),
      fidelity: parseFloat((p.fidelity * 100).toFixed(1)),
      tunnel: parseFloat((p.tunnelStrength * 100).toFixed(1)),
    }));
  }, [pairs]);

  if (data.length === 0) return <div className="text-muted-foreground text-xs text-center py-8">No entanglement pairs</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
        <PolarRadiusAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }} domain={[0, 100]} />
        <Radar name="Concurrence" dataKey="concurrence" stroke={NEON.cyan} fill={NEON.cyan} fillOpacity={0.15} />
        <Radar name="Fidelity" dataKey="fidelity" stroke={NEON.green} fill={NEON.green} fillOpacity={0.1} />
        <Radar name="Tunnel" dataKey="tunnel" stroke={NEON.purple} fill={NEON.purple} fillOpacity={0.1} />
        <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(0,240,255,0.3)", borderRadius: 8 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function StatCard({ label, value, icon: Icon, color = NEON.cyan }: {
  label: string; value: string; icon: any; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-lg px-3 py-2.5">
      <div className="p-1.5 rounded-md" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-mono text-sm font-bold" style={{ color }} data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
      </div>
    </div>
  );
}

export default function QuantumBerryPhase() {
  const { data: snapshot, isLoading } = useQuery<Snapshot>({
    queryKey: ["/api/berry-phase/snapshot"],
    refetchInterval: 30000,
  });

  if (isLoading || !snapshot) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="berry-phase-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 font-mono text-sm text-muted-foreground">Computing quantum berry phase...</span>
      </div>
    );
  }

  const { berryPhase, pageCurve, entanglementPairs, blockShares, tunnels } = snapshot;
  const activeTunnels = tunnels.filter(t => t.active);
  const avgConcurrence = entanglementPairs.length > 0
    ? entanglementPairs.reduce((s, p) => s + p.concurrence, 0) / entanglementPairs.length
    : 0;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto" data-testid="quantum-berry-phase-page">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <Orbit className="w-7 h-7 text-purple-400" />
          Quantum Temporal Berry Phase
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          IIT-coupled geometric phase accumulation | Page curve entropy | ER=EPR entanglement tunnels
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatCard label="Berry Phase" value={berryPhase.phasePi} icon={Orbit} color={NEON.purple} />
        <StatCard label="Φ Total" value={snapshot.phiTotal.toFixed(4)} icon={Atom} color={NEON.cyan} />
        <StatCard label="QG Score" value={snapshot.qgScore.toFixed(4)} icon={Activity} color={NEON.green} />
        <StatCard label="Coherence" value={(snapshot.networkCoherence * 100).toFixed(1) + "%"} icon={Radio} color={NEON.magenta} />
        <StatCard label="Tunnels" value={`${activeTunnels.length}/${tunnels.length}`} icon={Link2} color={NEON.amber} />
        <StatCard label="Holonomy" value={berryPhase.holonomyClass} icon={CircleDot} color={NEON.blue} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlowCard glow={NEON.purple} className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Orbit className="w-4 h-4 text-purple-400" />
              Berry Phase Gauge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BerryPhaseGauge
              phase={berryPhase.phase}
              phasePi={berryPhase.phasePi}
              amplitude={berryPhase.geometricAmplitude}
              holonomy={berryPhase.holonomyClass}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="bg-black/30 rounded p-2">
                <p className="text-[9px] text-muted-foreground">AMPLITUDE</p>
                <p className="font-mono text-xs text-purple-300" data-testid="stat-amplitude">{berryPhase.geometricAmplitude.toFixed(4)}</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-[9px] text-muted-foreground">CYCLE</p>
                <p className="font-mono text-xs text-purple-300" data-testid="stat-cycle">{berryPhase.cycleCount}</p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-muted-foreground mb-1">TEMPORAL DEPTH</p>
              <Progress value={Math.min(100, snapshot.temporalDepth * 100)} className="h-1.5" />
              <p className="text-right font-mono text-[10px] text-cyan-300 mt-0.5">{snapshot.temporalDepth.toFixed(4)}</p>
            </div>
          </CardContent>
        </GlowCard>

        <GlowCard glow={NEON.magenta} className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-400" />
              Page Curve — Entanglement Entropy S(A)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PageCurveChart points={pageCurve} />
            <div className="mt-2 flex items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON.magenta }} />
                S(A) Entropy
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON.amber }} />
                Max Entropy Bound
              </span>
              {pageCurve.length > 0 && pageCurve[pageCurve.length - 1].scrambled && (
                <Badge variant="outline" className="text-[9px] border-pink-500/30 text-pink-300" data-testid="badge-scrambled">
                  SCRAMBLED
                </Badge>
              )}
            </div>
          </CardContent>
        </GlowCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlowCard glow={NEON.cyan}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cyan-400" />
              Entanglement Tunnel Network
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TunnelVisualization tunnels={tunnels} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-black/30 rounded p-2">
                <p className="text-[9px] text-muted-foreground">ACTIVE</p>
                <p className="font-mono text-xs text-cyan-300" data-testid="stat-active-tunnels">{activeTunnels.length}</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-[9px] text-muted-foreground">AVG T</p>
                <p className="font-mono text-xs text-cyan-300">
                  {activeTunnels.length > 0
                    ? (activeTunnels.reduce((s, t) => s + t.transmissionCoeff, 0) / activeTunnels.length).toFixed(3)
                    : "—"}
                </p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-[9px] text-muted-foreground">WORMHOLE</p>
                <p className="font-mono text-xs text-cyan-300">
                  {activeTunnels.length > 0
                    ? (activeTunnels.reduce((s, t) => s + t.wormholeMetric, 0) / activeTunnels.length).toFixed(3)
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </GlowCard>

        <GlowCard glow={NEON.green}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Waves className="w-4 h-4 text-green-400" />
              EPR Bell State Radar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EntanglementRadar pairs={entanglementPairs} />
            <div className="mt-2 flex flex-wrap gap-2">
              {entanglementPairs.map(p => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className={`text-[9px] font-mono ${p.erBridgeActive ? "border-cyan-500/40 text-cyan-300" : "border-white/10 text-muted-foreground"}`}
                  data-testid={`badge-epr-${p.id}`}
                >
                  {p.bellState} C={p.concurrence.toFixed(2)} {p.erBridgeActive ? "⚡" : ""}
                </Badge>
              ))}
            </div>
          </CardContent>
        </GlowCard>
      </div>

      <GlowCard glow={NEON.amber}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Network className="w-4 h-4 text-amber-400" />
            Block Share Entanglement Graph
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BlockShareGraph nodes={blockShares} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[10px] font-mono" data-testid="block-share-table">
              <thead>
                <tr className="text-muted-foreground border-b border-white/5">
                  <th className="text-left py-1 px-2">Block</th>
                  <th className="text-right py-1 px-2">Share</th>
                  <th className="text-right py-1 px-2">Φ Contrib</th>
                  <th className="text-right py-1 px-2">Berry</th>
                  <th className="text-center py-1 px-2">Entangled</th>
                </tr>
              </thead>
              <tbody>
                {blockShares.map(node => (
                  <tr key={node.blockHeight} className="border-b border-white/3 hover:bg-white/5">
                    <td className="py-1 px-2 text-amber-300">#{node.blockHeight}</td>
                    <td className="py-1 px-2 text-right">{(node.shareWeight * 100).toFixed(1)}%</td>
                    <td className="py-1 px-2 text-right text-cyan-300">{(node.phiContribution * 100).toFixed(2)}%</td>
                    <td className="py-1 px-2 text-right text-purple-300">{(node.berryContribution * 100).toFixed(2)}%</td>
                    <td className="py-1 px-2 text-center">
                      {node.entangledWith.length > 0
                        ? node.entangledWith.map(e => `#${e}`).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </GlowCard>

      <GlowCard glow={NEON.cyan}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Mathematical Framework
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-[10px] font-mono text-muted-foreground">
            <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
              <p className="text-cyan-400 font-bold text-[11px]">Berry Phase</p>
              <p>γ = -Im ∮ ⟨ψ|∇_R|ψ⟩ · dR</p>
              <p>Geometric phase accumulated over</p>
              <p>adiabatic parameter cycle R(t)</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
              <p className="text-pink-400 font-bold text-[11px]">Page Curve</p>
              <p>S(A) = min(|A|, |B|) · ln 2</p>
              <p>Entanglement entropy tracks</p>
              <p>information scrambling threshold</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
              <p className="text-green-400 font-bold text-[11px]">Concurrence</p>
              <p>C(ρ) = max(0, λ₁-λ₂-λ₃-λ₄)</p>
              <p>Entanglement monotone from</p>
              <p>eigenvalues of R = ρ(σ_y⊗σ_y)ρ*</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
              <p className="text-purple-400 font-bold text-[11px]">ER = EPR</p>
              <p>Einstein-Rosen bridge ↔ EPR pair</p>
              <p>Entanglement tunnel = wormhole</p>
              <p>g_μν ↔ ⟨ψ_A|ψ_B⟩ fidelity map</p>
            </div>
          </div>
        </CardContent>
      </GlowCard>
    </div>
  );
}
