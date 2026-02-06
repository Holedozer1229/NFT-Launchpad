import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWallet, MOCK_COLLECTION_INFO } from "@/lib/mock-web3";
import { Loader2, CheckCircle2, Lock, ExternalLink } from "lucide-react";
import { TermsGate } from "./TermsGate";
import { useToast } from "@/hooks/use-toast";
import nftPreview from "../assets/nft-preview.png";

export function MintCard() {
  const { isConnected, connect } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [mintCount, setMintCount] = useState(1);
  const [showTerms, setShowTerms] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

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
      "Requesting signature...",
      "Broadcasting transaction...",
      "Waiting for confirmation...",
      "Indexing metadata..."
    ];

    for (let i = 0; i < steps.length; i++) {
      toast({ title: "Status Update", description: steps[i] });
      await new Promise(r => setTimeout(r, 1500));
      setProgress((i + 1) * 25);
    }

    setIsMinting(false);
    toast({ 
      title: "Mint Successful!", 
      description: `You successfully minted ${mintCount} token(s).`,
      variant: "default" 
    });
  };

  return (
    <>
      <TermsGate open={showTerms} onOpenChange={setShowTerms} onAccept={executeMint} />
      
      <Card className="w-full max-w-md border-0 shadow-2xl overflow-hidden ring-1 ring-border/50">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img 
            src={nftPreview} 
            alt="Collection Preview" 
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute top-4 right-4">
             <Badge variant="secondary" className="bg-background/80 backdrop-blur text-foreground font-mono border-primary/20">
               <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
               LIVE
             </Badge>
          </div>
        </div>

        <CardHeader className="space-y-1 pb-4">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-heading font-bold">{MOCK_COLLECTION_INFO.name}</h3>
            <span className="text-lg font-mono font-bold text-primary">{MOCK_COLLECTION_INFO.price} ETH</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Compliance verified ERC721 collection. Metadata frozen.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Total Minted</span>
              <span className="font-mono text-foreground">{MOCK_COLLECTION_INFO.minted} / {MOCK_COLLECTION_INFO.supply}</span>
            </div>
            <Progress value={(MOCK_COLLECTION_INFO.minted / MOCK_COLLECTION_INFO.supply) * 100} className="h-2 bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
             <div className="p-3 bg-muted/30 rounded border flex flex-col gap-1">
               <span className="text-muted-foreground uppercase tracking-wider">Contract</span>
               <a href="#" className="font-mono text-primary flex items-center gap-1 hover:underline">
                 {MOCK_COLLECTION_INFO.contractAddress.slice(0, 6)}... <ExternalLink className="w-3 h-3" />
               </a>
             </div>
             <div className="p-3 bg-muted/30 rounded border flex flex-col gap-1">
               <span className="text-muted-foreground uppercase tracking-wider">Royalties</span>
               <span className="font-mono text-foreground">5% (Enforced)</span>
             </div>
          </div>

          {isMinting && (
             <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex items-center justify-between text-xs">
                 <span className="flex items-center gap-2">
                   <Loader2 className="w-3 h-3 animate-spin text-primary" /> Processing Transaction
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
                disabled={isMinting}
              >
                {isMinting ? "Minting..." : `Mint ${mintCount} (${(mintCount * MOCK_COLLECTION_INFO.price).toFixed(2)} ETH)`}
              </Button>
            </div>
          ) : (
            <Button 
              className="w-full text-base py-6 font-semibold" 
              size="lg"
              onClick={connect}
            >
              Connect Wallet to Mint
            </Button>
          )}
        </CardFooter>
      </Card>
    </>
  );
}
