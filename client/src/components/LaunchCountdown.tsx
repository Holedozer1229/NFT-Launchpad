import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Rocket, MapPin, Clock, ChevronLeft, ChevronRight, Radio } from "lucide-react";

interface SpaceLaunch {
  id: string;
  name: string;
  net: string;
  status: string;
  provider: string;
  rocket: string;
  pad: string;
  location: string;
  image: string | null;
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    };
    setTimeLeft(calc());
    const timer = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function CountdownDigit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-14 h-14 flex items-center justify-center rounded-md font-mono text-xl font-bold text-neon-cyan border border-neon-cyan/20"
        style={{
          background: "linear-gradient(180deg, hsl(185 100% 50% / 0.08) 0%, hsl(185 100% 50% / 0.02) 100%)",
          textShadow: "0 0 10px hsl(185 100% 50% / 0.5)",
        }}
        data-testid={`countdown-${label.toLowerCase()}`}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[9px] font-mono text-muted-foreground mt-1.5 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function LaunchCard({ launch, isActive }: { launch: SpaceLaunch; isActive: boolean }) {
  const { days, hours, minutes, seconds } = useCountdown(launch.net);
  const launchDate = new Date(launch.net);
  const isPast = launchDate.getTime() <= Date.now();

  const statusColor =
    launch.status === "Go for Launch" ? "text-neon-green" :
    launch.status === "TBD" ? "text-neon-orange" :
    launch.status === "TBC" ? "text-yellow-400" :
    "text-muted-foreground";

  if (!isActive) return null;

  return (
    <div className="space-y-5" data-testid={`launch-card-${launch.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider ${statusColor}`}>
              <Radio className="w-3 h-3" />
              {launch.status}
            </span>
          </div>
          <h3 className="font-heading text-lg font-bold text-white leading-tight truncate" data-testid="text-launch-name">
            {launch.name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <Rocket className="w-3 h-3 text-neon-cyan" />
              {launch.provider}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <MapPin className="w-3 h-3 text-neon-orange" />
              {launch.location}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <Clock className="w-3 h-3 text-neon-magenta" />
              {launchDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {" "}
              {launchDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </div>
        </div>
      </div>

      {!isPast ? (
        <div className="flex items-center justify-center gap-3">
          <CountdownDigit value={days} label="Days" />
          <span className="text-neon-cyan/40 font-mono text-xl mt-[-16px]">:</span>
          <CountdownDigit value={hours} label="Hours" />
          <span className="text-neon-cyan/40 font-mono text-xl mt-[-16px]">:</span>
          <CountdownDigit value={minutes} label="Min" />
          <span className="text-neon-cyan/40 font-mono text-xl mt-[-16px]">:</span>
          <CountdownDigit value={seconds} label="Sec" />
        </div>
      ) : (
        <div className="text-center py-3">
          <span className="font-mono text-sm text-neon-green uppercase tracking-wider" style={{ textShadow: "0 0 8px hsl(145 100% 50% / 0.4)" }}>
            Launch Window Active
          </span>
        </div>
      )}
    </div>
  );
}

export default function LaunchCountdown() {
  const { data: launches, isLoading, isError } = useQuery<SpaceLaunch[]>({
    queryKey: ["/api/space-launches"],
    refetchInterval: 5 * 60 * 1000,
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const prev = () => {
    if (launches) setActiveIndex((i) => (i - 1 + launches.length) % launches.length);
  };
  const next = () => {
    if (launches) setActiveIndex((i) => (i + 1) % launches.length);
  };

  if (isLoading) {
    return (
      <div className="cosmic-card cosmic-card-cyan p-6" data-testid="countdown-loading">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-5 h-5 text-neon-cyan animate-pulse" />
          <span className="font-heading text-xs font-bold tracking-widest text-primary uppercase">Live Launch Countdown</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-neon-cyan" />
        </div>
      </div>
    );
  }

  if (isError || !launches?.length) {
    return (
      <div className="cosmic-card cosmic-card-cyan p-6" data-testid="countdown-error">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-5 h-5 text-neon-cyan" />
          <span className="font-heading text-xs font-bold tracking-widest text-primary uppercase">Live Launch Countdown</span>
        </div>
        <p className="font-mono text-xs text-muted-foreground text-center py-4">
          Launch telemetry temporarily unavailable
        </p>
      </div>
    );
  }

  return (
    <div
      className="cosmic-card cosmic-card-cyan p-6 relative overflow-hidden"
      data-testid="launch-countdown"
    >
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(185 100% 50% / 0.15), hsl(185 100% 50% / 0.05))",
              border: "1px solid hsl(185 100% 50% / 0.2)",
            }}
          >
            <Rocket className="w-4 h-4 text-neon-cyan" style={{ filter: "drop-shadow(0 0 4px hsl(185 100% 50% / 0.6))" }} />
          </div>
          <div>
            <span className="font-heading text-xs font-bold tracking-widest text-primary uppercase">Live Launch Countdown</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span className="text-[9px] font-mono text-muted-foreground">TRACKING {launches.length} LAUNCHES</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            data-testid="button-prev-launch"
            onClick={prev}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">
            {activeIndex + 1}/{launches.length}
          </span>
          <button
            data-testid="button-next-launch"
            onClick={next}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {launches.map((launch, i) => (
        <LaunchCard key={launch.id} launch={launch} isActive={i === activeIndex} />
      ))}
    </div>
  );
}
