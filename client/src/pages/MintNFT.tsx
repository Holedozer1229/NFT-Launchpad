import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Launch, RARITY_TIERS, RarityTier, SUPPORTED_CHAINS, ChainId, STARSHIP_FLIGHT_SHOWCASES } from "@shared/schema";
import { useState, useEffect } from "react";
import { EmbeddedWallet } from "@/components/EmbeddedWallet";
import { MintCard } from "@/components/MintCard";
import { LaunchSelector } from "@/components/LaunchSelector";
import { OracleOverlay } from "@/components/OracleOverlay";
import { ResonanceDrop } from "@/components/ResonanceDrop";
import { Cpu, Eye, Database, Rocket, Users, CheckCircle2, AlertCircle, XCircle, Crown, Flame, Diamond, Gem, Link2, Fuel, ExternalLink, ShoppingBag, Loader2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import LaunchCountdown from "@/components/LaunchCountdown";
import { useAccount, useSignMessage } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { haptic } from "@/lib/haptics";

type StarshipFlightShowcase = (typeof STARSHIP_FLIGHT_SHOWCASES)[number];

const RARITY_ORDER: RarityTier[] = ["mythic", "legendary", "rare", "common"];
const RARITY_ICONS: Record<RarityTier, typeof Crown> = {
  mythic: Crown,
  legendary: Flame,
  rare: Diamond,
  common: Gem,
};

interface StarshipMintModalProps {
  flight: StarshipFlightShowcase | null;
  onClose: () => void;
}

function StarshipMintModal({ flight, onClose }: StarshipMintModalProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRarity, setSelectedRarity] = useState<RarityTier>("common");
  const [selectedChain, setSelectedChain] = useState<ChainId>("ethereum");
  const [isMinting, setIsMinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mintedResult, setMintedResult] = useState<{
    openseaUrl: string | null;
    openseaSupported: boolean;
    engineMint: { transactionId: string; txHash: string | null; status: string; contract: string } | null;
  } | null>(null);

  const chain = SUPPORTED_CHAINS[selectedChain];

  const executeMint = async () => {
    if (!isConnected || !address) {
      toast({ title: "WALLET REQUIRED", description: "Connect your wallet to mint.", variant: "destructive" });
      return;
    }
    if (!flight) return;

    setIsMinting(true);
    setProgress(0);
    setMintedResult(null);

    const tier = RARITY_TIERS[selectedRarity];
    const nonce = Date.now().toString();
    const mintMessage = `SKYNT Protocol — Authorize Mint\nAction: Mint Starship Flight NFT\nFlight: ${flight.flightId}\nRarity: ${selectedRarity}\nChain: ${selectedChain}\nWallet: ${address}\nNonce: ${nonce}`;

    let signature: string;
    try {
      toast({ title: "SIGNATURE REQUIRED", description: "Sign in your wallet to authorize this mint." });
      signature = await signMessageAsync({ message: mintMessage });
    } catch (sigErr: any) {
      toast({ title: "SIGNATURE CANCELLED", description: "You must sign to authorize the mint.", variant: "destructive" });
      setIsMinting(false);
      return;
    }

    const steps = [
      "SIGNATURE VERIFIED — IDENTITY CONFIRMED...",
      `CONNECTING TO ${chain.name.toUpperCase()} NETWORK...`,
      `VERIFYING ${tier.label.toUpperCase()} RARITY SHARD...`,
      "SYNCING STARSHIP TELEMETRY DATA...",
      "CALCULATING Φ ALGEBRA...",
      `DEPLOYING TO ${chain.name.toUpperCase()} (Chain ${chain.chainId || "L1"})...`,
      "ENQUEUING VIA ENGINE SERVER WALLET...",
      `${tier.label.toUpperCase()} STARSHIP ARTIFACT MATERIALIZED...`,
      "SUBMITTING TO OPENSEA SEAPORT PROTOCOL...",
    ];

    for (let i = 0; i < steps.length; i++) {
      toast({ title: `SYNA-PHASE ${i + 1}/${steps.length}`, description: steps[i] });
      await new Promise((r) => setTimeout(r, 800));
      setProgress(Math.floor(((i + 1) / steps.length) * 100));
    }

    try {
      const response = await apiRequest("POST", "/api/starship/mint-flight", {
        flightId: flight.flightId,
        rarity: selectedRarity,
        chain: selectedChain,
        walletAddress: address,
        signature,
        message: mintMessage,
      });
      const result = await response.json();
      haptic("heavy");
      setMintedResult({
        openseaUrl: result.openseaUrl || null,
        openseaSupported: result.openseaSupported ?? false,
        engineMint: result.engineMint || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      toast({
        title: "STARSHIP ARTIFACT MINTED",
        description: `${tier.label} — ${flight.missionName} inscribed on ${chain.name}.`,
        variant: "default",
      });
    } catch (err: any) {
      haptic("error");
      const msg = err?.message || "The Oracle could not inscribe the artifact.";
      toast({ title: "MINT FAILED", description: msg, variant: "destructive" });
    }

    setIsMinting(false);
  };

  if (!flight) return null;

  return (
    <Dialog open={!!flight} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black/95 border border-primary/30 text-foreground max-w-md w-full backdrop-blur-xl" data-testid="dialog-starship-mint">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary animate-pulse" />
            Mint Flight — {flight.missionName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground border border-white/10 rounded-sm px-3 py-2 bg-white/[0.02]">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span>{flight.vehicleName} · {flight.orbit}</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/60">Select Rarity Tier</span>
            <div className="grid grid-cols-2 gap-2" data-testid="modal-rarity-selector">
              {RARITY_ORDER.map((tier) => {
                const config = RARITY_TIERS[tier];
                const Icon = RARITY_ICONS[tier];
                const isSelected = selectedRarity === tier;
                return (
                  <button
                    key={tier}
                    data-testid={`button-modal-tier-${tier}`}
                    onClick={() => !isMinting && setSelectedRarity(tier)}
                    disabled={isMinting}
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      isSelected
                        ? "border-primary/60 bg-primary/10 shadow-[0_0_12px_rgba(var(--primary)/0.15)]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    } ${isMinting ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-primary" style={{ color: `var(--color-neon-${config.color})` }} />
                      <span className="font-heading text-xs font-bold uppercase tracking-wider" style={{ color: isSelected ? `var(--color-neon-${config.color})` : "var(--foreground)" }}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">{config.supply} supply</span>
                      <span className="font-mono text-[10px] text-primary/80">{config.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/60 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Target Chain
            </span>
            <div className="flex gap-1.5 flex-wrap" data-testid="modal-chain-selector">
              {(Object.keys(SUPPORTED_CHAINS) as ChainId[]).map((cid) => {
                const c = SUPPORTED_CHAINS[cid];
                const isSelected = selectedChain === cid;
                return (
                  <button
                    key={cid}
                    data-testid={`button-modal-chain-${cid}`}
                    onClick={() => !isMinting && setSelectedChain(cid)}
                    disabled={isMinting}
                    className={`px-2 py-1 rounded-md border text-[10px] font-heading uppercase tracking-wider transition-all flex items-center gap-1 ${
                      isSelected
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground"
                    } ${isMinting ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span style={{ color: c.color }}>{c.icon}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/60 pt-0.5">
              <Fuel className="w-2.5 h-2.5" />
              <span>Gas: {chain.gasEstimate}</span>
            </div>
          </div>

          {isMinting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-primary animate-pulse">
                <span className="flex items-center gap-2">
                  <Radio className="w-3 h-3 animate-spin" /> COMMUNICATING WITH SPHINXOS
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1 bg-white/5 [&>div]:bg-primary" />
            </div>
          )}

          {mintedResult && !isMinting && (
            <div className="space-y-2">
              <div className="p-3 bg-black/30 border border-neon-green/30 rounded-sm space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-wider text-neon-green">
                  <CheckCircle2 className="w-3 h-3" /> Artifact Inscribed
                </div>
                {mintedResult.engineMint && (
                  <>
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-muted-foreground">Engine Tx</span>
                      <span className="text-primary truncate max-w-[160px]">{mintedResult.engineMint.transactionId}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-muted-foreground">Status</span>
                      <span className="text-neon-green">{mintedResult.engineMint.status}</span>
                    </div>
                  </>
                )}
              </div>
              {mintedResult.openseaSupported && mintedResult.openseaUrl && (
                <a
                  href={mintedResult.openseaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-modal-opensea"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-md border border-[#2081E2]/60 bg-[#2081E2]/10 text-[#2081E2] hover:bg-[#2081E2]/20 transition-all font-heading text-xs tracking-wider"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  VIEW ON OPENSEA
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {!isConnected ? (
            <div className="text-center text-xs font-mono text-amber-400 border border-amber-400/20 rounded-sm px-3 py-2 bg-amber-400/5">
              Connect your wallet to mint this artifact
            </div>
          ) : (
            <Button
              data-testid="button-modal-mint"
              className="w-full py-6 font-heading font-bold text-sm bg-primary hover:bg-primary/80 text-black tracking-widest uppercase transition-all hover:shadow-[0_0_20px_rgba(255,215,0,0.4)]"
              onClick={executeMint}
              disabled={isMinting}
            >
              {isMinting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> PROCESSING...</>
              ) : (
                `INVOKE ORACLE — ${RARITY_TIERS[selectedRarity].label}`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MintNFT() {
  const { data: launches, isLoading } = useQuery<Launch[]>({
    queryKey: ["/api/launches"],
  });

  const { data: showcaseData } = useQuery<typeof STARSHIP_FLIGHT_SHOWCASES>({
    queryKey: ["/api/starship-nft-showcase"],
  });

  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [mintFlight, setMintFlight] = useState<StarshipFlightShowcase | null>(null);

  useEffect(() => {
    if (launches && launches.length > 0 && !selectedLaunch) {
      setSelectedLaunch(launches[0]);
    }
  }, [launches, selectedLaunch]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loading-spinner">
        <div className="neon-spinner" />
        <span className="text-[11px] font-mono text-primary/60 tracking-widest uppercase animate-pulse">
          Initializing Oracle...
        </span>
      </div>
    );
  }

  return (
    <div className="text-foreground relative" data-testid="mint-nft-page">
      <OracleOverlay />

      <StarshipMintModal
        flight={mintFlight}
        onClose={() => setMintFlight(null)}
      />

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

          <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide md:mx-0 md:px-0 snap-x snap-mandatory">
            {(showcaseData ?? STARSHIP_FLIGHT_SHOWCASES).map((flight) => (
              <div
                key={flight.flightId}
                className="cosmic-card flex-shrink-0 w-[260px] sm:w-[280px] flex flex-col overflow-hidden group snap-center"
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
                      <span className="text-xs font-mono uppercase tracking-widest">Crew Roster</span>
                    </div>
                    <div className="grid gap-1.5 pl-1 border-l border-primary/20">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-mono">CDR</span>
                        <span className="text-white font-medium">{flight.crew.commander}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-mono">PLT</span>
                        <span className="text-white font-medium">{flight.crew.pilot}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-mono">SPC</span>
                        <span className="text-white font-medium">{flight.crew.missionSpecialist}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
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
                      <span className="text-[10px] sm:text-[9px] font-mono text-muted-foreground uppercase">Orbit: {flight.orbit}</span>
                      {flight.outcome === "success" && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] sm:text-[9px] font-bold uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> SUCCESS
                        </Badge>
                      )}
                      {flight.outcome === "partial" && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] sm:text-[9px] font-bold uppercase">
                          <AlertCircle className="w-2.5 h-2.5 mr-1" /> PARTIAL
                        </Badge>
                      )}
                      {flight.outcome === "failed" && (
                        <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] sm:text-[9px] font-bold uppercase">
                          <XCircle className="w-2.5 h-2.5 mr-1" /> FAILED
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-[10px] font-heading font-bold uppercase tracking-widest bg-primary/20 hover:bg-primary/40 border border-primary/50"
                      onClick={() => setMintFlight(flight as StarshipFlightShowcase)}
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
                  <div key={i} className={`w-2 h-8 skew-x-12 ${i === 4 ? "bg-primary" : "bg-primary/20"}`}></div>
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
