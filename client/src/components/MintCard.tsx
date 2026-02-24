import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/mock-web3";
import { Launch, RARITY_TIERS, RarityTier, SUPPORTED_CHAINS, ChainId } from "@shared/schema";
import { Loader2, Rocket, Radio, Eye, Brain, Zap, Crown, Flame, Diamond, Gem, Link2, Fuel, ExternalLink } from "lucide-react";
import { TermsGate } from "./TermsGate";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import missionPatch from "../assets/mission-patch.png";
import holoFrame from "../assets/holo-frame.png";
import sphinxEye from "@/assets/sphinx-eye.png";

interface MintCardProps {
  mission: Launch;
}

const RARITY_ICONS: Record<RarityTier, typeof Crown> = {
  mythic: Crown,
  legendary: Flame,
  rare: Diamond,
  common: Gem,
};

const RARITY_ORDER: RarityTier[] = ["mythic", "legendary", "rare", "common"];

export function MintCard({ mission }: MintCardProps) {
  const { isConnected, connect, address } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState<RarityTier>("common");
  const [selectedChain, setSelectedChain] = useState<ChainId>("ethereum");
  const [showTerms, setShowTerms] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chain = SUPPORTED_CHAINS[selectedChain];

  const mintedByRarity = (mission.mintedByRarity || { mythic: 0, legendary: 0, rare: 0, common: 0 }) as Record<RarityTier, number>;

  useEffect(() => {
    setIsMinting(false);
    setProgress(0);
  }, [mission.id]);

  const handleMintClick = () => {
    if (!isConnected) {
      connect();
      return;
    }
    const tier = RARITY_TIERS[selectedRarity];
    const minted = mintedByRarity[selectedRarity] || 0;
    if (minted >= tier.supply) {
      toast({ title: "TIER EXHAUSTED", description: `All ${tier.label} artifacts have been claimed.`, variant: "destructive" });
      return;
    }
    setShowTerms(true);
  };

  const executeMint = async () => {
    setIsMinting(true);
    setProgress(0);

    const tier = RARITY_TIERS[selectedRarity];
    const steps = [
      "CONSULTING THE ORACLE...",
      `CONNECTING TO ${chain.name.toUpperCase()} NETWORK...`,
      `VERIFYING ${tier.label.toUpperCase()} RARITY SHARD...`,
      "SYNCING CROSS-CHANNEL STX YIELD...",
      "MERGE MINING PROOF GENERATED...",
      "CALCULATING Φ ALGEBRA...",
      `DEPLOYING TO ${chain.name.toUpperCase()} (Chain ${chain.chainId})...`,
      `${tier.label.toUpperCase()} ARTIFACT MATERIALIZED ON ${chain.name.toUpperCase()}...`
    ];

    for (let i = 0; i < steps.length; i++) {
      toast({ title: `SYNA-PHASE ${i+1}/${steps.length}`, description: steps[i] });
      await new Promise(r => setTimeout(r, 1000));
      setProgress(Math.floor(((i + 1) / steps.length) * 100));
    }

    try {
      const tokenHex = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0").toUpperCase()).join("");
      const tokenId = `0x${tokenHex.slice(0, 4)}...${tokenHex.slice(-4)}`;
      const ownerAddr = address || `0x${tokenHex.slice(0, 4)}...${tokenHex.slice(-4)}`;

      await apiRequest("POST", "/api/nfts", {
        title: `${mission.title} — ${tier.label}`,
        image: "/assets/mission-patch.png",
        rarity: tier.label,
        status: "minted",
        mintDate: new Date().toISOString().split("T")[0],
        tokenId,
        owner: ownerAddr,
        price: tier.price,
        chain: selectedChain,
        launchId: mission.id,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });

      toast({
        title: "DESTINY FULFILLED",
        description: `${tier.label} Artifact [${mission.title}] inscribed on ${chain.name}.`,
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "MINT FAILED",
        description: "The Oracle could not inscribe the artifact. Try again.",
        variant: "destructive",
      });
    }

    setIsMinting(false);
  };

  const totalMinted = Object.values(mintedByRarity).reduce((a, b) => a + b, 0);
  const totalSupply = Object.values(RARITY_TIERS).reduce((a, t) => a + t.supply, 0);

  return (
    <>
      <TermsGate open={showTerms} onOpenChange={setShowTerms} onAccept={executeMint} />

      <div className="relative w-full max-w-md group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-primary rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 animate-pulse"></div>

        <Card className="relative sphinx-card border-none bg-black/40 text-foreground overflow-hidden">
          <div className="absolute inset-0 pointer-events-none z-20 opacity-30 mix-blend-screen">
             <img src={holoFrame} alt="" className="w-full h-full object-fill" />
          </div>

          <div className="relative aspect-square overflow-hidden bg-black/50 flex items-center justify-center p-8 border-b border-primary/20">
            <div className="absolute inset-0 bg-[url('/src/assets/texture-metal.png')] opacity-20 mix-blend-overlay"></div>
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <img src={sphinxEye} className="w-64 h-64 animate-[spin_60s_linear_infinite]" />
            </div>

            <img
              src={missionPatch}
              alt="Mission Patch"
              className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,215,0,0.2)] transition-transform duration-700 hover:scale-105 z-10"
            />
            <div className="absolute top-4 right-4 z-20">
               {mission.status === 'active' ? (
                 <Badge variant="outline" className="bg-primary/10 text-primary border-primary animate-pulse font-heading tracking-widest text-[10px]">
                   <Eye className="w-3 h-3 mr-1" /> ORACLE ACTIVE
                 </Badge>
               ) : (
                 <Badge variant="outline" className="font-mono text-muted-foreground border-white/10 text-[10px]">
                   {mission.status.toUpperCase()}
                 </Badge>
               )}
            </div>

            <div className="absolute bottom-4 left-4 z-20">
               <Badge variant="outline" className="bg-black/60 text-accent border-accent/50 font-mono text-[10px] backdrop-blur-md">
                 <Brain className="w-3 h-3 mr-1" /> Φ: 0.982
               </Badge>
            </div>
          </div>

          <CardHeader className="space-y-1 pb-3 border-b border-white/5 bg-black/20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-heading font-bold text-primary oracle-glow" data-testid="text-mint-title">
                  {mission.title}
                </h3>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-[10px] font-mono text-accent flex items-center gap-2">
                    <Zap className="w-2 h-2" /> MERGE MINING ACTIVE
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-heading font-bold text-foreground drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]" data-testid="text-tier-price">
                  {RARITY_TIERS[selectedRarity].price}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-primary/60">
                <span>Total Distribution</span>
                <span className="text-primary">{totalMinted} / {totalSupply}</span>
              </div>
              <Progress value={(totalMinted / totalSupply) * 100} className="h-1 bg-white/5 [&>div]:bg-primary [&>div]:shadow-[0_0_10px_currentColor]" />
            </div>

            <div className="space-y-1.5" data-testid="rarity-tier-selector">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/60">Select Rarity Tier</span>
              <div className="grid grid-cols-2 gap-2">
                {RARITY_ORDER.map((tier) => {
                  const config = RARITY_TIERS[tier];
                  const Icon = RARITY_ICONS[tier];
                  const minted = mintedByRarity[tier] || 0;
                  const isSoldOut = minted >= config.supply;
                  const isSelected = selectedRarity === tier;

                  return (
                    <button
                      key={tier}
                      data-testid={`button-tier-${tier}`}
                      onClick={() => !isSoldOut && setSelectedRarity(tier)}
                      disabled={isSoldOut || isMinting}
                      className={`relative p-2.5 rounded-md border text-left transition-all ${
                        isSelected
                          ? `border-neon-${config.color}/60 bg-neon-${config.color}/10 shadow-[0_0_12px_hsl(var(--neon-${config.color === 'magenta' ? 'magenta' : config.color})/0.15)]`
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      } ${isSoldOut ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      style={isSelected ? {
                        borderColor: `var(--color-neon-${config.color})`,
                        backgroundColor: `color-mix(in srgb, var(--color-neon-${config.color}) 8%, transparent)`,
                        boxShadow: `0 0 12px color-mix(in srgb, var(--color-neon-${config.color}) 20%, transparent)`,
                      } : undefined}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-3.5 h-3.5 text-neon-${config.color}`} style={{ color: `var(--color-neon-${config.color})` }} />
                        <span className={`font-heading text-xs font-bold uppercase tracking-wider`} style={{ color: isSelected ? `var(--color-neon-${config.color})` : 'var(--foreground)' }}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {minted}/{config.supply}
                        </span>
                        <span className="font-mono text-[10px] text-primary/80">
                          {config.price}
                        </span>
                      </div>
                      {isSoldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-md">
                          <span className="font-heading text-[10px] font-bold text-red-400 tracking-widest">CLAIMED</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5" data-testid="chain-selector">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/60 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Target Chain
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(SUPPORTED_CHAINS) as ChainId[]).map((cid) => {
                  const c = SUPPORTED_CHAINS[cid];
                  const isSelected = selectedChain === cid;
                  return (
                    <button
                      key={cid}
                      data-testid={`button-chain-${cid}`}
                      onClick={() => !isMinting && setSelectedChain(cid)}
                      disabled={isMinting}
                      className={`px-2.5 py-1.5 rounded-md border text-[11px] font-heading uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "border-white/40 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                          : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground"
                      } ${isMinting ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span style={{ color: c.color }}>{c.icon}</span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/60 pt-1">
                <span className="flex items-center gap-1">
                  <Fuel className="w-2.5 h-2.5" /> Gas: {chain.gasEstimate}
                </span>
                <span className="truncate max-w-[140px]">{chain.contractAddress}</span>
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
          </CardContent>

          <CardFooter className="pt-2 pb-6">
            {isConnected ? (
              <div className="w-full space-y-3">
                <Button
                  data-testid="button-mint"
                  className="w-full text-lg py-7 font-heading font-bold bg-primary hover:bg-primary/80 text-black tracking-wider transition-all hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] relative overflow-hidden group"
                  onClick={handleMintClick}
                  disabled={isMinting || mission.status !== 'active'}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
                  {mission.status !== 'active' ? 'LINK OFFLINE' :
                    (isMinting ? "PROCESSING..." : `INVOKE ORACLE — ${RARITY_TIERS[selectedRarity].label}`)
                  }
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-connect"
                className="w-full text-lg py-7 font-heading font-bold bg-transparent border border-primary text-primary hover:bg-primary hover:text-black transition-all hover:shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                onClick={() => connect()}
              >
                CONNECT TERMINAL
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
