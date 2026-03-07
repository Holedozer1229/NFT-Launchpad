import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/mock-web3";
import { Wallet, ShieldCheck, Loader2, CheckCircle2, AlertCircle, RefreshCw, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export function EmbeddedWallet() {
  const { isConnected, address, balance, connect, disconnect, provider, chainName, error, clearError, refreshBalance } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();
  const { loginWithWallet, user } = useAuth();

  const handleVerify = async () => {
    if (!address || !provider) return;
    setIsVerifying(true);
    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`);
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { nonce } = await nonceRes.json();

      const message = `Sign this message to authenticate with SKYNT Protocol (Contract: 0x22d3f06afB69e5FCFAa98C20009510dD11aF2517)\nNonce: ${nonce}`;

      let signature: string;

      if (provider === "metamask") {
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error("MetaMask provider not available");
        signature = await ethereum.request({
          method: "personal_sign",
          params: [message, address],
        });
      } else if (provider === "phantom") {
        const phantom = (window as any).phantom?.solana;
        if (!phantom) throw new Error("Phantom provider not available");
        const encoded = new TextEncoder().encode(message);
        const signed = await phantom.signMessage(encoded, "utf8");
        const bytes = signed.signature instanceof Uint8Array ? signed.signature : new Uint8Array(signed.signature);
        signature = "0x" + Array.from(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
      } else {
        throw new Error("Unsupported wallet provider");
      }

      await loginWithWallet(address, signature, nonce);
      setIsVerified(true);
      toast({
        title: "IDENTITY_VERIFIED",
        description: "Wallet ownership cryptographically confirmed via SKYNT.",
      });
    } catch (err: any) {
      const msg = err?.message || "Signature denied or verification failed";
      toast({
        title: "Verification Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
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
        <CardContent className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 font-mono text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={clearError} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
            </div>
          )}
          <Button onClick={() => connect()} className="w-full font-heading font-bold py-6 bg-primary text-black hover:bg-primary/80 transition-all">
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
          <Badge variant="outline" className={(isVerified || user) ? "border-green-500 text-green-500" : "border-primary text-primary"}>
            {(isVerified || user) ? "VERIFIED" : "UNVERIFIED"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-black/40 border border-primary/10 rounded-sm space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-primary/60">
            <span className="flex items-center gap-1.5">
              <span>{provider === "phantom" ? "👻" : "🦊"}</span>
              PUBLIC_ADDRESS
            </span>
            <span>{balance.toFixed(4)} {provider === "phantom" ? "SOL" : "ETH"}</span>
          </div>
          <div className="font-mono text-sm text-white break-all">{address}</div>
          {chainName && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/70">
              <Link2 className="w-3 h-3" />
              <span>{chainName}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => refreshBalance()}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono text-muted-foreground hover:text-primary border border-border/30 hover:border-primary/30 rounded-sm transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          REFRESH_BALANCE
        </button>

        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 font-mono text-[10px]">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
          </div>
        )}

        {!isVerified && !user && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-mono text-yellow-500/80">
              <AlertCircle className="w-3 h-3" />
              <span>Sign with your wallet to authenticate and unlock full access.</span>
            </div>
            <Button 
              data-testid="button-sign-verify"
              onClick={handleVerify} 
              disabled={isVerifying}
              className="w-full bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 font-heading"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  SIGNING...
                </>
              ) : "SIGN & AUTHENTICATE"}
            </Button>
          </div>
        )}

        {(isVerified || user) && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-sm text-green-500 font-mono text-xs animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>SESSION_SECURED: AUTHENTICATED{user ? ` as ${user.username}` : ""}</span>
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
