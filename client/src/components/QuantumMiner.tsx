import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Cpu, Activity, Globe, Terminal, Loader2 } from "lucide-react";

export function QuantumMiner() {
  const [isMining, setIsMining] = useState(false);
  const [hashRate, setHashRate] = useState(0);
  const [tunnelProb, setTunnelProb] = useState(0);
  const [blocksFound, setBlocksFound] = useState(0);
  const [stxEarnings, setStxEarnings] = useState(0);
  const [phi, setPhi] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isMining) {
      interval = setInterval(() => {
        setHashRate(Math.floor(Math.random() * 500) + 800);
        setTunnelProb(Math.random() * 0.0001);
        setPhi(0.95 + Math.random() * 0.04);
        
        if (Math.random() < 0.05) {
          setBlocksFound(prev => prev + 1);
          setStxEarnings(prev => prev + (Math.random() * 0.5));
        }
      }, 2000);
    } else {
      setHashRate(0);
      setTunnelProb(0);
      setPhi(0);
    }
    return () => clearInterval(interval);
  }, [isMining]);

  return (
    <Card className="sphinx-card bg-black/60 border-primary/20 backdrop-blur-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
      
      <CardHeader className="border-b border-primary/10 bg-primary/5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <CardTitle className="font-heading text-lg tracking-widest text-primary">QUANTUM_FORGE v3.0</CardTitle>
          </div>
          <Badge variant="outline" className={isMining ? "border-primary text-primary animate-pulse" : "text-muted-foreground"}>
            {isMining ? "TUNNELING_ACTIVE" : "STANDBY"}
          </Badge>
        </div>
        <CardDescription className="font-mono text-[10px] text-primary/60">
          HAL-JONES IIT PROTOCOL // PATH INTEGRAL MINING
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">Spectral Hashrate</span>
            <div className="text-sm font-heading font-bold text-white">{hashRate} <span className="text-[8px] text-primary/60">PH/s</span></div>
          </div>
          <div className="space-y-1 text-center border-x border-primary/10">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">STX Merge Yield</span>
            <div className="text-sm font-heading font-bold text-accent">{stxEarnings.toFixed(2)} STX</div>
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">Tunnel Prob. (Pₜ)</span>
            <div className="text-sm font-heading font-bold text-primary">{tunnelProb.toExponential(1)}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono uppercase text-primary/60">
            <span>Consciousness Integration (Φ)</span>
            <span>{phi.toFixed(4)}</span>
          </div>
          <Progress value={phi * 100} className="h-1 bg-white/5 [&>div]:bg-primary shadow-[0_0_10px_rgba(255,215,0,0.2)]" />
        </div>

        <div className="p-3 bg-black/40 border border-primary/10 rounded-sm font-mono text-[10px] space-y-2 relative">
          <div className="flex justify-between items-center text-primary/40 border-b border-primary/5 pb-1">
            <span>TERMINAL_FEED</span>
            <Activity className="w-3 h-3" />
          </div>
          <div className="h-20 overflow-hidden text-primary/80">
            {isMining ? (
              <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2">
                <p>{">>>"} ∫𝒟[n(t)] exp(iS[n]/ħ) sampled</p>
                <p>{">>>"} Stacks Merge Mining: Channel Sync @ {Math.floor(Math.random() * 1000)}ms</p>
                <p>{">>>"} Quantum state superposition: |Ψ⟩ initialized</p>
                <p>{">>>"} WKB approximation: barrier width 1.0ℓₚ</p>
                {blocksFound > 0 && (
                  <div className="space-y-1">
                    <p className="text-accent">{"!!!"} TUNNEL COLLAPSE: BLOCK_FOUND_ID_{blocksFound}</p>
                    <p className="text-primary animate-pulse">{">>>"} STX EARNINGS INJECTED TO ORACLE MINTER</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="opacity-40 italic">Waiting for quantum ignition...</p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button 
            className={`flex-1 font-heading font-bold transition-all duration-500 ${isMining ? 'bg-destructive/20 border-destructive text-destructive hover:bg-destructive/30' : 'bg-primary text-black hover:bg-primary/80'}`}
            onClick={() => setIsMining(!isMining)}
          >
            {isMining ? "ABORT_TUNNEL" : "IGNITE_FORGE"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
