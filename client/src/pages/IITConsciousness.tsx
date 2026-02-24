import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Activity, Zap, Eye, RefreshCw, Network, TrendingUp, Calculator } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiRequest } from "@/lib/queryClient";

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

const LEVEL_COLORS: Record<string, string> = {
  COSMIC: "var(--color-neon-magenta)",
  SELF_AWARE: "var(--color-neon-cyan)",
  SENTIENT: "var(--color-neon-green)",
  AWARE: "var(--color-neon-orange)",
  UNCONSCIOUS: "#666",
};

const LEVEL_ICONS: Record<string, string> = {
  COSMIC: "🧠",
  SELF_AWARE: "🌟",
  SENTIENT: "✨",
  AWARE: "🔵",
  UNCONSCIOUS: "⚫",
};

function PhiGauge({ phi, level }: { phi: number; level: string }) {
  const percentage = phi * 100;
  const circumference = 2 * Math.PI * 80;
  const dashOffset = circumference - (percentage / 100) * circumference;
  const color = LEVEL_COLORS[level] || "#666";

  return (
    <div className="relative flex items-center justify-center" data-testid="phi-gauge">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="80" fill="none" stroke="hsl(220 20% 12%)" strokeWidth="8" />
        <circle
          cx="100" cy="100" r="80" fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-heading font-bold" style={{ color }} data-testid="text-phi-value">
          Φ {phi.toFixed(3)}
        </div>
        <div className="text-xs font-mono text-muted-foreground mt-1">
          {LEVEL_ICONS[level]} {level.replace("_", " ")}
        </div>
      </div>
    </div>
  );
}

