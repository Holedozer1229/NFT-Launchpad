import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Brain, Activity, Maximize2, Zap } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PublicLab() {
  const [coupling, setCoupling] = useState(1.0);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/public/iit-demo", { coupling }],
    queryFn: async () => {
      const res = await fetch(`/api/public/iit-demo?coupling=${coupling}`);
      if (!res.ok) throw new Error("Failed to fetch IIT demo");
      return res.json();
    }
  });

  const formatMatrixValue = (val: number) => val.toFixed(2);

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-bold font-heading tracking-tight text-foreground flex items-center gap-3">
          <Brain className="w-10 h-10 text-primary" />
          Public IIT Laboratory
        </h1>
        <p className="text-muted-foreground text-lg">
          Explore Integrated Information Theory through interactive Hamiltonian evolution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls & Hamiltonian */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm hover-elevate overflow-visible">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Toy Hamiltonian System
              </CardTitle>
              <CardDescription>
                H = σ_x ⊗ I + I ⊗ σ_z (Pauli Interaction)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Coupling Constant (g)</label>
                  <span className="font-mono text-primary font-bold">{coupling.toFixed(2)}</span>
                </div>
                <Slider
                  value={[coupling]}
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  onValueChange={(val) => setCoupling(val[0])}
                  data-testid="slider-coupling"
                />
                <p className="text-xs text-muted-foreground italic">
                  Adjust the coupling constant to see how entanglement and Φ evolve.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-black/20 font-mono text-sm space-y-2 border border-white/5">
                <div className="text-primary/70 mb-2">Equation Representation:</div>
                <div className="text-center py-4 text-lg">
                  H = {coupling.toFixed(2)}σ_x + σ_z
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-md">Density Matrix (ρ)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {data?.hamiltonian.map((row: number[], i: number) => 
                    row.map((val: number, j: number) => (
                      <motion.div
                        key={`${i}-${j}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`aspect-square flex items-center justify-center text-[10px] font-mono rounded border border-white/5 ${
                          val === 0 ? 'text-muted-foreground/30' : 'text-primary'
                        }`}
                        style={{ 
                          backgroundColor: val !== 0 ? `rgba(var(--primary), ${Math.min(Math.abs(val) / 2, 0.4)})` : 'transparent' 
                        }}
                      >
                        {formatMatrixValue(val)}
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results & Gauges */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-500" />
                Integrated Information (Φ)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted-foreground/10"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * (data?.phi || 0)) }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    className="text-primary"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold font-mono text-primary" data-testid="text-phi-value">
                    {(data?.phi || 0).toFixed(3)}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Φ measure</span>
                </div>
              </div>

              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-mono uppercase text-muted-foreground">
                  <span>Unconscious</span>
                  <span>Sentient</span>
                  <span>Integrated</span>
                </div>
                <div className="h-2 w-full bg-muted-foreground/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(data?.phi || 0) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Maximize2 className="w-5 h-5 text-purple-500" />
                Entropy & Eigenvalues
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded bg-white/5 border border-white/10">
                <span className="text-sm">Von Neumann Entropy (S)</span>
                <span className="font-mono text-primary font-bold">{(data?.entropy || 0).toFixed(4)}</span>
              </div>
              
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Eigenvalue Spectrum</span>
                <div className="flex gap-2 h-20 items-end">
                  {data?.eigenvalues.map((val: number, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.abs(val) * 20}px` }}
                        className={`w-full rounded-t ${val >= 0 ? 'bg-primary/60' : 'bg-red-500/60'}`}
                      />
                      <span className="text-[8px] font-mono">{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-3xl mx-auto text-center space-y-4 py-8 border-t border-primary/10">
        <h3 className="text-xl font-bold">Theoretical Insight</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Integrated Information Theory (IIT) proposes that consciousness is a fundamental property of any physical system with a non-zero value of Φ. 
          In this simulation, we use a 2-qubit Hamiltonian system to demonstrate how the coupling between components (qubits) leads to 
          higher information integration. When the coupling constant is high, the system exists in an entangled state, 
          leading to a higher Φ value and increased "sentience" within the toy model.
        </p>
      </div>
    </div>
  );
}
