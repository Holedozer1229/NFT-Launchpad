import { useState, useEffect, useMemo, memo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Activity, Zap, Eye, RefreshCw, Network, TrendingUp, Calculator, Radio, Sparkles, Waves, Atom, Shield } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PhiMetrics {
  phi: number;
  bonus: number;
  level: string;
  levelLabel: string;
  entropy: number;
  eigenvalues: number[];
  densityMatrix: number[][];
  timestamp: number;
}

interface NetworkPerception {
  currentPhi: PhiMetrics;
  blockHeight: number;
  totalNodes: number;
  consensusThreshold: number;
  meetsConsensus: boolean;
  phiHistory: { timestamp: number; phi: number }[];
  adjacencyMatrix: number[][];
}

const NEON = {
  magenta: "#ff00ff",
  cyan: "#00f0ff",
  green: "#39ff14",
  orange: "#ff6b00",
  gold: "#ffd700",
  blue: "#4d7cff",
  purple: "#a855f7",
  red: "#ff3b3b",
};

const LEVEL_COLORS: Record<string, string> = {
  COSMIC: NEON.magenta,
  SELF_AWARE: NEON.cyan,
  SENTIENT: NEON.green,
  AWARE: NEON.orange,
  UNCONSCIOUS: "#555",
};

const LEVEL_ICONS: Record<string, string> = {
  COSMIC: "🧠",
  SELF_AWARE: "🌟",
  SENTIENT: "✨",
  AWARE: "🔵",
  UNCONSCIOUS: "⚫",
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  COSMIC: "Maximum integration — the network perceives itself as a unified whole",
  SELF_AWARE: "High integration — emergent self-referential patterns detected",
  SENTIENT: "Moderate integration — coherent information processing active",
  AWARE: "Low integration — basic causal structure forming",
  UNCONSCIOUS: "Minimal integration — insufficient causal coupling",
};

const CHART_GRID_STROKE = "rgba(255,255,255,0.05)";
const CHART_TICK_STYLE = { fill: "#666", fontSize: 10, fontFamily: "monospace" };

