import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/mock-web3";
import { Wallet, ShieldCheck, Loader2, CheckCircle2, AlertCircle, RefreshCw, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

function ConnectionPulse({ provider }: { provider: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = w / 4;
    const ch = h / 4;

    const color = provider === "phantom" ? [171, 159, 242] : [226, 118, 27];
    let frame = 0;
    const totalFrames = 60;
    let raf: number;

    const draw = () => {
      frame++;
      if (frame > totalFrames) return;
      ctx.clearRect(0, 0, w, h);

      const progress = frame / totalFrames;
      const rings = 3;
      for (let i = 0; i < rings; i++) {
        const delay = i * 0.15;
        const t = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
        if (t <= 0) continue;
        const ease = 1 - Math.pow(1 - t, 3);
        const radius = ease * Math.max(cw, ch) * 1.2;
        const alpha = (1 - ease) * 0.4;
        ctx.beginPath();
        ctx.arc(cw, ch, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
        ctx.lineWidth = 2 - ease * 1.5;
        ctx.stroke();
      }

      const dotAlpha = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
      ctx.beginPath();
      ctx.arc(cw, ch, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${dotAlpha * 0.8})`;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [provider]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
}

export function EmbeddedWallet() {
  const { isConnected, address, balance, connect, disconnect, provider, chainName, error, clearError, refreshBalance, getEthereumProvider, getActivePhantomProvider } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showConnectAnim, setShowConnectAnim] = useState(false);
  const prevConnected = useRef(false);
  const { toast } = useToast();
  const { loginWithWallet, user } = useAuth();

  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      setShowConnectAnim(true);
      const timer = setTimeout(() => setShowConnectAnim(false), 1800);
      return () => clearTimeout(timer);
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

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
        const ethereum = getEthereumProvider();
        if (!ethereum) throw new Error("MetaMask provider not available. Make sure the MetaMask extension or app is active.");
        signature = await ethereum.request({
          method: "personal_sign",
          params: [message, address],
        });
      } else if (provider === "phantom") {
        const phantom = getActivePhantomProvider();
        if (!phantom) throw new Error("Phantom provider not available. Make sure the Phantom extension or app is active.");
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

  const glowColor = provider === "phantom" ? "rgba(171,159,242," : "rgba(226,118,27,";

  return (
    <Card
      className={`sphinx-card bg-black/60 backdrop-blur-xl relative overflow-hidden transition-all duration-700 ${
        showConnectAnim
          ? "border-primary/60 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]"
          : "border-primary/20"
      }`}
      style={showConnectAnim ? {
        boxShadow: `0 0 24px ${glowColor}0.25), 0 0 48px ${glowColor}0.1)`,
      } : undefined}
      data-testid="card-wallet-connected"
    >
      {showConnectAnim && <ConnectionPulse provider={provider} />}

      <CardHeader className="pb-4 relative z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 transition-colors duration-500 ${isVerified ? 'text-green-500' : showConnectAnim ? 'text-white' : 'text-primary'}`} />
            <CardTitle className={`font-heading text-lg transition-colors duration-500 ${showConnectAnim ? 'text-white' : 'text-primary'}`}>
              {showConnectAnim ? "LINKED" : "IDENTITY_NODE"}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`transition-all duration-500 ${
              (isVerified || user)
                ? "border-green-500 text-green-500"
                : showConnectAnim
                  ? "border-white/60 text-white animate-pulse"
                  : "border-primary text-primary"
            }`}
          >
            {showConnectAnim ? "CONNECTED" : (isVerified || user) ? "VERIFIED" : "UNVERIFIED"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        <div className={`p-3 bg-black/40 border rounded-sm space-y-2 transition-all duration-700 ${
          showConnectAnim ? "border-primary/40" : "border-primary/10"
        }`}>
          <div className="flex justify-between text-[10px] font-mono text-primary/60">
            <span className="flex items-center gap-1.5">
              <span className={showConnectAnim ? "animate-bounce" : ""}>{provider === "phantom" ? "👻" : "🦊"}</span>
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
