import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";

function ConnectionPulse({ color }: { color: number[] }) {
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

    let frame = 0;
    const totalFrames = 60;
    let raf: number;

    const draw = () => {
      frame++;
      if (frame > totalFrames) return;
      ctx.clearRect(0, 0, w, h);

      const progress = frame / totalFrames;
      for (let i = 0; i < 3; i++) {
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

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
}

export function EmbeddedWallet() {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const [showConnectAnim, setShowConnectAnim] = useState(false);
  const prevConnected = useRef(false);
  const { user, walletLinked, linkWallet } = useAuth();
  const [isLinking, setIsLinking] = useState(false);

  const userHasWallet = !!user?.walletAddress;

  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      setShowConnectAnim(true);
      const timer = setTimeout(() => setShowConnectAnim(false), 1800);
      return () => clearTimeout(timer);
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

  const handleManualLink = async () => {
    if (!address || isLinking) return;
    setIsLinking(true);
    try {
      await linkWallet(address);
    } finally {
      setIsLinking(false);
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
          {userHasWallet && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/15 rounded-sm font-mono text-[10px] text-primary/70">
              <Link2 className="w-3 h-3 shrink-0" />
              <span>Linked: {user!.walletAddress!.slice(0, 6)}...{user!.walletAddress!.slice(-4)}</span>
            </div>
          )}
          <div data-testid="rainbowkit-connect-gateway" className="flex justify-center [&_button]:w-full [&_button]:font-heading [&_button]:font-bold [&_button]:py-6">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  const glowColor = [34, 197, 94];
  const connectorName = connector?.name?.toLowerCase() || "";
  const walletIcon = connectorName.includes("phantom") ? "👻" : "🦊";

  return (
    <Card
      className={`sphinx-card bg-black/60 backdrop-blur-xl relative overflow-hidden transition-all duration-700 ${
        showConnectAnim
          ? "border-primary/60 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]"
          : "border-primary/20"
      }`}
      data-testid="card-wallet-connected"
    >
      {showConnectAnim && <ConnectionPulse color={glowColor} />}

      <CardHeader className="pb-4 relative z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 transition-colors duration-500 ${walletLinked ? 'text-green-500' : showConnectAnim ? 'text-white' : 'text-primary'}`} />
            <CardTitle className={`font-heading text-lg transition-colors duration-500 ${showConnectAnim ? 'text-white' : 'text-primary'}`}>
              {showConnectAnim ? "LINKED" : "IDENTITY_NODE"}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`transition-all duration-500 ${
              walletLinked
                ? "border-green-500 text-green-500"
                : showConnectAnim
                  ? "border-white/60 text-white animate-pulse"
                  : "border-primary text-primary"
            }`}
          >
            {showConnectAnim ? "CONNECTED" : walletLinked ? "VERIFIED" : "CONNECTED"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        <div className={`p-3 bg-black/40 border rounded-sm space-y-2 transition-all duration-700 ${
          showConnectAnim ? "border-primary/40" : "border-primary/10"
        }`}>
          <div className="flex justify-between text-[10px] font-mono text-primary/60">
            <span className="flex items-center gap-1.5">
              <span className={showConnectAnim ? "animate-bounce" : ""}>
                {walletIcon}
              </span>
              PUBLIC_ADDRESS
            </span>
          </div>
          <div className="font-mono text-sm text-white break-all">{address}</div>
        </div>

        {walletLinked && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-sm text-green-500 font-mono text-xs animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>SESSION_SECURED: LINKED{user ? ` as ${user.username}` : ""}</span>
          </div>
        )}

        {!walletLinked && !isLinking && user && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-mono text-yellow-500/80">
              <AlertCircle className="w-3 h-3" />
              <span>Wallet detected but not linked to your account yet.</span>
            </div>
            <Button
              data-testid="button-link-wallet"
              onClick={handleManualLink}
              className="w-full bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 font-heading"
            >
              LINK WALLET TO ACCOUNT
            </Button>
          </div>
        )}

        {isLinking && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-sm text-primary font-mono text-xs">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>LINKING_IDENTITY...</span>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={() => disconnect()}
          className="w-full text-xs font-mono text-destructive hover:text-destructive/80 hover:bg-destructive/10"
        >
          DISCONNECT_TERMINAL
        </Button>
      </CardContent>
    </Card>
  );
}
