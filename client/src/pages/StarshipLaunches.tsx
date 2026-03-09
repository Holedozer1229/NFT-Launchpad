import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Rocket, Clock, MapPin, ChevronLeft, ChevronRight, Radio, Target,
  Flame, Shield, Star, Package, Trophy, AlertTriangle, CheckCircle2,
  ExternalLink, Orbit, Zap, Info, Crown, Gem, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StarshipLaunch {
  id: string;
  name: string;
  net: string;
  status: string;
  statusAbbrev: string;
  provider: string;
  rocket: string;
  pad: string;
  location: string;
  image: string | null;
  missionName: string;
  missionDescription: string | null;
  missionType: string;
  orbit: string | null;
  webcastLive: boolean;
  windowStart: string;
  windowEnd: string | null;
  probability: number | null;
  historic?: boolean;
  outcome?: string;
}

interface NftPackItem {
  rarity: string;
  title: string;
  type: string;
}

interface NftPack {
  id: string;
  name: string;
  description: string;
  tier: string;
  price: string;
  supply: number;
  minted: number;
  linkedMissionId: string | null;
  items: NftPackItem[];
  image: string;
}

interface StarshipData {
  upcoming: StarshipLaunch[];
  historic: StarshipLaunch[];
  all: StarshipLaunch[];
  nftPacks: NftPack[];
  stats: { totalFlights: number; successfulCatches: number; upcomingCount: number };
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

function CountdownUnit({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center" data-testid={`starship-countdown-${label.toLowerCase()}`}>
      <div
        className={cn(
          "w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-lg font-mono text-2xl sm:text-3xl font-black border",
          color === "orange" && "text-neon-orange border-neon-orange/30",
          color === "cyan" && "text-neon-cyan border-neon-cyan/30",
        )}
        style={{
          background: `linear-gradient(180deg, ${color === "orange" ? "hsl(30 100% 55% / 0.1)" : "hsl(185 100% 50% / 0.1)"} 0%, transparent 100%)`,
          textShadow: `0 0 15px ${color === "orange" ? "hsl(30 100% 55% / 0.6)" : "hsl(185 100% 50% / 0.6)"}`,
        }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

function HeroCountdown({ launch }: { launch: StarshipLaunch }) {
  const { days, hours, minutes, seconds } = useCountdown(launch.net);
  const isPast = new Date(launch.net).getTime() <= Date.now();
  const launchDate = new Date(launch.net);

  return (
    <div className="relative overflow-hidden rounded-xl border border-neon-orange/30" data-testid="starship-hero-countdown">
      <div className="absolute inset-0 bg-gradient-to-br from-neon-orange/5 via-transparent to-neon-cyan/5" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-orange/60 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-orange/30 to-transparent" />

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-neon-orange/10 border border-neon-orange/30">
            <Rocket className="w-5 h-5 text-neon-orange" style={{ filter: "drop-shadow(0 0 6px hsl(30 100% 55% / 0.7))" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-bold tracking-[0.15em] text-neon-orange uppercase">Next Starship Launch</span>
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">LIVE TELEMETRY LINK ACTIVE</span>
          </div>
        </div>

        <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-2 leading-tight" data-testid="text-starship-mission-name">
          {launch.missionName}
        </h2>
        <p className="font-mono text-sm text-muted-foreground mb-6">
          {launch.name}
        </p>

        <div className="flex flex-wrap items-center gap-4 mb-8 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-neon-orange" />
            {launch.location}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-neon-cyan" />
            {launchDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" · "}
            {launchDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
          </span>
          {launch.orbit && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Orbit className="w-3.5 h-3.5 text-neon-magenta" />
              {launch.orbit}
            </span>
          )}
          {launch.probability !== null && launch.probability > 0 && (
            <span className="flex items-center gap-1.5 text-neon-green">
              <Target className="w-3.5 h-3.5" />
              {launch.probability}% GO
            </span>
          )}
        </div>

        {!isPast ? (
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <CountdownUnit value={days} label="Days" color="orange" />
            <span className="text-neon-orange/40 font-mono text-2xl mt-[-20px]">:</span>
            <CountdownUnit value={hours} label="Hours" color="orange" />
            <span className="text-neon-orange/40 font-mono text-2xl mt-[-20px]">:</span>
            <CountdownUnit value={minutes} label="Minutes" color="cyan" />
            <span className="text-neon-orange/40 font-mono text-2xl mt-[-20px]">:</span>
            <CountdownUnit value={seconds} label="Seconds" color="cyan" />
          </div>
        ) : (
          <div className="text-center py-4">
            <span className="font-heading text-lg text-neon-green uppercase tracking-widest" style={{ textShadow: "0 0 12px hsl(145 100% 50% / 0.5)" }}>
              Launch Complete
            </span>
          </div>
        )}

        {launch.missionDescription && (
          <p className="mt-8 font-mono text-xs text-muted-foreground leading-relaxed border-t border-white/5 pt-6 max-w-3xl">
            <Info className="w-3.5 h-3.5 text-neon-cyan inline mr-2 -mt-0.5" />
            {launch.missionDescription}
          </p>
        )}
      </div>
    </div>
  );
}

function MissionTimelineCard({ launch, isSelected, onClick }: { launch: StarshipLaunch; isSelected: boolean; onClick: () => void }) {
  const isPast = new Date(launch.net).getTime() <= Date.now();
  const flightNum = launch.id.replace("starship-ift-", "IFT-");

  const outcomeIcon = launch.outcome === "success" ? (
    <CheckCircle2 className="w-4 h-4 text-neon-green" />
  ) : launch.outcome === "partial" ? (
    <AlertTriangle className="w-4 h-4 text-neon-orange" />
  ) : null;

  return (
    <button
      data-testid={`mission-card-${launch.id}`}
      onClick={onClick}
      className={cn(
        "w-full text-left cosmic-card p-4 transition-all duration-300 group relative overflow-hidden",
        isSelected
          ? "border-neon-orange/60 bg-neon-orange/5 shadow-[0_0_20px_hsl(30_100%_55%/0.15)]"
          : "cosmic-card-orange hover:border-neon-orange/40 hover:bg-neon-orange/3"
      )}
    >
      {isSelected && <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-orange/80 to-transparent" />}

      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-mono tracking-widest uppercase",
            isPast ? "border-muted-foreground/40 text-muted-foreground" : "border-neon-green/50 text-neon-green animate-pulse"
          )}
        >
          {isPast ? (launch.historic ? "HISTORIC" : "COMPLETED") : launch.status}
        </Badge>
        {outcomeIcon}
      </div>

      <h4 className={cn(
        "font-heading text-sm font-bold leading-tight mb-1 transition-colors",
        isSelected ? "text-neon-orange" : "text-white group-hover:text-neon-orange"
      )}>
        {launch.missionName}
      </h4>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
        <Clock className="w-3 h-3" />
        {new Date(launch.net).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        {launch.orbit && (
          <>
            <span className="text-white/10">|</span>
            <Orbit className="w-3 h-3" />
            {launch.orbit}
          </>
        )}
      </div>
    </button>
  );
}

const RARITY_STYLES: Record<string, { color: string; border: string; bg: string; glow: string; icon: typeof Star }> = {
  mythic: { color: "text-neon-magenta", border: "border-neon-magenta/40", bg: "bg-neon-magenta/8", glow: "shadow-[0_0_25px_hsl(300_100%_60%/0.2)]", icon: Crown },
  legendary: { color: "text-neon-orange", border: "border-neon-orange/40", bg: "bg-neon-orange/8", glow: "shadow-[0_0_20px_hsl(30_100%_55%/0.2)]", icon: Gem },
  rare: { color: "text-neon-cyan", border: "border-neon-cyan/40", bg: "bg-neon-cyan/8", glow: "shadow-[0_0_15px_hsl(185_100%_50%/0.15)]", icon: Star },
  common: { color: "text-neon-green", border: "border-neon-green/40", bg: "bg-neon-green/8", glow: "", icon: Sparkles },
};

function NftPackCard({ pack, linkedMission }: { pack: NftPack; linkedMission?: StarshipLaunch }) {
  const style = RARITY_STYLES[pack.tier] || RARITY_STYLES.rare;
  const TierIcon = style.icon;
  const remaining = pack.supply - pack.minted;

  return (
    <div
      data-testid={`nft-pack-${pack.id}`}
      className={cn(
        "cosmic-card relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
        style.border,
        style.glow,
      )}
    >
      <div className={cn("absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent to-transparent", style.color.replace("text-", "via-") + "/60")} />

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <Badge variant="outline" className={cn("text-[9px] font-mono tracking-[0.2em] uppercase", style.color, style.border)}>
            <TierIcon className="w-3 h-3 mr-1" />
            {pack.tier} edition
          </Badge>
          <span className="font-mono text-[10px] text-muted-foreground">
            {remaining}/{pack.supply} left
          </span>
        </div>

        <h3 className={cn("font-heading text-lg font-bold mb-2", style.color)} data-testid={`text-pack-name-${pack.id}`}>
          {pack.name}
        </h3>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-5">
          {pack.description}
        </p>

        <div className="space-y-2 mb-5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Pack Contents</span>
          {pack.items.map((item, i) => {
            const itemStyle = RARITY_STYLES[item.rarity] || RARITY_STYLES.common;
            return (
              <div key={i} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded bg-white/[0.02] border border-white/5">
                <div className={cn("w-1.5 h-1.5 rounded-full", itemStyle.color.replace("text-", "bg-"))} />
                <span className="font-mono text-xs text-white/80 flex-1">{item.title}</span>
                <span className={cn("text-[9px] font-mono uppercase tracking-wider", itemStyle.color)}>{item.rarity}</span>
              </div>
            );
          })}
        </div>

        {linkedMission && (
          <div className="flex items-center gap-2 py-2 px-3 rounded bg-white/[0.03] border border-white/5 mb-5">
            <Rocket className="w-3 h-3 text-neon-orange" />
            <span className="font-mono text-[10px] text-muted-foreground">Linked: {linkedMission.missionName}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div>
            <span className={cn("font-heading text-lg font-bold", style.color)}>{pack.price}</span>
          </div>
          <button
            data-testid={`button-mint-pack-${pack.id}`}
            disabled={remaining <= 0}
            className={cn(
              "px-5 py-2 rounded font-heading text-xs font-bold uppercase tracking-widest transition-all duration-300",
              remaining > 0
                ? cn("text-black hover:scale-105",
                    pack.tier === "mythic" ? "bg-gradient-to-r from-neon-magenta to-neon-orange hover:shadow-[0_0_20px_hsl(300_100%_60%/0.4)]"
                    : "bg-gradient-to-r from-neon-orange to-yellow-500 hover:shadow-[0_0_20px_hsl(30_100%_55%/0.4)]"
                  )
                : "bg-white/10 text-muted-foreground cursor-not-allowed"
            )}
          >
            {remaining > 0 ? "Mint Pack" : "Sold Out"}
          </button>
        </div>

        {remaining <= 1 && remaining > 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <Flame className="w-3 h-3 text-red-400 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Last one remaining</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsBar({ stats }: { stats: StarshipData["stats"] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="starship-stats">
      <div className="cosmic-card cosmic-card-orange p-2 sm:p-4 text-center">
        <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-neon-orange mx-auto mb-1 sm:mb-2" />
        <span className="font-heading text-lg sm:text-2xl font-black text-white block" data-testid="stat-total-flights">{stats.totalFlights}</span>
        <span className="text-[8px] sm:text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Flights</span>
      </div>
      <div className="cosmic-card cosmic-card-green p-2 sm:p-4 text-center">
        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-neon-green mx-auto mb-1 sm:mb-2" />
        <span className="font-heading text-lg sm:text-2xl font-black text-white block" data-testid="stat-catches">{stats.successfulCatches}</span>
        <span className="text-[8px] sm:text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Catches</span>
      </div>
      <div className="cosmic-card cosmic-card-cyan p-2 sm:p-4 text-center">
        <Target className="w-4 h-4 sm:w-5 sm:h-5 text-neon-cyan mx-auto mb-1 sm:mb-2" />
        <span className="font-heading text-lg sm:text-2xl font-black text-white block" data-testid="stat-upcoming">{stats.upcomingCount}</span>
        <span className="text-[8px] sm:text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Upcoming</span>
      </div>
    </div>
  );
}

export default function StarshipLaunches() {
  const { data, isLoading, isError } = useQuery<StarshipData>({
    queryKey: ["/api/starship-launches"],
    refetchInterval: 5 * 60 * 1000,
  });

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

  useEffect(() => {
    if (data?.all?.length && !selectedMissionId) {
      const upcoming = data.upcoming[0];
      setSelectedMissionId(upcoming?.id || data.all[0]?.id);
    }
  }, [data, selectedMissionId]);

  const selectedMission = data?.all.find((m) => m.id === selectedMissionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="starship-loading">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-neon-orange mx-auto" />
          <p className="font-mono text-xs text-muted-foreground">Loading Starship telemetry...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="starship-error">
        <div className="text-center space-y-4 cosmic-card cosmic-card-orange p-8">
          <AlertTriangle className="w-10 h-10 text-neon-orange mx-auto" />
          <p className="font-mono text-sm text-muted-foreground">Starship telemetry feed unavailable</p>
        </div>
      </div>
    );
  }

  const nextUpcoming = data.upcoming[0];
  const heroLaunch = nextUpcoming || data.historic[data.historic.length - 1];

  return (
    <div className="text-foreground space-y-10" data-testid="starship-launches-page">
      <div>
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-neon-orange/10 border border-neon-orange/30 text-neon-orange text-xs font-heading font-bold uppercase tracking-widest rounded-sm backdrop-blur-sm mb-6" data-testid="status-starship-program">
          <Flame className="w-4 h-4" style={{ filter: "drop-shadow(0 0 6px hsl(30 100% 55% / 0.7))" }} />
          Starship Program // Live
        </div>

        <h1 className="font-heading text-4xl md:text-5xl font-black leading-[0.9] tracking-tighter text-white drop-shadow-2xl mb-3" data-testid="text-page-title">
          STARSHIP <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-orange via-yellow-400 to-neon-orange" style={{ textShadow: "0 0 40px hsl(30 100% 55% / 0.3)" }}>
            LAUNCHES
          </span>
        </h1>
        <p className="font-mono text-sm text-muted-foreground max-w-xl">
          Track every Starship flight, from the first liftoff to the next frontier.
          Collect special edition NFT packs tied to historic missions.
        </p>
      </div>

      <StatsBar stats={data.stats} />

      {heroLaunch && <HeroCountdown launch={heroLaunch} />}

      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-white uppercase tracking-wider mb-1" data-testid="text-special-editions">
              Special Edition Packs
            </h2>
            <p className="font-mono text-xs text-muted-foreground">Limited legendary & mythic NFT collections tied to Starship milestones</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Package className="w-4 h-4 text-neon-orange" />
            <span className="text-[10px] font-mono text-muted-foreground">{data.nftPacks.length} PACKS</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.nftPacks.map((pack) => (
            <NftPackCard
              key={pack.id}
              pack={pack}
              linkedMission={data.all.find((m) => m.id === pack.linkedMissionId)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="font-heading text-xl font-bold text-white uppercase tracking-wider mb-1" data-testid="text-flight-timeline">
            Flight Timeline
          </h2>
          <p className="font-mono text-xs text-muted-foreground">Every integrated flight test — past, present, and future</p>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin" data-testid="mission-timeline-list">
            {data.all.map((launch) => (
              <MissionTimelineCard
                key={launch.id}
                launch={launch}
                isSelected={launch.id === selectedMissionId}
                onClick={() => setSelectedMissionId(launch.id)}
              />
            ))}
          </div>

          {selectedMission && (
            <div className="cosmic-card cosmic-card-orange p-6 sm:p-8" data-testid="mission-detail-panel">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-mono tracking-widest uppercase mb-3",
                      selectedMission.outcome === "success" ? "border-neon-green/50 text-neon-green" :
                      selectedMission.outcome === "partial" ? "border-neon-orange/50 text-neon-orange" :
                      "border-neon-cyan/50 text-neon-cyan"
                    )}
                  >
                    {selectedMission.historic ? (selectedMission.outcome === "success" ? "MISSION SUCCESS" : "PARTIAL SUCCESS") : selectedMission.status}
                  </Badge>
                  <h3 className="font-heading text-2xl font-bold text-white" data-testid="text-selected-mission-name">
                    {selectedMission.missionName}
                  </h3>
                </div>
                {selectedMission.outcome === "success" ? (
                  <CheckCircle2 className="w-8 h-8 text-neon-green flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px hsl(145 100% 50% / 0.5))" }} />
                ) : selectedMission.outcome === "partial" ? (
                  <AlertTriangle className="w-8 h-8 text-neon-orange flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px hsl(30 100% 55% / 0.5))" }} />
                ) : (
                  <Rocket className="w-8 h-8 text-neon-cyan flex-shrink-0 animate-pulse" />
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-neon-cyan" />
                  {new Date(selectedMission.net).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-neon-orange" />
                  {selectedMission.location}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Rocket className="w-3.5 h-3.5 text-neon-magenta" />
                  {selectedMission.rocket} · {selectedMission.provider}
                </div>
                {selectedMission.orbit && (
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <Orbit className="w-3.5 h-3.5 text-neon-green" />
                    {selectedMission.orbit}
                  </div>
                )}
              </div>

              {selectedMission.missionDescription && (
                <div className="border-t border-white/5 pt-5">
                  <h4 className="font-heading text-xs font-bold text-white uppercase tracking-widest mb-3">Mission Summary</h4>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    {selectedMission.missionDescription}
                  </p>
                </div>
              )}

              {selectedMission.image && (
                <div className="mt-6 rounded-lg overflow-hidden border border-white/10">
                  <img
                    src={selectedMission.image}
                    alt={selectedMission.missionName}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                    data-testid="img-mission"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