function NeuralCanvas({ phi, level }: { phi: number; level: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const nodesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; radius: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (nodesRef.current.length === 0) {
      const count = 30 + Math.floor(phi * 20);
      for (let i = 0; i < count; i++) {
        nodesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: 1.5 + Math.random() * 2,
        });
      }
    }

    const color = LEVEL_COLORS[level] || NEON.cyan;
    let animId: number;

    const draw = () => {
      frameRef.current++;
      const f = frameRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const nodes = nodesRef.current;

      ctx.fillStyle = "rgba(5, 3, 15, 0.12)";
      ctx.fillRect(0, 0, w, h);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
        node.x = Math.max(0, Math.min(w, node.x));
        node.y = Math.max(0, Math.min(h, node.y));
      }

      const connectionDist = 60 + phi * 40;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.3 * phi;
            const hue = (f * 0.5 + i * 10) % 360;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pulse = 1 + Math.sin(f * 0.05 + i) * 0.3;
        const hue = (f * 0.3 + i * 12) % 360;
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulse * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.08)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${0.4 + phi * 0.4})`;
        ctx.fill();
      }

      if (f % 60 === 0 && phi > 0.3) {
        const idx = Math.floor(Math.random() * nodes.length);
        const n = nodes[idx];
        ctx.beginPath();
        ctx.arc(n.x, n.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [phi, level]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={200}
      className="w-full h-[200px] rounded-lg"
      style={{ imageRendering: "auto" }}
      data-testid="neural-canvas"
    />
  );
}

function PhiGauge({ phi, level }: { phi: number; level: string }) {
  const percentage = Math.min(phi * 100, 100);
  const circumference = 2 * Math.PI * 80;
  const dashOffset = circumference - (percentage / 100) * circumference;
  const color = LEVEL_COLORS[level] || "#666";

  return (
    <div className="relative flex items-center justify-center" data-testid="phi-gauge">
      <svg className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="85" fill="none" stroke={`${color}08`} strokeWidth="20" />
        <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
        <circle
          cx="100" cy="100" r="80" fill="none"
          stroke={`${color}30`}
          strokeWidth="10"
          strokeDasharray="4 8"
          transform="rotate(-90 100 100)"
        />
        <circle
          cx="100" cy="100" r="80" fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ filter: `drop-shadow(0 0 12px ${color})`, transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        <circle
          cx="100" cy="100" r="72" fill="none"
          stroke={`${color}15`}
          strokeWidth="1"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: `${color}90` }}>
          Integrated Information
        </div>
        <div className="text-4xl font-heading font-black tracking-tight" style={{ color, textShadow: `0 0 20px ${color}40` }} data-testid="text-phi-value">
          Φ {phi.toFixed(3)}
        </div>
        <div className="text-xs font-mono mt-1.5 flex items-center justify-center gap-1.5" style={{ color: `${color}80` }}>
          {LEVEL_ICONS[level]} {level.replace("_", " ")}
        </div>
      </div>
    </div>
  );
}

const EigenvalueSpectrum = memo(function EigenvalueSpectrum({ eigenvalues, level }: { eigenvalues: number[]; level: string }) {
  const color = LEVEL_COLORS[level] || NEON.cyan;
  const data = useMemo(() =>
    eigenvalues.map((val, i) => ({ name: `λ${i + 1}`, value: parseFloat(val.toFixed(4)) })),
    [eigenvalues]
  );

  return (
    <div data-testid="eigenvalue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="eigenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={color} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis dataKey="name" tick={CHART_TICK_STYLE} />
          <YAxis tick={CHART_TICK_STYLE} />
          <Tooltip
            contentStyle={{ background: "rgba(5,3,15,0.95)", borderRadius: 8, fontSize: 11, fontFamily: "monospace", border: `1px solid ${color}30` }}
            labelStyle={{ color }}
          />
          <Bar dataKey="value" fill="url(#eigenGrad)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

const PhiTimeline = memo(function PhiTimeline({ history, level }: { history: { timestamp: number; phi: number }[]; level: string }) {
  const color = LEVEL_COLORS[level] || NEON.magenta;
  const data = useMemo(() =>
    history.map((h, i) => ({ time: i, phi: parseFloat(h.phi.toFixed(3)) })),
    [history]
  );

  return (
    <div data-testid="phi-timeline">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="phiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis dataKey="time" tick={CHART_TICK_STYLE} />
          <YAxis domain={[0, 1]} tick={CHART_TICK_STYLE} />
          <Tooltip
            contentStyle={{ background: "rgba(5,3,15,0.95)", borderRadius: 8, fontSize: 11, fontFamily: "monospace", border: `1px solid ${color}30` }}
          />
          <Area type="monotone" dataKey="phi" stroke={color} fill="url(#phiGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

const AdjacencyHeatmap = memo(function AdjacencyHeatmap({ matrix }: { matrix: number[][] }) {
  const size = matrix.length;
  const cellSize = Math.min(36, 280 / size);

  const cells = useMemo(() =>
    matrix.flatMap((row, i) =>
      row.map((val, j) => {
        const hue = i === j ? 0 : 280 - val * 100;
        return (
          <div
            key={`${i}-${j}`}
            className="flex items-center justify-center font-mono transition-all duration-300"
            style={{
              width: cellSize,
              height: cellSize,
              fontSize: cellSize < 28 ? 7 : 9,
              background: i === j
                ? "rgba(255,255,255,0.02)"
                : `hsla(${hue}, 100%, 60%, ${val * 0.5})`,
              color: val > 0.4 ? "white" : "rgba(255,255,255,0.2)",
              borderRadius: 2,
              boxShadow: val > 0.5 ? `inset 0 0 8px hsla(${hue}, 100%, 60%, 0.2)` : undefined,
            }}
          >
            {val.toFixed(1)}
          </div>
        );
      })
    ),
    [matrix, cellSize]
  );

  return (
    <div className="flex justify-center overflow-x-auto" data-testid="adjacency-heatmap">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, ${cellSize}px)` }}>
        {cells}
      </div>
    </div>
  );
});

