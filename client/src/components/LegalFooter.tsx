import { AlertTriangle, Rocket, ShieldAlert, BookOpen } from "lucide-react";
import warpDivider from "@/assets/warp-divider.png";

export function LegalFooter() {
  return (
    <footer className="relative mt-20 bg-black/80 backdrop-blur-lg border-t border-white/5">
      <img src={warpDivider} className="absolute top-0 left-0 w-full h-1 object-cover opacity-50" />
      
      <div className="container mx-auto px-4 py-16 grid md:grid-cols-4 gap-12 font-mono text-xs">
        <div className="col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-sm">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <span className="font-heading font-bold text-xl tracking-widest text-white uppercase">MissionMint</span>
          </div>
          <p className="text-muted-foreground leading-relaxed max-w-md">
            GALACTIC REGISTRY NODE 7. 
            Archiving human aerospace achievements on the immutable ledger. 
            Honoring the explorers of the void.
          </p>
          
          <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-1 opacity-20">
               <ShieldAlert className="w-12 h-12 text-destructive" />
             </div>
             <p className="text-destructive font-bold mb-1 uppercase tracking-wider flex items-center gap-2">
               <AlertTriangle className="w-3 h-3" /> Non-Affiliation Protocol
             </p>
             <p className="text-destructive/80 leading-relaxed">
               This database is an independent artistic tribute. It is NOT affiliated with SpaceX, NASA, or any terrestrial launch provider. 
               All designations are used for historical cataloging only.
             </p>
          </div>
        </div>
        
        <div>
          <h4 className="font-heading text-white font-bold mb-6 tracking-widest uppercase text-sm border-l-2 border-primary pl-3">Protocols</h4>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <BookOpen className="w-3 h-3" /> Terms of Engagement
            </li>
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <BookOpen className="w-3 h-3" /> Data Privacy Codex
            </li>
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <BookOpen className="w-3 h-3" /> Ownership Rights
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading text-white font-bold mb-6 tracking-widest uppercase text-sm border-l-2 border-primary pl-3">Advisories</h4>
          <div className="text-muted-foreground space-y-4 leading-relaxed opacity-70">
            <p>
              WARNING: Crypto-assets are unregulated and volatile. Capital at risk.
            </p>
            <p>
              Historical data is finalized at block confirmation. 
              No temporal reverts possible.
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 bg-black py-4">
        <div className="container mx-auto px-4 text-center text-[10px] text-muted-foreground/40 font-mono uppercase tracking-[0.2em]">
          SYSTEM ID: MM-2024-X // TRANSMISSION END // © MISSIONMINT
        </div>
      </div>
    </footer>
  );
}
