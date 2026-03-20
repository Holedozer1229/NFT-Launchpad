import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Atom, Zap, Activity, TrendingUp, RotateCcw, Play, Cpu, Radio, Layers, GitBranch, Orbit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DysonState {
  primes: number[];
  specGaps: number[];
  latticeCorr: number;
  latticeCorrRot: number;
  quantumGaps: number[];
  chainCorrelation: number;
  finalCorrOrig: number;
  finalCorrRot: number;
  eigenvalues: number[];
  valknutPassRate: number;
  hashRateBoost: number;
  dysonEquilibrium: number;
  xiTolerance: number;
  epoch: number;
  lastUpdate: number;
}

interface Candidate {
  index: number;
  offset: number;
  xi: number;
  gap: number;
  passesFilter: boolean;
  hashRateBoost: number;
  dysonEquilibrium: number;
  berryPhase: number;
}

interface MineResult {
  nonce: number | null;
  blockHash: string | null;
  xi: number;
  dysonFactor: number;
  berryPhase: number;
  specCube: number;
  quantumFib: number;
  valknutPass: boolean;
  attempts: number;
  hashRateBoost: number;
  chainCorrelation: number;
}

// ─── Dyson Sphere Canvas Animation ───────────────────────────────────────────

function DysonSphereCanvas({ boost, equilibrium, epoch }: { boost: number; equilibrium: number; epoch: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.35;

    function draw(t: number) {
      ctx.clearRect(0, 0, W, H);

      // Deep space bg
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
      grad.addColorStop(0, "rgba(0,30,60,0.9)");
      grad.addColorStop(0.6, "rgba(0,10,30,0.95)");
      grad.addColorStop(1, "rgba(0,0,10,1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Star field
      const stars = 80;
      for (let s = 0; s < stars; s++) {
        const sx = ((s * 173 + 11) % W);
        const sy = ((s * 97 + 37) % H);
        const brightness = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.001 + s));
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${brightness * 0.6})`;
        ctx.fill();
      }

      // Dyson sphere rings (tilted ellipses)
      const ringCount = 7;
      for (let ri = 0; ri < ringCount; ri++) {
        const tilt = (ri / ringCount) * Math.PI;
        const speed = 0.3 + ri * 0.08;
        const angle = t * 0.001 * speed;
        const rScale = 0.5 + ri * 0.07;
        const rx = R * rScale;
        const ry = R * rScale * Math.abs(Math.cos(tilt + angle * 0.2));

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        const hue = 180 + ri * 20;
        const alpha = 0.15 + 0.25 * (equilibrium / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue},80%,60%,${alpha})`;
        ctx.lineWidth = 1 + (boost - 1) * 0.3;
        ctx.stroke();

        // Ring stations
        const stations = 4 + ri * 2;
        for (let si = 0; si < stations; si++) {
          const sa = (si / stations) * Math.PI * 2 + angle;
          const sx2 = rx * Math.cos(sa);
          const sy2 = ry * Math.sin(sa);
          ctx.beginPath();
          ctx.arc(sx2, sy2, 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue + 40},100%,80%,${alpha * 2})`;
          ctx.fill();
        }
        ctx.restore();
      }

      // Central star (sun)
      const pulse = 1 + 0.1 * Math.sin(t * 0.003);
      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.18 * pulse);
      sunGrad.addColorStop(0, "rgba(255,255,200,1)");
      sunGrad.addColorStop(0.3, "rgba(255,160,40,0.9)");
      sunGrad.addColorStop(0.7, "rgba(255,80,0,0.4)");
      sunGrad.addColorStop(1, "rgba(255,40,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.18 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();

      // Solar flares
      for (let f = 0; f < 5; f++) {
        const fa = t * 0.001 + f * ((Math.PI * 2) / 5);
        const fl = R * 0.22 * (1 + 0.5 * Math.sin(t * 0.002 + f * 1.3));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(
          cx + Math.cos(fa + 0.4) * fl * 0.6,
          cy + Math.sin(fa + 0.4) * fl * 0.6,
          cx + Math.cos(fa) * fl,
          cy + Math.sin(fa) * fl
        );
        ctx.strokeStyle = `rgba(255,120,0,${0.3 * Math.abs(Math.sin(t * 0.002 + f))})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Energy lattice (quantum grid overlay)
      const gridLines = 8;
      for (let g = 0; g < gridLines; g++) {
        const ga = (g / gridLines) * Math.PI * 2 + t * 0.0005;
        const x1 = cx + R * 1.3 * Math.cos(ga);
        const y1 = cy + R * 1.3 * Math.sin(ga);
        const x2 = cx + R * 0.25 * Math.cos(ga + Math.PI);
        const y2 = cy + R * 0.25 * Math.sin(ga + Math.PI);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(0,200,255,${0.06 * boost})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Boost indicator ring
      const boostAngle = (boost / 5.5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, -Math.PI / 2, -Math.PI / 2 + boostAngle);
      ctx.strokeStyle = `rgba(0,255,180,${0.6 + 0.4 * Math.sin(t * 0.005)})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Epoch counter (subtle)
      ctx.fillStyle = "rgba(0,200,255,0.25)";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`EPOCH ${epoch}`, cx, cy + R * 1.45);

      timeRef.current += 1;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [boost, equilibrium, epoch]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

// ─── Valknut Xi Gauge ─────────────────────────────────────────────────────────

function ValknutGauge({ xi, tolerance }: { xi: number; tolerance: number }) {
  const passes = Math.abs(xi - 1) <= tolerance;
  const pct = Math.min(100, ((2 - Math.abs(xi - 1)) / 2) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">Valknut ξ</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-foreground">{xi.toFixed(6)}</span>
          <Badge variant={passes ? "default" : "secondary"} className={passes ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]" : "text-[10px]"}>
            {passes ? "✓ PASS" : "✗ MISS"}
          </Badge>
        </div>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: passes
              ? "linear-gradient(90deg, #10b981, #34d399)"
              : "linear-gradient(90deg, #3b82f6, #6366f1)"
          }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-yellow-400 opacity-80"
          style={{ left: "50%" }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
        <span>0.0</span>
        <span className="text-yellow-400">1.0 ± {tolerance}</span>
        <span>2.0</span>
      </div>
    </div>
  );
}

// ─── Spectral Gap Bar ─────────────────────────────────────────────────────────

function SpectralGapChart({ gaps, label }: { gaps: number[]; label: string }) {
  const max = Math.max(...gaps, 0.01);
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-0.5 h-12">
        {gaps.slice(0, 10).map((g, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-700"
            style={{
              height: `${Math.max(6, (g / max) * 100)}%`,
              background: `hsl(${180 + i * 12}, 80%, ${50 + i * 3}%)`,
              opacity: 0.8,
            }}
            title={`Gap ${i + 1}: ${g.toFixed(4)}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Candidate Row ────────────────────────────────────────────────────────────

function CandidateRow({ c, idx }: { c: Candidate; idx: number }) {
  const dist = Math.abs(c.xi - 1.0);
  return (
    <div
      data-testid={`dyson-candidate-${c.index}`}
      className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs font-mono transition-all ${
        c.passesFilter
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border/40 bg-muted/20"
      }`}
    >
      <span className="w-5 text-muted-foreground text-right">{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={c.passesFilter ? "text-emerald-400" : "text-foreground"}>
            ξ={c.xi.toFixed(5)}
          </span>
          <span className="text-muted-foreground">|ξ-1|={dist.toFixed(5)}</span>
        </div>
        <div className="text-muted-foreground mt-0.5">
          gap={c.gap.toFixed(4)} · Dyson={c.dysonEquilibrium.toFixed(3)} · Berry={c.berryPhase.toFixed(3)}
        </div>
      </div>
      <div className="text-right shrink-0">
        {c.passesFilter && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">VALKNUT</Badge>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DysonSphereMiner() {
  const { toast } = useToast();
  const [mineResult, setMineResult] = useState<MineResult | null>(null);
  const [isMining, setIsMining] = useState(false);

  const { data: state, isLoading: stateLoading } = useQuery<DysonState>({
    queryKey: ["/api/dyson/state"],
    refetchInterval: 15000,
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/dyson/candidates"],
    refetchInterval: 30000,
  });

  const mineMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dyson/mine", {
      blockData: `skynt:dyson:${Date.now()}`,
      maxAttempts: 5000,
    }),
    onMutate: () => setIsMining(true),
    onSuccess: async (res) => {
      const result: MineResult = await res.json();
      setMineResult(result);
      setIsMining(false);
      if (result.valknutPass) {
        toast({
          title: "⚡ Valknut Gate Passed!",
          description: `ξ=${result.xi.toFixed(5)} — nonce=${result.nonce} in ${result.attempts} attempts`,
        });
      } else {
        toast({
          title: "Mining cycle complete",
          description: `Best ξ=${result.xi.toFixed(5)} in ${result.attempts} attempts`,
          variant: "default",
        });
      }
    },
    onError: () => {
      setIsMining(false);
      toast({ title: "Mining error", variant: "destructive" });
    },
  });

  const boost = state?.hashRateBoost ?? 1.0;
  const equil = state?.dysonEquilibrium ?? 1.0;
  const epoch = state?.epoch ?? 0;
  const passRate = state?.valknutPassRate ?? 0;
  const chainCorr = state?.chainCorrelation ?? 0;

  const passedCandidates = candidates?.filter(c => c.passesFilter) ?? [];

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Atom className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Dyson Sphere Miner</h1>
              <p className="text-xs font-mono text-muted-foreground">
                Valknut Dial v9 · Quantum Gravity · Spectral Lattice · R₉₀ Symmetry
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-cyan-500/40 text-cyan-400">
            EPOCH {epoch}
          </Badge>
          <Badge variant="outline" className={`font-mono text-xs ${boost > 2 ? "border-emerald-500/40 text-emerald-400" : "border-muted"}`}>
            {boost.toFixed(2)}x BOOST
          </Badge>
          <Button
            onClick={() => mineMutation.mutate()}
            disabled={isMining}
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
            data-testid="button-dyson-mine"
          >
            {isMining ? (
              <><RotateCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Mining…</>
            ) : (
              <><Play className="w-3.5 h-3.5 mr-1.5" /> Run Valknut v9</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Dyson Sphere Visualization */}
        <div className="xl:col-span-1">
          <Card className="border-cyan-500/20 bg-card/60 overflow-hidden" data-testid="card-dyson-sphere">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-cyan-400 flex items-center gap-2">
                <Orbit className="w-4 h-4" style={{ animation: "spin 8s linear infinite" }} />
                Dyson Sphere Equilibrium
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-72">
                <DysonSphereCanvas boost={boost} equilibrium={equil} epoch={epoch} />
              </div>
              <div className="p-4 space-y-3 border-t border-border/40">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground">Equilibrium</p>
                    <p className="text-lg font-bold text-cyan-400 font-mono">{equil.toFixed(3)}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Dyson P_t factor</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground">Hash Boost</p>
                    <p className="text-lg font-bold text-emerald-400 font-mono">{boost.toFixed(2)}x</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Chain corr. gain</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                    <span>Valknut Pass Rate</span>
                    <span className="text-emerald-400">{(passRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={passRate * 100} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Spectral Analysis */}
        <div className="xl:col-span-1 space-y-4">
          <Card className="border-violet-500/20 bg-card/60" data-testid="card-spectral">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-violet-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Quantum Spectral Correlator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SpectralGapChart gaps={state?.specGaps ?? []} label="Riemann Zeta Gaps (Δtₙ)" />
              <SpectralGapChart gaps={state?.quantumGaps ?? []} label="Quantum Energy Gaps (ΔEₙ)" />
              <SpectralGapChart gaps={state?.eigenvalues ?? []} label="Hamiltonian Eigenvalues" />

              <Separator className="opacity-30" />

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px]">Lattice Correlation</p>
                  <p className={`font-bold ${Math.abs(state?.latticeCorr ?? 0) > 0.3 ? "text-emerald-400" : "text-foreground"}`}>
                    {(state?.latticeCorr ?? 0).toFixed(5)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px]">R₉₀ Rotated Corr.</p>
                  <p className="font-bold text-violet-400">{(state?.latticeCorrRot ?? 0).toFixed(5)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px]">Final Corr. (orig)</p>
                  <p className="font-bold text-cyan-400">{(state?.finalCorrOrig ?? 0).toFixed(5)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px]">Final Corr. (rot)</p>
                  <p className="font-bold text-blue-400">{(state?.finalCorrRot ?? 0).toFixed(5)}</p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] font-mono text-muted-foreground mb-1">Chain Correlation Product</p>
                <p className={`text-xl font-bold font-mono ${Math.abs(chainCorr) > 0.3 ? "text-yellow-400" : "text-foreground"}`}>
                  {chainCorr.toFixed(6)}
                </p>
                {Math.abs(chainCorr) > 0.3 && (
                  <Badge className="mt-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px]">
                    🎯 SIGNIFICANT CORRELATION
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-card/60" data-testid="card-primes">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-blue-400 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Prime Resonator Lattice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(state?.primes ?? []).map((p, i) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="font-mono text-[10px] border-blue-500/30 text-blue-300"
                    data-testid={`badge-prime-${p}`}
                  >
                    p{i + 1}={p}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-2">
                28-mode quaternion resonator lattice with golden-ratio spiral positions + R₉₀ symmetry
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Valknut Candidates + Mine Result */}
        <div className="xl:col-span-1 space-y-4">
          {/* Mine Result */}
          {mineResult && (
            <Card className={`border-2 ${mineResult.valknutPass ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/40 bg-card/60"}`} data-testid="card-mine-result">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${mineResult.valknutPass ? "text-emerald-400" : "text-muted-foreground"}`} />
                  <span className={mineResult.valknutPass ? "text-emerald-400" : "text-foreground"}>
                    {mineResult.valknutPass ? "Valknut Gate PASSED ✓" : "Mining Cycle Complete"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ValknutGauge xi={mineResult.xi} tolerance={0.016} />
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <p className="text-muted-foreground text-[10px]">Dyson Factor</p>
                    <p className="text-cyan-400">{mineResult.dysonFactor.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">Berry Phase</p>
                    <p className="text-violet-400">{mineResult.berryPhase.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">Spectral Cube</p>
                    <p className="text-blue-400">{mineResult.specCube.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">Attempts</p>
                    <p className="text-foreground">{mineResult.attempts.toLocaleString()}</p>
                  </div>
                </div>
                {mineResult.blockHash && (
                  <div className="bg-muted/30 rounded p-2">
                    <p className="text-[10px] font-mono text-muted-foreground">Block Hash</p>
                    <p className="text-[10px] font-mono text-foreground break-all">{mineResult.blockHash.slice(0, 32)}…</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Valknut Candidates */}
          <Card className="border-yellow-500/20 bg-card/60" data-testid="card-candidates">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-yellow-400 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Valknut Candidates
                <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px]">
                  {passedCandidates.length} / {candidates?.length ?? 0} pass |ξ-1| &lt; 0.016
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {candidatesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : candidates && candidates.length > 0 ? (
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {candidates.slice(0, 15).map((c, i) => (
                    <CandidateRow key={c.index} c={c} idx={i} />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-muted-foreground text-center py-4">
                  No candidates yet — run Valknut v9 to generate
                </p>
              )}
            </CardContent>
          </Card>

          {/* Algorithm Summary */}
          <Card className="border-muted/40 bg-card/40" data-testid="card-algorithm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Algorithm: ξ = (S³ + B + Q_fib + D_eq) / 4
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[10px] font-mono text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 shrink-0">S³</span>
                <span>Spectral cube — SHA256 zeta-like hash score, cubed</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-400 shrink-0">B</span>
                <span>Berry phase flow — Thue-Morse sequence topological phase</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0">Q_fib</span>
                <span>Quantum-Fibonacci gradient — ℏ/(γm v_eff) Σ K(fib)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">D_eq</span>
                <span>Dyson equilibrium — relativistic thin-shell pressure P_t = GM ρ R / (2(R-2GM)(1+ρ/ρ_c))</span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-border/30">
                <span className="text-yellow-400 shrink-0">Filter</span>
                <span>|ξ - 1| &lt; 0.016 — physically viable Dyson megastructure signature</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Needed for inline style animation
declare global {
  interface Window { }
}