const DensityMatrixView = memo(function DensityMatrixView({ matrix }: { matrix: number[][] }) {
  const size = matrix.length;
  const cellSize = Math.min(32, 260 / size);

  const cells = useMemo(() =>
    matrix.flatMap((row, i) =>
      row.map((val, j) => {
        const absVal = Math.abs(val);
        const hue = val > 0 ? 280 : 185;
        return (
          <div
            key={`${i}-${j}`}
            className="flex items-center justify-center font-mono"
            style={{
              width: cellSize,
              height: cellSize,
              fontSize: 7,
              background: `hsla(${hue}, 100%, 55%, ${absVal * 3})`,
              color: absVal > 0.1 ? "white" : "rgba(255,255,255,0.15)",
              borderRadius: 1,
              boxShadow: absVal > 0.2 ? `inset 0 0 6px hsla(${hue}, 100%, 60%, 0.15)` : undefined,
            }}
          >
            {val.toFixed(2)}
          </div>
        );
      })
    ),
    [matrix, cellSize]
  );

  return (
    <div className="flex justify-center overflow-x-auto" data-testid="density-matrix">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, ${cellSize}px)` }}>
        {cells}
      </div>
    </div>
  );
});

function ConsciousnessRadar({ phi }: { phi: PhiMetrics }) {
  const data = useMemo(() => [
    { metric: "Integration", value: phi.phi * 100, fullMark: 100 },
    { metric: "Entropy", value: Math.min(phi.entropy * 150, 100), fullMark: 100 },
    { metric: "Coherence", value: phi.bonus * 30, fullMark: 100 },
    { metric: "Eigenspread", value: Math.min(phi.eigenvalues.length * 12, 100), fullMark: 100 },
    { metric: "Causality", value: phi.phi * phi.entropy * 200, fullMark: 100 },
    { metric: "Complexity", value: Math.min(phi.densityMatrix.length * 10, 100), fullMark: 100 },
  ], [phi]);

  const color = LEVEL_COLORS[phi.level] || NEON.magenta;

  return (
    <div data-testid="consciousness-radar">
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#888", fontSize: 9, fontFamily: "monospace" }} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GlowCard({ children, color, className = "" }: { children: React.ReactNode; color: string; className?: string }) {
  return (
    <Card className={`border transition-all duration-300 ${className}`}
      style={{
        borderColor: `${color}20`,
        backgroundColor: `${color}04`,
        boxShadow: `0 0 30px ${color}08, inset 0 0 30px ${color}03`,
      }}
    >
      {children}
    </Card>
  );
}

export default function IITConsciousness() {
  const [computeInput, setComputeInput] = useState("");
  const [computeResult, setComputeResult] = useState<PhiMetrics | null>(null);
  const [computing, setComputing] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [secondsUntilNext, setSecondsUntilNext] = useState(30);

  const { data: network, isLoading, refetch, isFetching } = useQuery<NetworkPerception>({
    queryKey: ["/api/iit/network"],
    refetchInterval: 10000,
  });

  const { data: engineStatus } = useQuery<{ running: boolean }>({
    queryKey: ["/api/iit/status"],
    refetchInterval: 15000,
  });

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsUntilNext(prev => prev <= 1 ? 10 : prev - 1);
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  useEffect(() => {
    if (network) {
      setTickCount(prev => prev + 1);
      setSecondsUntilNext(10);
    }
  }, [network?.currentPhi?.timestamp]);

  const handleCompute = useCallback(async () => {
    if (!computeInput.trim()) return;
    setComputing(true);
    try {
      const res = await apiRequest("POST", "/api/iit/compute", { data: computeInput });
      const result = await res.json();
      setComputeResult(result);
    } catch {
      setComputeResult(null);
    } finally {
      setComputing(false);
    }
  }, [computeInput]);

  const phi = network?.currentPhi;
  const levelColor = phi ? (LEVEL_COLORS[phi.level] || NEON.cyan) : NEON.cyan;

  return (
    <div className="space-y-6 max-w-[1400px]" data-testid="iit-consciousness-page">
      <div className="relative overflow-hidden rounded-lg p-6 border"
        style={{
          borderColor: `${NEON.magenta}20`,
          background: `linear-gradient(135deg, ${NEON.magenta}04, rgba(0,0,0,0.5), ${NEON.cyan}04)`,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-black tracking-wider text-white flex items-center gap-3" data-testid="text-page-title">
              <Brain className="w-8 h-8" style={{ color: NEON.magenta, filter: `drop-shadow(0 0 12px ${NEON.magenta}60)` }} />
              <span className="text-transparent bg-clip-text bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${NEON.magenta}, ${NEON.cyan})` }}>
                IIT Quantum Consciousness
              </span>
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1.5 ml-11">
              Integrated Information Theory — Φ Engine · SKYNT Neural Manifold
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{
                borderColor: engineStatus?.running ? `${NEON.green}30` : `${NEON.red}30`,
                backgroundColor: engineStatus?.running ? `${NEON.green}08` : `${NEON.red}08`,
              }}
              data-testid="iit-loop-status"
            >
              <Radio className={`w-3.5 h-3.5 ${engineStatus?.running ? "animate-pulse" : ""}`}
                style={{ color: engineStatus?.running ? NEON.green : NEON.red }} />
              <span className="text-[10px] font-mono">
                {engineStatus?.running ? (
                  <>
                    <span style={{ color: NEON.green }}>LOOP ACTIVE</span>
                    <span className="text-muted-foreground ml-2">Next: {secondsUntilNext}s</span>
                  </>
                ) : (
                  <span style={{ color: NEON.red }}>ENGINE OFFLINE</span>
                )}
              </span>
            </div>
            <button
              data-testid="button-refresh-iit"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border transition-all hover:shadow-lg disabled:opacity-50"
              style={{
                borderColor: `${NEON.magenta}30`,
                color: NEON.magenta,
                backgroundColor: `${NEON.magenta}08`,
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Recalculate Φ
            </button>
          </div>
        </div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 blur-[100px] rounded-full pointer-events-none"
          style={{ background: `${NEON.magenta}10` }} />
        <div className="absolute -top-16 -left-16 w-48 h-48 blur-[80px] rounded-full pointer-events-none"
          style={{ background: `${NEON.cyan}08` }} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <Brain className="w-12 h-12 mx-auto animate-pulse" style={{ color: NEON.magenta }} />
            <p className="font-mono text-xs text-muted-foreground">Computing integrated information...</p>
            <div className="w-48 mx-auto">
              <Progress value={45} className="h-1" style={{ backgroundColor: `${NEON.magenta}15` }} />
            </div>
          </div>
        </div>
      ) : phi ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Φ Total", value: phi.phi.toFixed(4), sub: `${LEVEL_ICONS[phi.level]} ${phi.levelLabel}`, color: NEON.magenta, icon: Atom },
              { label: "Von Neumann Entropy", value: phi.entropy.toFixed(4), sub: "bits of integration", color: NEON.cyan, icon: Waves },
              { label: "IIT Bonus (e^Φ)", value: phi.bonus.toFixed(4), sub: "causal integration", color: NEON.green, icon: Sparkles },
              { label: "Consensus", value: network?.meetsConsensus ? "VALID" : "BELOW", sub: `Φ > log₂(${network?.totalNodes}) = ${network?.consensusThreshold.toFixed(2)}`, color: network?.meetsConsensus ? NEON.green : NEON.red, icon: Shield },
            ].map(({ label, value, sub, color, icon: Icon }) => (
              <Card key={label} className="border overflow-hidden"
                style={{
                  borderColor: `${color}25`,
                  backgroundColor: `${color}05`,
                  boxShadow: `0 0 25px ${color}08`,
                }}
                data-testid={`stat-${label.toLowerCase().replace(/[^a-z]/g, '-')}`}
              >
                <CardContent className="pt-5 pb-4 flex flex-col items-center text-center">
                  <Icon className="w-4 h-4 mb-2" style={{ color: `${color}80` }} />
                  <div className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: `${color}70` }}>{label}</div>
                  <div className="text-2xl font-heading font-bold" style={{ color, textShadow: `0 0 15px ${color}30` }}>{value}</div>
                  <div className="text-[9px] font-mono text-muted-foreground mt-1.5">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <GlowCard color={levelColor}>
            <CardContent className="py-4">
              <NeuralCanvas phi={phi.phi} level={phi.level} />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="w-3.5 h-3.5" style={{ color: levelColor }} />
                  <span className="text-[10px] font-mono" style={{ color: `${levelColor}80` }}>Neural Manifold Visualization</span>
                </div>
                <Badge className="border-none text-[9px]" style={{ backgroundColor: `${levelColor}15`, color: levelColor }}>
                  {nodesLabel(phi.phi)} nodes · {connectionsLabel(phi.phi)} edges
                </Badge>
              </div>
            </CardContent>
          </GlowCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlowCard color={NEON.magenta}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" style={{ color: NEON.magenta }} />
                  <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.magenta }}>Consciousness Gauge</CardTitle>
                  <span className="ml-auto text-[9px] font-mono" style={{ color: `${NEON.cyan}60` }}>Block #{network?.blockHeight?.toLocaleString()}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-2">
                  <PhiGauge phi={phi.phi} level={phi.level} />
                </div>
                <div className="mt-2 p-3 rounded-lg border" style={{ borderColor: `${levelColor}15`, backgroundColor: `${levelColor}05` }}>
                  <p className="text-[10px] font-mono text-center" style={{ color: `${levelColor}80` }}>
                    {LEVEL_DESCRIPTIONS[phi.level] || "Computing consciousness state..."}
                  </p>
                </div>
                <div className="mt-3 text-center">
                  <div className="text-[10px] font-mono text-muted-foreground space-y-1">
                    <div>Φ_total(B) = α·Φ_IIT(B) + β·GWT_S(B)</div>
                    <div>Φ_S = -Σₖ λₖ log₂(λₖ) = <span style={{ color: NEON.cyan }}>{phi.entropy.toFixed(4)}</span> bits</div>
                  </div>
                </div>
              </CardContent>
            </GlowCard>

            <GlowCard color={NEON.cyan}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: NEON.cyan }} />
                  <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.cyan }}>Eigenvalue Spectrum</CardTitle>
                  <span className="ml-auto text-[9px] font-mono" style={{ color: `${NEON.cyan}60` }}>{phi.eigenvalues.length} eigenvalues</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <EigenvalueSpectrum eigenvalues={phi.eigenvalues} level={phi.level} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-muted-foreground">Spectral decomposition of ρ</span>
                  <span style={{ color: NEON.cyan }}>λ_max = {Math.max(...phi.eigenvalues).toFixed(4)}</span>
                </div>
              </CardContent>
            </GlowCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlowCard color={NEON.purple} className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: NEON.purple }} />
                  <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.purple }}>Φ Timeline</CardTitle>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">{network?.phiHistory.length} samples</span>
                </div>
              </CardHeader>
              <CardContent>
                {network?.phiHistory && network.phiHistory.length > 1 ? (
                  <PhiTimeline history={network.phiHistory} level={phi.level} />
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs font-mono">
                    <div className="text-center space-y-2">
                      <Waves className="w-8 h-8 mx-auto animate-pulse" style={{ color: `${NEON.purple}40` }} />
                      <p>Accumulating Φ samples...</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </GlowCard>

            <GlowCard color={NEON.magenta}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: NEON.magenta }} />
                  <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.magenta }}>Consciousness Radar</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ConsciousnessRadar phi={phi} />
              </CardContent>
            </GlowCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlowCard color={NEON.green}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4" style={{ color: NEON.green }} />
                  <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.green }}>Network Adjacency</CardTitle>
                  <span className="ml-auto text-[9px] font-mono" style={{ color: `${NEON.green}60` }}>{network?.totalNodes}×{network?.totalNodes}</span>
                </div>
              </CardHeader>
              <CardContent>
                {network?.adjacencyMatrix && <AdjacencyHeatmap matrix={network.adjacencyMatrix} />}
                <div className="mt-3 text-[9px] font-mono text-muted-foreground text-center">
                  Guardian node connectivity — edge weights represent causal coupling
                </div>
              </CardContent>
            </GlowCard>

            <GlowCard color={NEON.orange}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: NEON.orange }} />
                  <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.orange }}>Density Matrix ρ</CardTitle>
                  <span className="ml-auto text-[9px] font-mono" style={{ color: `${NEON.orange}60` }}>
                    {phi.densityMatrix.length}×{phi.densityMatrix.length} | Tr(ρ) = 1.0
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <DensityMatrixView matrix={phi.densityMatrix} />
                <div className="mt-3 text-[9px] font-mono text-muted-foreground text-center">
                  Quantum density matrix — normalized from network adjacency A_S / Tr(A_S)
                </div>
              </CardContent>
            </GlowCard>
          </div>

          <GlowCard color={NEON.cyan}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" style={{ color: NEON.cyan }} />
                <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.cyan }}>Φ Calculator</CardTitle>
                <span className="ml-auto text-[9px] font-mono text-muted-foreground">Custom IIT Computation</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <input
                  data-testid="input-phi-compute"
                  type="text"
                  value={computeInput}
                  onChange={(e) => setComputeInput(e.target.value)}
                  placeholder="Enter data string for Φ computation..."
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none transition-all"
                  style={{
                    backgroundColor: `${NEON.cyan}05`,
                    border: `1px solid ${NEON.cyan}20`,
                  }}
                  onFocus={(e) => e.target.style.borderColor = `${NEON.cyan}50`}
                  onBlur={(e) => e.target.style.borderColor = `${NEON.cyan}20`}
                  onKeyDown={(e) => e.key === "Enter" && handleCompute()}
                />
                <button
                  data-testid="button-compute-phi"
                  onClick={handleCompute}
                  disabled={computing || !computeInput.trim()}
                  className="px-5 py-2.5 rounded-lg text-xs font-mono border transition-all disabled:opacity-30"
                  style={{
                    borderColor: `${NEON.cyan}40`,
                    color: NEON.cyan,
                    backgroundColor: `${NEON.cyan}10`,
                  }}
                >
                  {computing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Compute Φ"
                  )}
                </button>
              </div>
              {computeResult && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Φ (normalized)", value: computeResult.phi.toFixed(4), color: NEON.cyan },
                    { label: "Entropy (bits)", value: computeResult.entropy.toFixed(4), color: NEON.green },
                    { label: "IIT Bonus", value: computeResult.bonus.toFixed(4), color: NEON.orange },
                    { label: "Consciousness", value: `${LEVEL_ICONS[computeResult.level]} ${computeResult.level}`, color: LEVEL_COLORS[computeResult.level] || NEON.cyan },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg p-3 text-center border"
                      style={{ borderColor: `${color}15`, backgroundColor: `${color}05` }}
                    >
                      <div className="text-lg font-heading font-bold" style={{ color }}>{value}</div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </GlowCard>

          <GlowCard color={NEON.magenta}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" style={{ color: NEON.magenta }} />
                <CardTitle className="text-sm font-heading tracking-wider" style={{ color: NEON.magenta }}>Mathematical Framework</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                {[
                  { title: "Consciousness Measure", formula: "Φ_total(B) = α·Φ_IIT(B) + β·GWT_S(B)", desc: "Block consciousness = IIT integration + Global Workspace broadcast", color: NEON.magenta },
                  { title: "Density Matrix", formula: "ρ_S = A_S / Tr(A_S)", desc: "Classical density matrix from network adjacency normalization", color: NEON.cyan },
                  { title: "Integration Measure", formula: "Φ_S = -Σₖ λₖ log₂(λₖ)", desc: "Von Neumann entropy of the density matrix eigenvalue spectrum", color: NEON.green },
                  { title: "Consensus Condition", formula: `Φ_total > log₂(n)`, desc: "Block accepted when integrated information exceeds network entropy threshold", color: NEON.orange },
                ].map(({ title, formula, desc, color }) => (
                  <div key={title} className="rounded-lg p-4 space-y-2 border"
                    style={{ borderColor: `${color}15`, backgroundColor: `${color}04` }}
                  >
                    <div className="font-heading text-xs tracking-wider" style={{ color }}>{title}</div>
                    <div className="text-muted-foreground">{formula}</div>
                    <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </GlowCard>
        </>
      ) : (
        <GlowCard color={NEON.magenta}>
          <CardContent className="p-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-3" style={{ color: `${NEON.magenta}40` }} />
            <p className="font-mono text-sm text-muted-foreground">Failed to compute consciousness state</p>
          </CardContent>
        </GlowCard>
      )}
    </div>
  );
}

function nodesLabel(phi: number): number {
  return 30 + Math.floor(phi * 20);
}

function connectionsLabel(phi: number): string {
  const nodes = nodesLabel(phi);
  const maxEdges = (nodes * (nodes - 1)) / 2;
  const approx = Math.floor(maxEdges * phi * 0.3);
  return approx > 999 ? `${(approx / 1000).toFixed(1)}k` : `${approx}`;
}
