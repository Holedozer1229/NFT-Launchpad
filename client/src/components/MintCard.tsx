import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWallet, LaunchMission } from "@/lib/mock-web3";
import { Loader2, CheckCircle2, Lock, ExternalLink, Rocket } from "lucide-react";
import { TermsGate } from "./TermsGate";
import { useToast } from "@/hooks/use-toast";
import missionPatch from "../assets/mission-patch.png";

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

  // Reset local state when mission changes
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

    // Mock transaction steps
    const steps = [
      "Initiating countdown...",
      "Main engine start...",
      "Liftoff detected...",
      "Orbit achieved (Indexing)..."
    ];

    for (let i = 0; i < steps.length; i++) {
      toast({ title: `T-Minus ${4-i}`, description: steps[i] });
      await new Promise(r => setTimeout(r, 1500));
      setProgress((i + 1) * 25);
    }

    setIsMinting(false);
    toast({ 
      title: "Mission Successful!", 
      description: `You secured ${mintCount} mission patch(es) for ${mission.missionName}.`,
      variant: "default" 
    });
  };

  return (
    <>
      <TermsGate open={showTerms} onOpenChange={setShowTerms} onAccept={executeMint} />
      
      <Card className="w-full max-w-md border-0 shadow-2xl overflow-hidden ring-1 ring-border/50 bg-card/50 backdrop-blur-sm">
        <div className="relative aspect-square overflow-hidden bg-muted flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
          <img 
            src={missionPatch} 
            alt="Mission Patch" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute top-4 right-4">
             {mission.status === 'live' ? (
               <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 font-mono">
                 <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                 LIFTOFF
               </Badge>
             ) : (
               <Badge variant="outline" className="font-mono text-muted-foreground">
                 {mission.status.toUpperCase()}
               </Badge>
             )}
          </div>
        </div>

        <CardHeader className="space-y-1 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-heading font-bold">{mission.missionName}</h3>
              <p className="text-sm font-mono text-muted-foreground">{mission.vehicle}</p>
            </div>
            <span className="text-lg font-mono font-bold text-primary">{mission.price} ETH</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Mission Supply</span>
              <span className="font-mono text-foreground">{mission.minted} / {mission.supply}</span>
            </div>
            <Progress value={(mission.minted / mission.supply) * 100} className="h-2 bg-muted" />
          </div>

          <div className="p-3 bg-muted/30 rounded border text-xs leading-relaxed">
            <p className="text-muted-foreground line-clamp-3">{mission.description}</p>
          </div>

          {isMinting && (
             <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex items-center justify-between text-xs">
                 <span className="flex items-center gap-2">
                   <Rocket className="w-3 h-3 animate-bounce text-primary" /> Launch Sequence
                 </span>
                 <span>{progress}%</span>
               </div>
               <Progress value={progress} className="h-1" />
             </div>
          )}
        </CardContent>

        <CardFooter className="pt-2">
          {isConnected ? (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between gap-4 p-1 border rounded-lg bg-muted/20">
                 <Button 
                   variant="ghost" 
                   size="sm"
                   onClick={() => setMintCount(Math.max(1, mintCount - 1))}
                   disabled={isMinting || mintCount <= 1}
                 >-</Button>
                 <span className="font-mono font-bold w-8 text-center">{mintCount}</span>
                 <Button 
                   variant="ghost" 
                   size="sm"
                   onClick={() => setMintCount(Math.min(5, mintCount + 1))}
                   disabled={isMinting || mintCount >= 5}
                 >+</Button>
              </div>
              <Button 
                className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/20" 
                size="lg"
                onClick={handleMintClick}
                disabled={isMinting || mission.status !== 'live'}
              >
                {mission.status !== 'live' ? 'Mission Not Active' : 
                  (isMinting ? "Ignition Sequence..." : `Mint Patch (${(mintCount * mission.price).toFixed(2)} ETH)`)
                }
              </Button>
            </div>
          ) : (
            <Button 
              className="w-full text-base py-6 font-semibold" 
              size="lg"
              onClick={connect}
            >
              Connect Wallet to Join Mission
            </Button>
          )}
        </CardFooter>
      </Card>
    </>
  );
}
