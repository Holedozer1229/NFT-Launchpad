import { useQuery } from "@tanstack/react-query";
import { Launch } from "@shared/schema";
import { useState, useEffect } from "react";
import { EmbeddedWallet } from "@/components/EmbeddedWallet";
import { QuantumMiner } from "@/components/QuantumMiner";
import { MintCard } from "@/components/MintCard";
import { LaunchSelector } from "@/components/LaunchSelector";
import { OracleOverlay } from "@/components/OracleOverlay";
import { Cpu, Eye, Database } from "lucide-react";
import LaunchCountdown from "@/components/LaunchCountdown";

export default function MintNFT() {
  const { data: launches, isLoading } = useQuery<Launch[]>({
    queryKey: ["/api/launches"],
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

            <EmbeddedWallet />

            <div className="pt-4">
              <QuantumMiner />
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 via-accent/5 to-transparent blur-3xl opacity-40 pointer-events-none rounded-full animate-pulse"></div>
            {selectedLaunch && <MintCard mission={selectedLaunch} />}
          </div>
        </div>

        <section>
          <LaunchCountdown />
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
