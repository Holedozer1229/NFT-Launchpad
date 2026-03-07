import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Zap, Radio, Activity, Gauge, Shield, Wifi, WifiOff,
  CircleDot, Orbit, Loader2, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MoltbotChannel {
  id: string;
  name: string;
  protocol: string;
  status: string;
  throughput: number;
  latency: number;
  yieldContribution: number;
  color: string;
}

interface MoltbotData {
  omegaFrequency: number;
  superChargeLevel: number;
  connectionStrength: number;
  yieldMultiplier: number;
  portalEnergy: number;
  harmonicResonance: number;
  channels: MoltbotChannel[];
  activeChannels: number;
  totalChannels: number;
  portalStatus: string;
  moltbotVersion: string;
  networkHash: string;
  phiInput: {
    phiTotal: number;
    qgScore: number;
    holoScore: number;
    fanoScore: number;
  };
}

function PulseRing({ active, color }: { active: boolean; color: string }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className={cn("absolute inset-0 rounded-lg border animate-ping opacity-20", color)}
        style={{ animationDuration: "2s" }}
      />
    </div>
  );
}

function ChannelCard({ channel }: { channel: MoltbotChannel }) {
  const isActive = channel.status === "active";
  const colorMap: Record<string, { text: string; border: string; bg: string; glow: string }> = {
    cyan: { text: "text-neon-cyan", border: "border-neon-cyan/40", bg: "bg-neon-cyan/8", glow: "shadow-[0_0_12px_hsl(185_100%_50%/0.15)]" },
    green: { text: "text-neon-green", border: "border-neon-green/40", bg: "bg-neon-green/8", glow: "shadow-[0_0_12px_hsl(145_100%_50%/0.15)]" },
    orange: { text: "text-neon-orange", border: "border-neon-orange/40", bg: "bg-neon-orange/8", glow: "shadow-[0_0_12px_hsl(30_100%_55%/0.15)]" },
    magenta: { text: "text-neon-magenta", border: "border-neon-magenta/40", bg: "bg-neon-magenta/8", glow: "shadow-[0_0_12px_hsl(300_100%_60%/0.15)]" },
  };
  const c = colorMap[channel.color] || colorMap.cyan;

  return (
    <div
      data-testid={`moltbot-channel-${channel.id}`}
      className={cn(
        "relative cosmic-card p-3 transition-all duration-300",
        isActive ? cn(c.border, c.glow) : "border-white/10 opacity-60"
      )}
    >
      <PulseRing active={isActive} color={c.border} />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Wifi className={cn("w-3.5 h-3.5", c.text)} style={{ filter: `drop-shadow(0 0 4px currentColor)` }} />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={cn("font-heading text-xs font-bold uppercase tracking-wider", isActive ? "text-white" : "text-muted-foreground")}>
            {channel.name}
          </span>
        </div>
        <span className={cn(
          "text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-widest",
          isActive ? cn(c.text, c.bg) : "text-muted-foreground bg-white/5"
        )}>
          {channel.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div>
          <span className="text-muted-foreground block">Protocol</span>
          <span className={cn(isActive ? c.text : "text-muted-foreground")}>{channel.protocol}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Throughput</span>
          <span className="text-white">{channel.throughput.toFixed(0)} ops/s</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Latency</span>
          <span className={cn(channel.latency < 10 ? "text-neon-green" : channel.latency < 30 ? "text-neon-orange" : "text-red-400")}>
            {channel.latency.toFixed(1)}ms
          </span>
        </div>
      </div>

      {isActive && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground">Yield Contribution</span>
          <span className={cn("text-[10px] font-mono font-bold", c.text)}>+{(channel.yieldContribution * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function EnergyBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-1000", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MoltbotPortal() {
  const { data, isLoading, isError } = useQuery<MoltbotData>({
    queryKey: ["/api/yield/moltbot"],
    refetchInterval: 15000,
  });

  const [expanded, setExpanded] = useState(true);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setPulsePhase((p) => (p + 1) % 360), 50);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="cosmic-card cosmic-card-magenta p-6 text-center" data-testid="moltbot-loading">
        <Loader2 className="w-6 h-6 animate-spin text-neon-magenta mx-auto mb-2" />
        <p className="font-mono text-[10px] text-muted-foreground">Initializing Moltbot Ω Portal...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="cosmic-card cosmic-card-orange p-4 text-center" data-testid="moltbot-error">
        <WifiOff className="w-5 h-5 text-neon-orange mx-auto mb-1" />
        <p className="font-mono text-xs text-muted-foreground">Portal connection lost</p>
      </div>
    );
  }

  const statusColor = data.portalStatus === "SUPER OMEGA ACTIVE"
    ? "text-neon-green"
    : data.portalStatus === "OMEGA CHARGING"
    ? "text-neon-orange"
    : "text-muted-foreground";

  const omegaPulse = Math.sin((pulsePhase * Math.PI) / 180) * 0.3 + 0.7;

  return (
    <div className="space-y-4" data-testid="moltbot-portal">
      <div
        className="cosmic-card relative overflow-hidden transition-all duration-300"
        style={{
          borderColor: `hsl(300 100% 60% / ${0.2 + data.connectionStrength * 0.3})`,
          boxShadow: `0 0 ${15 + data.superChargeLevel * 2}px hsl(300 100% 60% / ${0.05 + data.connectionStrength * 0.1})`,
        }}
      >
        <div
          className="absolute top-0 left-0 w-full h-px"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(300 100% 60% / ${omegaPulse * 0.8}), hsl(185 100% 50% / ${omegaPulse * 0.6}), transparent)`,
          }}
        />

        <div className="p-4 sm:p-5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between group"
            data-testid="button-moltbot-toggle"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-neon-magenta/30"
                style={{
                  background: `radial-gradient(circle, hsl(300 100% 60% / ${0.15 + data.connectionStrength * 0.1}) 0%, transparent 70%)`,
                }}
              >
                <Sparkles
                  className="w-4 h-4 text-neon-magenta"
                  style={{
                    filter: `drop-shadow(0 0 ${4 + data.superChargeLevel}px hsl(300 100% 60% / 0.6))`,
                    transform: `scale(${0.9 + omegaPulse * 0.15})`,
                  }}
                />
              </div>
              <div className="text-left">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white group-hover:text-neon-magenta transition-colors">
                  Moltbot Super Omega Portal
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[9px] font-mono uppercase tracking-widest font-bold", statusColor)}>
                    {data.portalStatus}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    v{data.moltbotVersion}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-neon-magenta font-heading text-sm font-bold" data-testid="text-moltbot-multiplier">
                {data.yieldMultiplier.toFixed(2)}x
              </span>
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {expanded && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-black/30 border border-white/5 rounded-sm text-center" data-testid="stat-omega-freq">
                  <Radio className="w-3.5 h-3.5 text-neon-magenta mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground block font-mono">Ω Frequency</span>
                  <span className="font-heading text-sm text-neon-magenta">{data.omegaFrequency.toFixed(2)} Hz</span>
                </div>
                <div className="p-2.5 bg-black/30 border border-white/5 rounded-sm text-center" data-testid="stat-charge-level">
                  <Zap className="w-3.5 h-3.5 text-neon-cyan mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground block font-mono">Charge Level</span>
                  <span className="font-heading text-sm text-neon-cyan">{data.superChargeLevel}/10</span>
                </div>
                <div className="p-2.5 bg-black/30 border border-white/5 rounded-sm text-center" data-testid="stat-portal-energy">
                  <Activity className="w-3.5 h-3.5 text-neon-green mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground block font-mono">Portal Energy</span>
                  <span className="font-heading text-sm text-neon-green">{data.portalEnergy.toFixed(0)} ΩJ</span>
                </div>
                <div className="p-2.5 bg-black/30 border border-white/5 rounded-sm text-center" data-testid="stat-resonance">
                  <Orbit className="w-3.5 h-3.5 text-neon-orange mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground block font-mono">Resonance</span>
                  <span className="font-heading text-sm text-neon-orange">{(data.harmonicResonance * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Connection Strength</span>
                  <span className="text-[10px] font-mono text-neon-cyan">{(data.connectionStrength * 100).toFixed(1)}%</span>
                </div>
                <EnergyBar value={data.connectionStrength} max={1} color="bg-gradient-to-r from-neon-magenta to-neon-cyan" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Super Charge</span>
                  <span className="text-[10px] font-mono text-neon-green">{data.superChargeLevel}/10</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 h-2 rounded-[1px] transition-all duration-500",
                        i < data.superChargeLevel
                          ? i < 4 ? "bg-neon-green" : i < 7 ? "bg-neon-cyan" : "bg-neon-magenta"
                          : "bg-white/5"
                      )}
                      style={i < data.superChargeLevel ? {
                        boxShadow: `0 0 6px ${i < 4 ? "hsl(145 100% 50% / 0.4)" : i < 7 ? "hsl(185 100% 50% / 0.4)" : "hsl(300 100% 60% / 0.4)"}`,
                      } : undefined}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                    Yield Channels ({data.activeChannels}/{data.totalChannels} Active)
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    Net Hash: {data.networkHash.slice(0, 12)}…
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {data.channels.map((channel) => (
                    <ChannelCard key={channel.id} channel={channel} />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 grid grid-cols-4 gap-2 text-center">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground block">Φ Total</span>
                  <span className="text-[10px] font-mono text-neon-cyan">{data.phiInput.phiTotal.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground block">QG Score</span>
                  <span className="text-[10px] font-mono text-neon-green">{data.phiInput.qgScore.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground block">Holo Score</span>
                  <span className="text-[10px] font-mono text-neon-orange">{data.phiInput.holoScore.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground block">Fano Score</span>
                  <span className="text-[10px] font-mono text-neon-magenta">{data.phiInput.fanoScore.toFixed(3)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
