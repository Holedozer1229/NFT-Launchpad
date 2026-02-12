import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, GitCommit, GitPullRequest, Eye } from "lucide-react";

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
            Φ = - Σ λₖ log₂ λₖ | Causal density matrix verified.
          </p>
        </CardContent>
      </Card>

      <Card className="sphinx-card bg-black/60 border-primary/20">
        <CardHeader className="py-3 border-b border-primary/10">
          <CardTitle className="font-heading text-xs text-primary/80 flex items-center gap-2">
            <GitCommit className="w-3 h-3" /> Cross-Chain Mining
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 relative h-24 overflow-hidden">
           {/* Mock Visualization */}
           <div className="absolute inset-0 flex items-center justify-around opacity-50">
             <div className="w-1 h-16 bg-primary/20 rounded-full animate-pulse"></div>
             <div className="w-1 h-12 bg-primary/40 rounded-full animate-pulse delay-75"></div>
             <div className="w-1 h-20 bg-primary/60 rounded-full animate-pulse delay-150"></div>
             <div className="w-1 h-14 bg-accent/30 rounded-full animate-pulse delay-100"></div>
             <div className="w-1 h-10 bg-primary/10 rounded-full animate-pulse delay-200"></div>
           </div>
           <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] font-mono text-primary/40">
             <span>wᵢ⁽ᶜ⁾ = (tᵢ⁽ᶜ⁾/Σtⱼ⁽ᶜ⁾)·Φ⁽ᶜ⁾</span>
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
            <span className="text-muted-foreground">ZK-Proof Status</span>
            <span className="text-green-500">ACCEPT</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-muted-foreground">Cross-Chain Φ</span>
            <span className="text-primary">Σ Φ⁽ᶜ⁾</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-muted-foreground">Entropy</span>
            <span className="text-green-500">OPTIMAL</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
