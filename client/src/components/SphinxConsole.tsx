import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, GitCommit, GitPullRequest, Eye, Database } from "lucide-react";

export function SphinxConsole() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <Card className="sphinx-card bg-black/60 border-primary/20">
        <CardHeader className="py-3 border-b border-primary/10">
          <CardTitle className="font-heading text-xs text-primary/80 flex items-center gap-2">
            <Eye className="w-3 h-3" /> Integrated Information (Φ)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-heading font-bold text-primary oracle-glow">0.982</span>
            <span className="text-xs font-mono text-primary/60 mb-1">/ log₂ N</span>
          </div>
          <Progress value={98} className="h-1 bg-primary/10 [&>div]:bg-primary" />
          <p className="mt-2 text-[10px] font-mono text-muted-foreground italic">
            Φ(t) = Σ wᵢ · aᵢ(t) | Active node telemetry verified.
          </p>
        </CardContent>
      </Card>

      <Card className="sphinx-card bg-black/60 border-primary/20">
        <CardHeader className="py-3 border-b border-primary/10">
          <CardTitle className="font-heading text-xs text-primary/80 flex items-center gap-2 uppercase tracking-widest">
            <Database className="w-3 h-3 text-accent" /> Solana Treasury
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="p-2 bg-black/40 border border-primary/10 rounded-sm">
            <div className="text-[9px] font-mono text-primary/40 mb-1 uppercase tracking-tighter">Vault Address</div>
            <div className="text-[10px] font-mono text-white break-all bg-primary/5 p-1 rounded border border-primary/5 select-all">
              6h5M7PrUjy6tJ9gC4FTwGne1y4VJydKk9MELgNgBb5Do
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-primary/60">Asset Reserve</span>
            <span className="text-accent font-bold">4,209.42 SOL</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-primary/60">Treasury Status</span>
            <span className="text-green-500 animate-pulse">SECURED_VAULT</span>
          </div>
        </CardContent>
      </Card>

      <Card className="sphinx-card bg-black/60 border-primary/20">
        <CardHeader className="py-3 border-b border-primary/10">
          <CardTitle className="font-heading text-xs text-primary/80 flex items-center gap-2">
            <GitPullRequest className="w-3 h-3" /> ZK-Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-muted-foreground">Mainnet Status</span>
            <span className="text-green-500">UNIFIED_LIVE</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-muted-foreground">Cross-Chain Φ</span>
            <span className="text-primary">Σ Φ⁽ᶜ⁾</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-muted-foreground">Loot Eff.</span>
            <span className="text-accent">Pₗₒₒₜ(k)·(1+Φ/Φₘₐₓ)</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono border-t border-primary/10 pt-1 mt-1">
            <span className="text-muted-foreground/60">Node Sync</span>
            <span className="text-primary/60 animate-pulse">DH-PROXIMAL</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
