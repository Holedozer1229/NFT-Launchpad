import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, Clock, Zap, TrendingUp } from "lucide-react";

interface ResonanceStatus {
  schumannFrequency: number;
  phi: number;
  isResonanceActive: boolean;
  status: "DORMANT" | "CHARGING" | "RESONANCE_ACTIVE";
  nextWindowCountdown: number;
  lastEventTimestamp: number;
}

export function ResonanceDrop() {
  const { data: status, isLoading } = useQuery<ResonanceStatus>({
    queryKey: ["/api/resonance/status"],
    refetchInterval: 5000,
  });

  if (isLoading || !status) {
    return (
      <Card className="bg-background/50 border-primary/20 backdrop-blur-sm animate-pulse">
        <CardContent className="p-6 h-32 flex items-center justify-center">
          <Activity className="w-8 h-8 text-primary/20" />
        </CardContent>
      </Card>
    );
  }

  const phiPercentage = Math.min((status.phi / 1.618) * 100, 100);
  
  const statusColors = {
    DORMANT: "text-muted-foreground",
    CHARGING: "text-neon-cyan animate-pulse",
    RESONANCE_ACTIVE: "text-neon-magenta neon-glow-magenta animate-bounce",
  };

  const statusBorders = {
    DORMANT: "border-primary/20",
    CHARGING: "border-neon-cyan/50 shadow-[0_0_15px_rgba(0,255,255,0.2)]",
    RESONANCE_ACTIVE: "border-neon-magenta shadow-[0_0_25px_rgba(255,0,255,0.3)]",
  };

  return (
    <Card className={`bg-background/40 backdrop-blur-md transition-all duration-500 border-2 ${statusBorders[status.status]}`} data-testid="card-resonance-drop">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-heading font-black uppercase tracking-widest flex items-center gap-2">
          <Zap className={`w-4 h-4 ${status.isResonanceActive ? 'text-neon-magenta' : 'text-primary'}`} />
          Resonance Matrix
        </CardTitle>
        <div className={`text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 ${statusColors[status.status]}`} data-testid="status-resonance">
          {status.status}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Schumann Resonance</span>
            <div className="text-2xl font-heading font-bold text-white flex items-baseline gap-1" data-testid="text-schumann-freq">
              {status.schumannFrequency}
              <span className="text-xs text-muted-foreground font-normal">Hz</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Next Sync Window</span>
            <div className="text-sm font-mono text-primary flex items-center justify-end gap-1" data-testid="text-next-sync">
              <Clock className="w-3 h-3" />
              {status.nextWindowCountdown}s
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">COHERENCE (Φ)</span>
            <span className={status.isResonanceActive ? "text-neon-magenta" : "text-neon-cyan"}>
              {status.phi.toFixed(3)} / 1.618
            </span>
          </div>
          <Progress 
            value={phiPercentage} 
            className="h-1.5 bg-primary/10" 
            indicatorClassName={status.isResonanceActive ? "bg-neon-magenta shadow-[0_0_10px_#ff00ff]" : "bg-neon-cyan shadow-[0_0_10px_#00ffff]"}
            data-testid="progress-phi"
          />
        </div>

        {status.isResonanceActive && (
          <div className="mt-4 p-3 bg-neon-magenta/10 border border-neon-magenta/30 rounded-sm animate-pulse flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-neon-magenta" />
            <div>
              <div className="text-[10px] font-heading font-bold text-neon-magenta uppercase tracking-tighter">RESONANCE ACTIVE</div>
              <div className="text-[10px] font-mono text-white/80 leading-none">PHI_THRESHOLD_MET: 1.5x MINT MULTIPLIER ACTIVE</div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <div className="relative w-full h-8 overflow-hidden rounded-sm bg-primary/5 border border-primary/10">
            <svg viewBox="0 0 400 32" className="absolute inset-0 w-full h-full">
              <path
                d={`M 0 16 ${Array.from({ length: 40 }).map((_, i) => {
                  const x = i * 10;
                  const y = 16 + Math.sin((x + Date.now() / 50) * (status.schumannFrequency / 10)) * 10;
                  return `L ${x} ${y}`;
                }).join(' ')}`}
                fill="none"
                stroke={status.isResonanceActive ? "hsl(var(--neon-magenta))" : "hsl(var(--neon-cyan))"}
                strokeWidth="1"
                className="transition-colors duration-500"
              />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
