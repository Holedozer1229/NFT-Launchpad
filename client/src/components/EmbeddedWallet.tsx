import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/mock-web3";
import { Wallet, ShieldCheck, Key, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function EmbeddedWallet() {
  const { isConnected, address, balance, connect, disconnect } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [signature, setSignature] = useState("");
  const { toast } = useToast();

  const handleVerify = async () => {
    setIsVerifying(true);
    // Simulate cryptographic verification
    await new Promise(r => setTimeout(r, 2000));
    setIsVerified(true);
    setIsVerifying(false);
    toast({
      title: "IDENTITY_VERIFIED",
      description: "Wallet ownership cryptographically confirmed via SphinxOS.",
    });
  };

  if (!isConnected) {
    return (
      <Card className="sphinx-card bg-black/60 border-primary/20 backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="font-heading text-xl text-primary">SECURE_GATEWAY</CardTitle>
          <CardDescription className="font-mono text-xs">Initialize wallet link to access the Causal Graph</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connect} className="w-full font-heading font-bold py-6 bg-primary text-black hover:bg-primary/80 transition-all">
            CONNECT_IDENTITY
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sphinx-card bg-black/60 border-primary/20 backdrop-blur-xl">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${isVerified ? 'text-green-500' : 'text-primary'}`} />
            <CardTitle className="font-heading text-lg text-primary">IDENTITY_NODE</CardTitle>
          </div>
          <Badge variant="outline" className={isVerified ? "border-green-500 text-green-500" : "border-primary text-primary"}>
            {isVerified ? "VERIFIED" : "UNVERIFIED"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-black/40 border border-primary/10 rounded-sm space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-primary/60">
            <span>PUBLIC_ADDRESS</span>
            <span>{balance} ETH</span>
          </div>
          <div className="font-mono text-sm text-white break-all">{address}</div>
        </div>

        {!isVerified && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-mono text-yellow-500/80">
              <AlertCircle className="w-3 h-3" />
              <span>Cryptographic challenge required for full access.</span>
            </div>
            <Input 
              placeholder="Enter challenge nonce..." 
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="bg-black/40 border-primary/20 text-primary font-mono text-xs"
            />
            <Button 
              onClick={handleVerify} 
              disabled={isVerifying || !signature}
              className="w-full bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 font-heading"
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "VERIFY_SITE_OWNERSHIP"}
            </Button>
          </div>
        )}

        {isVerified && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-sm text-green-500 font-mono text-xs animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>SESSION_SECURED: TEMPORAL_REVERTS_DISABLED</span>
          </div>
        )}

        <Button 
          variant="ghost" 
          onClick={disconnect} 
          className="w-full text-xs font-mono text-destructive hover:text-destructive/80 hover:bg-destructive/10"
        >
          DISCONNECT_TERMINAL
        </Button>
      </CardContent>
    </Card>
  );
}
