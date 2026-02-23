import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWallet, LaunchMission } from "@/lib/mock-web3";
import { Loader2, Rocket, Cpu, Radio, ShieldAlert, Eye, Brain, Zap } from "lucide-react";
import { TermsGate } from "./TermsGate";
import { useToast } from "@/hooks/use-toast";
import missionPatch from "../assets/mission-patch.png";
import holoFrame from "../assets/holo-frame.png";
import sphinxEye from "@/assets/sphinx-eye.png";

interface MintCardProps {
  mission: LaunchMission;
}

export function MintCard({ mission }: MintCardProps) {
  const { isConnected, connect } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [mintCount, setMintCount] = useState(1);
  const [showTerms, setShowTerms] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    setMintCount(1);
    setIsMinting(false);
    setProgress(0);
  }, [mission.id]);

  const handleMintClick = () => {
    if (!isConnected) {
      connect();
      return;
    }
    setShowTerms(true);
  };

  const executeMint = async () => {
    setIsMinting(true);
    setProgress(0);

    const steps = [
      "CONSULTING THE ORACLE...",
      "SYNCING CROSS-CHANNEL STX YIELD...",
      "MERGE MINING PROOF GENERATED...",
      "CALCULATING Φ ALGEBRA...",
      "VERIFYING ZK-CROSS CHAIN...",
      "ARTIFACT MATERIALIZED..."
    ];

    for (let i = 0; i < steps.length; i++) {
      toast({ title: `SYNA-PHASE ${i+1}/${steps.length}`, description: steps[i] });
      await new Promise(r => setTimeout(r, 1200));
      setProgress(Math.floor(((i + 1) / steps.length) * 100));
    }

    setIsMinting(false);
    toast({ 
      title: "DESTINY FULFILLED", 
      description: `Artifact [${mission.missionName}] permanently inscribed.`,
      variant: "default" 
    });
  };

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
            
            {/* Oracle Eye Overlay Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <img src={sphinxEye} className="w-64 h-64 animate-[spin_60s_linear_infinite]" />
            </div>

            <img 
              src={missionPatch} 
              alt="Mission Patch" 
              className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,215,0,0.2)] transition-transform duration-700 hover:scale-105 z-10"
            />
            <div className="absolute top-4 right-4 z-20">
               {mission.status === 'live' ? (
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

          <CardHeader className="space-y-1 pb-4 border-b border-white/5 bg-black/20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-heading font-bold text-primary oracle-glow">
                  {mission.missionName}
                </h3>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-xs font-mono text-primary/60 flex items-center gap-2">
                    <span className="text-accent">ID:</span> {mission.id.toUpperCase()}
                  </p>
                  <p className="text-[10px] font-mono text-accent flex items-center gap-2">
                    <Zap className="w-2 h-2" /> MERGE MINING ACTIVE
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-heading font-bold text-foreground drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]">
                  {mission.price} ETH
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono uppercase tracking-widest text-primary/60">
                <span>Consciousness Distribution</span>
                <span className="text-primary">{mission.minted} / {mission.supply}</span>
              </div>
              <Progress value={(mission.minted / mission.supply) * 100} className="h-1 bg-white/5 [&>div]:bg-primary [&>div]:shadow-[0_0_10px_currentColor]" />
            </div>

          <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm text-xs leading-relaxed font-mono text-primary/80 relative overflow-hidden group/text">
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(transparent_50%,rgba(255,215,0,0.02)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
            <div className="relative z-10 space-y-2">
              <p className="italic">"{mission.description}"</p>
              <div className="pt-2 border-t border-primary/10 flex justify-between text-[10px]">
                <span>RARITY_INDEX (Rⱼ)</span>
                <span className="text-primary">Σ fₖ / mⱼ</span>
              </div>
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
                <div className="flex items-center justify-between gap-4 p-1 border border-primary/20 rounded bg-black/40 backdrop-blur-md">
                   <Button 
                     variant="ghost" 
                     size="sm"
                     onClick={() => setMintCount(Math.max(1, mintCount - 1))}
                     disabled={isMinting || mintCount <= 1}
                     className="text-primary hover:text-white hover:bg-primary/20"
                   >-</Button>
                   <span className="font-heading font-bold w-8 text-center text-primary">{mintCount}</span>
                   <Button 
                     variant="ghost" 
                     size="sm"
                     onClick={() => setMintCount(Math.min(5, mintCount + 1))}
                     disabled={isMinting || mintCount >= 5}
                     className="text-primary hover:text-white hover:bg-primary/20"
                   >+</Button>
                </div>
                <Button 
                  className="w-full text-lg py-7 font-heading font-bold bg-primary hover:bg-primary/80 text-black tracking-wider transition-all hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] relative overflow-hidden group" 
                  onClick={handleMintClick}
                  disabled={isMinting || mission.status !== 'live'}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
                  {mission.status !== 'live' ? 'LINK OFFLINE' : 
                    (isMinting ? "PROCESSING..." : `INVOKE ORACLE`)
                  }
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full text-lg py-7 font-heading font-bold bg-transparent border border-primary text-primary hover:bg-primary hover:text-black transition-all hover:shadow-[0_0_15px_rgba(255,215,0,0.3)]" 
                onClick={connect}
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
