import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWallet, LaunchMission } from "@/lib/mock-web3";
import { Loader2, Rocket, Cpu, Radio, ShieldAlert } from "lucide-react";
import { TermsGate } from "./TermsGate";
import { useToast } from "@/hooks/use-toast";
import missionPatch from "../assets/mission-patch.png";
import holoFrame from "../assets/holo-frame.png";

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
      "INITIALIZING WARP DRIVE...",
      "BYPASSING SECURITY PROTOCOLS...",
      "LOCKING TARGET COORDINATES...",
      "TRANSMITTING ASSET..."
    ];

    for (let i = 0; i < steps.length; i++) {
      toast({ title: `SEQUENCE ${i+1}/4`, description: steps[i] });
      await new Promise(r => setTimeout(r, 1500));
      setProgress((i + 1) * 25);
    }

    setIsMinting(false);
    toast({ 
      title: "TRANSMISSION COMPLETE", 
      description: `Artifact [${mission.missionName}] secured.`,
      variant: "default" 
    });
  };

  return (
    <>
      <TermsGate open={showTerms} onOpenChange={setShowTerms} onAccept={executeMint} />
      
      <div className="relative w-full max-w-md group">
        {/* Decorative holographic glow behind */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 animate-pulse"></div>
        
        <Card className="relative holo-card border-none bg-black/40 text-foreground overflow-hidden">
          
          {/* Holo Frame Overlay */}
          <div className="absolute inset-0 pointer-events-none z-20 opacity-50 mix-blend-screen">
             <img src={holoFrame} alt="" className="w-full h-full object-fill" />
          </div>

          <div className="relative aspect-square overflow-hidden bg-black/50 flex items-center justify-center p-8 border-b border-primary/20">
            <div className="absolute inset-0 bg-[url('/src/assets/texture-metal.png')] opacity-20 mix-blend-overlay"></div>
            
            {/* Rotating reticle effect */}
            <div className="absolute inset-0 border-[1px] border-primary/10 rounded-full scale-75 animate-[spin_10s_linear_infinite]"></div>
            <div className="absolute inset-0 border-[1px] border-primary/10 rounded-full scale-50 animate-[spin_15s_linear_infinite_reverse]"></div>

            <img 
              src={missionPatch} 
              alt="Mission Patch" 
              className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(0,243,255,0.4)] transition-transform duration-700 hover:scale-105 z-10"
            />
            <div className="absolute top-4 right-4 z-20">
               {mission.status === 'live' ? (
                 <Badge variant="outline" className="bg-primary/10 text-primary border-primary animate-pulse font-heading tracking-widest">
                   LIVE FEED
                 </Badge>
               ) : (
                 <Badge variant="outline" className="font-mono text-muted-foreground border-white/10">
                   {mission.status.toUpperCase()}
                 </Badge>
               )}
            </div>
          </div>

          <CardHeader className="space-y-1 pb-4 border-b border-white/5 bg-black/20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  {mission.missionName}
                </h3>
                <p className="text-sm font-mono text-primary/80 flex items-center gap-2">
                  <Cpu className="w-3 h-3" /> {mission.vehicle}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-heading font-bold text-accent drop-shadow-[0_0_5px_rgba(255,0,85,0.8)]">
                  {mission.price} ETH
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono uppercase tracking-widest text-primary/60">
                <span>Supply Status</span>
                <span className="text-primary">{mission.minted} / {mission.supply}</span>
              </div>
              <Progress value={(mission.minted / mission.supply) * 100} className="h-1 bg-white/5 [&>div]:bg-primary [&>div]:shadow-[0_0_10px_currentColor]" />
            </div>

            <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm text-xs leading-relaxed font-mono text-primary/80 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(transparent_50%,rgba(0,243,255,0.05)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
              <p className="line-clamp-3 relative z-10">{mission.description}</p>
            </div>

            {isMinting && (
               <div className="space-y-2">
                 <div className="flex items-center justify-between text-xs font-mono text-accent animate-pulse">
                   <span className="flex items-center gap-2">
                     <Radio className="w-3 h-3 animate-spin" /> UPLOADING TO CHAIN
                   </span>
                   <span>{progress}%</span>
                 </div>
                 <Progress value={progress} className="h-1 bg-white/5 [&>div]:bg-accent" />
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
                   <span className="font-heading font-bold w-8 text-center text-white">{mintCount}</span>
                   <Button 
                     variant="ghost" 
                     size="sm"
                     onClick={() => setMintCount(Math.min(5, mintCount + 1))}
                     disabled={isMinting || mintCount >= 5}
                     className="text-primary hover:text-white hover:bg-primary/20"
                   >+</Button>
                </div>
                <Button 
                  className="w-full text-lg py-7 font-heading font-bold bg-primary hover:bg-primary/80 text-black tracking-wider transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.6)] relative overflow-hidden group" 
                  onClick={handleMintClick}
                  disabled={isMinting || mission.status !== 'live'}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
                  {mission.status !== 'live' ? 'LINK OFFLINE' : 
                    (isMinting ? "PROCESSING..." : `INITIATE MINT`)
                  }
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full text-lg py-7 font-heading font-bold bg-transparent border border-primary text-primary hover:bg-primary hover:text-black transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.4)]" 
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
