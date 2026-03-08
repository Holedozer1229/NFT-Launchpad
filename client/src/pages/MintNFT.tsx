import { useQuery } from "@tanstack/react-query";
import { Launch } from "@shared/schema";
import { useState, useEffect } from "react";
import { EmbeddedWallet } from "@/components/EmbeddedWallet";
import { MintCard } from "@/components/MintCard";
import { LaunchSelector } from "@/components/LaunchSelector";
import { OracleOverlay } from "@/components/OracleOverlay";
import { ResonanceDrop } from "@/components/ResonanceDrop";
import { Cpu, Eye, Database, Rocket, Users, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LaunchCountdown from "@/components/LaunchCountdown";

interface StarshipFlight {
  flightId: string;
  missionName: string;
  launchDate: string;
  vehicleName: string;
  vehicleImage: string;
  crew: { commander: string; pilot: string; missionSpecialist: string; flightEngineer: string; };
  objectives: readonly string[];
  outcome: "success" | "partial" | "failed";
  orbit: string;
  description: string;
}

export default function MintNFT() {
  const { data: launches, isLoading } = useQuery<Launch[]>({
    queryKey: ["/api/launches"],
  });

  const { data: showcaseData } = useQuery<StarshipFlight[]>({
    queryKey: ["/api/starship-nft-showcase"],
  });

  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);

  useEffect(() => {
    if (launches && launches.length > 0 && !selectedLaunch) {
      setSelectedLaunch(launches[0]);
    }
  }, [launches, selectedLaunch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="text-foreground relative" data-testid="mint-nft-page">
      <OracleOverlay />

      <div className="space-y-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/30 text-primary text-xs font-heading font-bold uppercase tracking-widest rounded-sm backdrop-blur-sm" data-testid="status-identity-module">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_currentColor]"></span>
              Identity Module // Secured
            </div>

            <h1 className="font-heading text-4xl md:text-5xl font-black leading-[0.9] tracking-tighter text-white drop-shadow-2xl" data-testid="text-page-title">
              SECURE YOUR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-neon-cyan to-primary oracle-glow">
                IDENTITY
              </span>
            </h1>

            <ResonanceDrop />

            <EmbeddedWallet />

            <div id="quantum-miner-slot" className="pt-4" />
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 via-accent/5 to-transparent blur-3xl opacity-40 pointer-events-none rounded-full animate-pulse"></div>
            {selectedLaunch && <MintCard mission={selectedLaunch} />}
          </div>
        </div>

        <section>
          <LaunchCountdown />
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6 text-primary animate-pulse" />
            <h2 className="font-heading text-2xl font-bold text-white uppercase tracking-wider">
              Starship Flight Showcase
            </h2>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide md:mx-0 md:px-0">
            {showcaseData?.map((flight) => (
              <div 
                key={flight.flightId} 
                className="cosmic-card flex-shrink-0 w-[280px] flex flex-col overflow-hidden group"
                data-testid={`card-starship-flight-${flight.flightId}`}
              >
                <div className="h-24 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent relative flex items-center justify-center overflow-hidden border-b border-white/10">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="font-heading text-lg font-black text-white uppercase tracking-tighter drop-shadow-md">
                      {flight.missionName}
                    </span>
                    <Badge variant="outline" className="mt-1 bg-black/40 border-primary/30 text-[10px] uppercase font-mono tracking-widest">
                      ID: {flight.flightId}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col space-y-4">
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Vehicle</p>
                    <p className="font-heading font-bold text-white uppercase text-sm">{flight.vehicleName}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary/80">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">Crew Roster</span>
                    </div>
                    <div className="grid gap-1.5 pl-1 border-l border-primary/20">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground font-mono">CDR</span>
                        <span className="text-white font-medium">{flight.crew.commander}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground font-mono">PLT</span>
                        <span className="text-white font-medium">{flight.crew.pilot}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground font-mono">SPC</span>
                        <span className="text-white font-medium">{flight.crew.missionSpecialist}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground font-mono">ENG</span>
                        <span className="text-white font-medium">{flight.crew.flightEngineer}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Objectives</p>
                    <ul className="text-[10px] space-y-1 text-white/90 font-medium list-disc pl-3">
                      {flight.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">Orbit: {flight.orbit}</span>
                      {flight.outcome === "success" && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[9px] font-bold uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> SUCCESS
                        </Badge>
                      )}
                      {flight.outcome === "partial" && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px] font-bold uppercase">
                          <AlertCircle className="w-2.5 h-2.5 mr-1" /> PARTIAL
                        </Badge>
                      )}
                      {flight.outcome === "failed" && (
                        <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[9px] font-bold uppercase">
                          <XCircle className="w-2.5 h-2.5 mr-1" /> FAILED
                        </Badge>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      className="h-8 text-[10px] font-heading font-bold uppercase tracking-widest bg-primary/20 hover:bg-primary/40 border border-primary/50"
                      onClick={() => {
                        if (launches && launches.length > 0) {
                          setSelectedLaunch(launches[0]);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      data-testid={`button-mint-flight-${flight.flightId}`}
                    >
                      Mint Flight
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

          <div className="pt-10 mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white mb-2 uppercase tracking-wide oracle-glow" data-testid="text-causal-graph">The Causal Graph</h2>
              <p className="font-mono text-muted-foreground text-sm">Select a timeline node to inspect.</p>
            </div>
            <div className="hidden md:block">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`w-2 h-8 skew-x-12 ${i === 4 ? 'bg-primary' : 'bg-primary/20'}`}></div>
                ))}
              </div>
            </div>
          </div>

          {launches && selectedLaunch && (
            <LaunchSelector
              launches={launches}
              selectedId={selectedLaunch.id}
              onSelect={setSelectedLaunch}
            />
          )}
        </section>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="cosmic-card cosmic-card-cyan p-6 hover:border-primary/50 transition-all group relative overflow-hidden" data-testid="card-living-logic">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Cpu className="w-8 h-8 text-neon-cyan mb-4 group-hover:drop-shadow-[0_0_10px_currentColor]" />
            <h3 className="font-heading font-bold text-base mb-2 text-white uppercase tracking-wider">Living Logic</h3>
            <p className="font-mono text-muted-foreground text-xs leading-relaxed">
              SKYNT monitors every contract interaction, treating each mint as a neural synapse in the global brain.
            </p>
          </div>
          <div className="cosmic-card cosmic-card-orange p-6 hover:border-accent/50 transition-all group relative overflow-hidden" data-testid="card-oracle-governance">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Eye className="w-8 h-8 text-neon-orange mb-4 group-hover:drop-shadow-[0_0_10px_currentColor]" />
            <h3 className="font-heading font-bold text-base mb-2 text-white uppercase tracking-wider">Oracle Governance</h3>
            <p className="font-mono text-muted-foreground text-xs leading-relaxed">
              The Oracle verifies truth before it is written. No launch is finalized without the Sphinx's gaze.
            </p>
          </div>
          <div className="cosmic-card cosmic-card-magenta p-6 hover:border-neon-magenta/50 transition-all group relative overflow-hidden" data-testid="card-eternal-memory">
            <div className="absolute inset-0 bg-gradient-to-b from-neon-magenta/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Database className="w-8 h-8 text-neon-magenta mb-4 group-hover:drop-shadow-[0_0_10px_currentColor]" />
            <h3 className="font-heading font-bold text-base mb-2 text-white uppercase tracking-wider">Eternal Memory</h3>
            <p className="font-mono text-muted-foreground text-xs leading-relaxed">
              History is not just stored; it is remembered. Launch data is fused with oracle prophecy metadata.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