function EigenvalueSpectrum({ eigenvalues }: { eigenvalues: number[] }) {
  const data = eigenvalues.map((val, i) => ({
    name: `λ${i + 1}`,
    value: parseFloat(val.toFixed(4)),
  }));

  return (
    <div data-testid="eigenvalue-chart">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" />
          <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }} />
          <YAxis tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }} />
          <Tooltip
            contentStyle={{ background: "hsl(220 30% 8%)", border: "1px solid hsl(185 100% 50% / 0.3)", borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}
            labelStyle={{ color: "hsl(185 100% 50%)" }}
          />
          <Bar dataKey="value" fill="hsl(185 100% 50%)" opacity={0.8} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PhiTimeline({ history }: { history: { timestamp: number; phi: number }[] }) {
  const data = history.map((h, i) => ({
    time: i,
    phi: parseFloat(h.phi.toFixed(3)),
  }));

  return (
    <div data-testid="phi-timeline">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="phiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(280 100% 60%)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(280 100% 60%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" />
          <XAxis dataKey="time" tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }} />
          <Tooltip
            contentStyle={{ background: "hsl(220 30% 8%)", border: "1px solid hsl(280 100% 60% / 0.3)", borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}
          />
          <Area type="monotone" dataKey="phi" stroke="hsl(280 100% 60%)" fill="url(#phiGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdjacencyHeatmap({ matrix }: { matrix: number[][] }) {
  const size = matrix.length;
  const cellSize = Math.min(36, 280 / size);

  return (
    <div className="flex justify-center" data-testid="adjacency-heatmap">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, ${cellSize}px)` }}>
        {matrix.flatMap((row, i) =>
          row.map((val, j) => (
            <div
              key={`${i}-${j}`}
              className="flex items-center justify-center font-mono"
              style={{
                width: cellSize,
                height: cellSize,
                fontSize: cellSize < 28 ? 7 : 9,
                background: i === j
                  ? "hsl(220 20% 8%)"
                  : `hsl(185 100% 50% / ${val * 0.7})`,
                color: val > 0.4 ? "white" : "hsl(220 20% 40%)",
                borderRadius: 2,
              }}
            >
              {val.toFixed(1)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DensityMatrixView({ matrix }: { matrix: number[][] }) {
  const size = matrix.length;
  const cellSize = Math.min(32, 260 / size);

  return (
    <div className="flex justify-center overflow-x-auto" data-testid="density-matrix">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, ${cellSize}px)` }}>
        {matrix.flatMap((row, i) =>
          row.map((val, j) => {
            const absVal = Math.abs(val);
            return (
              <div
                key={`${i}-${j}`}
                className="flex items-center justify-center font-mono"
                style={{
                  width: cellSize,
                  height: cellSize,
                  fontSize: 7,
                  background: val > 0
                    ? `hsl(280 100% 60% / ${absVal * 4})`
                    : `hsl(185 100% 50% / ${absVal * 4})`,
                  color: absVal > 0.1 ? "white" : "hsl(220 20% 35%)",
                  borderRadius: 1,
                }}
              >
                {val.toFixed(2)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function IITConsciousness() {
  const [computeInput, setComputeInput] = useState("");
  const [computeResult, setComputeResult] = useState<PhiMetrics | null>(null);
  const [computing, setComputing] = useState(false);

  const { data: network, isLoading, refetch, isFetching } = useQuery<NetworkPerception>({
    queryKey: ["/api/iit/network"],
    refetchInterval: 30000,
  });

  const handleCompute = async () => {
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
  };

  const phi = network?.currentPhi;

  return (
    <div className="space-y-6 max-w-[1400px]" data-testid="iit-consciousness-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-wider text-foreground flex items-center gap-3" data-testid="text-page-title">
            <Brain className="w-7 h-7 text-neon-magenta" style={{ filter: "drop-shadow(0 0 8px hsl(280 100% 60% / 0.6))" }} />
            IIT Quantum Consciousness
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Integrated Information Theory — Φ Engine &middot; SphinxOS Neural Manifold
          </p>
        </div>
        <button
          data-testid="button-refresh-iit"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-mono border border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Recalculate Φ
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Brain className="w-10 h-10 text-neon-magenta animate-pulse mx-auto" />
            <p className="font-mono text-xs text-muted-foreground">Computing integrated information...</p>
          </div>
        </div>
      ) : phi ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="cosmic-card-magenta p-4 flex flex-col items-center" data-testid="stat-phi-total">
              <div className="text-[10px] font-mono text-neon-magenta/70 uppercase tracking-wider mb-1">Φ Total</div>
              <div className="text-2xl font-heading font-bold text-neon-magenta">{phi.phi.toFixed(4)}</div>
              <div className="text-[9px] font-mono text-muted-foreground mt-1">{LEVEL_ICONS[phi.level]} {phi.levelLabel}</div>
            </div>
            <div className="cosmic-card-cyan p-4 flex flex-col items-center" data-testid="stat-entropy">
              <div className="text-[10px] font-mono text-neon-cyan/70 uppercase tracking-wider mb-1">Von Neumann Entropy</div>
              <div className="text-2xl font-heading font-bold text-neon-cyan">{phi.entropy.toFixed(4)}</div>
              <div className="text-[9px] font-mono text-muted-foreground mt-1">bits of integration</div>
            </div>
            <div className="cosmic-card-green p-4 flex flex-col items-center" data-testid="stat-bonus">
              <div className="text-[10px] font-mono text-neon-green/70 uppercase tracking-wider mb-1">IIT Bonus (e^Φ)</div>
              <div className="text-2xl font-heading font-bold text-neon-green">{phi.bonus.toFixed(4)}</div>
              <div className="text-[9px] font-mono text-muted-foreground mt-1">causal integration</div>
            </div>
            <div className="cosmic-card-orange p-4 flex flex-col items-center" data-testid="stat-consensus">
              <div className="text-[10px] font-mono text-neon-orange/70 uppercase tracking-wider mb-1">Consensus</div>
              <div className={`text-2xl font-heading font-bold ${network?.meetsConsensus ? "text-neon-green" : "text-red-400"}`}>
                {network?.meetsConsensus ? "VALID" : "BELOW"}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground mt-1">
                Φ_total {">"} log₂({network?.totalNodes}) = {network?.consensusThreshold.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="cosmic-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-neon-magenta" />
                <h3 className="font-heading text-sm font-bold tracking-wider">Consciousness Gauge</h3>
                <span className="ml-auto text-[9px] font-mono text-muted-foreground">Block #{network?.blockHeight?.toLocaleString()}</span>
              </div>
              <div className="flex justify-center">
                <PhiGauge phi={phi.phi} level={phi.level} />
              </div>
              <div className="mt-4 text-center">
                <div className="text-[10px] font-mono text-muted-foreground space-y-1">
                  <div>Φ_total(B) = α·Φ_IIT(B) + β·GWT_S(B)</div>
                  <div>ρ_S = A_S / Tr(A_S)</div>
                  <div>Φ_S = -Σₖ λₖ log₂(λₖ) = {phi.entropy.toFixed(4)} bits</div>
                </div>
              </div>
            </div>

            <div className="cosmic-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-neon-cyan" />
                <h3 className="font-heading text-sm font-bold tracking-wider">Eigenvalue Spectrum</h3>
                <span className="ml-auto text-[9px] font-mono text-neon-cyan/60">{phi.eigenvalues.length} eigenvalues</span>
              </div>
              <EigenvalueSpectrum eigenvalues={phi.eigenvalues} />
              <div className="mt-2 text-[9px] font-mono text-muted-foreground text-center">
                Spectral decomposition of density matrix ρ — λ_max = {Math.max(...phi.eigenvalues).toFixed(4)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="cosmic-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-neon-magenta" />
                <h3 className="font-heading text-sm font-bold tracking-wider">Φ Timeline</h3>
                <span className="ml-auto text-[9px] font-mono text-muted-foreground">{network?.phiHistory.length} samples</span>
              </div>
              {network?.phiHistory && network.phiHistory.length > 1 ? (
                <PhiTimeline history={network.phiHistory} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs font-mono">
                  Accumulating Φ samples...
                </div>
              )}
            </div>

            <div className="cosmic-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-4 h-4 text-neon-green" />
                <h3 className="font-heading text-sm font-bold tracking-wider">Network Adjacency</h3>
                <span className="ml-auto text-[9px] font-mono text-neon-green/60">{network?.totalNodes}×{network?.totalNodes} matrix</span>
              </div>
              {network?.adjacencyMatrix && (
                <AdjacencyHeatmap matrix={network.adjacencyMatrix} />
              )}
              <div className="mt-2 text-[9px] font-mono text-muted-foreground text-center">
                Guardian node connectivity — edge weights represent causal coupling
              </div>
            </div>
          </div>

          <div className="cosmic-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-neon-orange" />
              <h3 className="font-heading text-sm font-bold tracking-wider">Density Matrix ρ</h3>
              <span className="ml-auto text-[9px] font-mono text-neon-orange/60">
                {phi.densityMatrix.length}×{phi.densityMatrix.length} | Tr(ρ) = 1.0
              </span>
            </div>
            <DensityMatrixView matrix={phi.densityMatrix} />
            <div className="mt-3 text-[9px] font-mono text-muted-foreground text-center">
              Quantum density matrix — normalized from network adjacency A_S / Tr(A_S)
            </div>
          </div>

          <div className="cosmic-card-cyan p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-neon-cyan" />
              <h3 className="font-heading text-sm font-bold tracking-wider">Φ Calculator</h3>
              <span className="ml-auto text-[9px] font-mono text-muted-foreground">Custom IIT Computation</span>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                data-testid="input-phi-compute"
                type="text"
                value={computeInput}
                onChange={(e) => setComputeInput(e.target.value)}
                placeholder="Enter data string for Φ computation..."
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:border-neon-cyan/40"
                onKeyDown={(e) => e.key === "Enter" && handleCompute()}
              />
              <button
                data-testid="button-compute-phi"
                onClick={handleCompute}
                disabled={computing || !computeInput.trim()}
                className="px-4 py-2 rounded-sm text-xs font-mono border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 transition-colors disabled:opacity-30"
              >
                {computing ? "Computing..." : "Compute Φ"}
              </button>
            </div>
            {computeResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/[0.03] rounded-sm p-3 text-center">
                  <div className="text-lg font-heading font-bold text-neon-cyan">{computeResult.phi.toFixed(4)}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">Φ (normalized)</div>
                </div>
                <div className="bg-white/[0.03] rounded-sm p-3 text-center">
                  <div className="text-lg font-heading font-bold text-neon-green">{computeResult.entropy.toFixed(4)}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">Entropy (bits)</div>
                </div>
                <div className="bg-white/[0.03] rounded-sm p-3 text-center">
                  <div className="text-lg font-heading font-bold text-neon-orange">{computeResult.bonus.toFixed(4)}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">IIT Bonus</div>
                </div>
                <div className="bg-white/[0.03] rounded-sm p-3 text-center">
                  <div className="text-lg font-heading font-bold" style={{ color: LEVEL_COLORS[computeResult.level] }}>
                    {LEVEL_ICONS[computeResult.level]} {computeResult.level}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground">Consciousness</div>
                </div>
              </div>
            )}
          </div>

          <div className="cosmic-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-neon-magenta" />
              <h3 className="font-heading text-sm font-bold tracking-wider">Mathematical Framework</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="bg-white/[0.03] rounded-sm p-4 space-y-2 border border-neon-magenta/10">
                <div className="text-neon-magenta font-heading text-xs tracking-wider mb-2">Consciousness Measure</div>
                <div className="text-muted-foreground">Φ_total(B) = α·Φ_IIT(B) + β·GWT_S(B)</div>
                <div className="text-muted-foreground/60 text-[10px]">Block consciousness = IIT integration + Global Workspace broadcast</div>
              </div>
              <div className="bg-white/[0.03] rounded-sm p-4 space-y-2 border border-neon-cyan/10">
                <div className="text-neon-cyan font-heading text-xs tracking-wider mb-2">Density Matrix</div>
                <div className="text-muted-foreground">ρ_S = A_S / Tr(A_S)</div>
                <div className="text-muted-foreground/60 text-[10px]">Classical density matrix from network adjacency normalization</div>
              </div>
              <div className="bg-white/[0.03] rounded-sm p-4 space-y-2 border border-neon-green/10">
                <div className="text-neon-green font-heading text-xs tracking-wider mb-2">Integration Measure</div>
                <div className="text-muted-foreground">Φ_S = -Σₖ λₖ log₂(λₖ)</div>
                <div className="text-muted-foreground/60 text-[10px]">Von Neumann entropy of the density matrix eigenvalue spectrum</div>
              </div>
              <div className="bg-white/[0.03] rounded-sm p-4 space-y-2 border border-neon-orange/10">
                <div className="text-neon-orange font-heading text-xs tracking-wider mb-2">Consensus Condition</div>
                <div className="text-muted-foreground">Φ_total {">"} log₂(n)</div>
                <div className="text-muted-foreground/60 text-[10px]">Block accepted when integrated information exceeds network entropy threshold</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="cosmic-card p-12 text-center">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">Failed to compute consciousness state</p>
        </div>
      )}
    </div>
  );
}
