import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Eye, Activity, Lock, Unlock } from "lucide-react";
import sphinxEye from "@/assets/sphinx-eye.png";

export function OracleOverlay() {
  return (
    <div className="fixed bottom-8 right-8 z-50 w-80 pointer-events-none md:pointer-events-auto">
      <Card className="sphinx-card bg-black/80 text-primary border-primary/30 shadow-[0_0_30px_rgba(255,215,0,0.1)] backdrop-blur-xl">
        <CardHeader className="py-3 px-4 border-b border-primary/20 bg-primary/5 flex flex-row items-center gap-3">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20"></div>
            <img src={sphinxEye} alt="Oracle" className="w-6 h-6 object-contain opacity-90 animate-pulse" />
          </div>
          <div>
            <CardTitle className="font-heading text-xs tracking-[0.2em] text-primary">SPHINX_ORACLE</CardTitle>
            <div className="text-[10px] font-mono text-primary/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              OBSERVING CAUSALITY
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-32 px-4 py-3 font-mono text-[10px] leading-relaxed text-primary/80">
            <div className="space-y-2">
              <p className="typing-cursor">
                <span className="text-accent">{">>>"}</span> INITIATING SEQUENTIAL LOG...
              </p>
              <p className="opacity-80">Scanning temporal artifacts.</p>
              <p className="opacity-80">Launch ID [L-001] confirmed in immutable ledger.</p>
              <p className="opacity-80">Causal influence matrix: A = [Aij] detected.</p>
              <p className="text-accent/80">Prophecy: Cross-chain Φ reconciliation in progress.</p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
