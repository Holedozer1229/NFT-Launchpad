import { AlertTriangle, Rocket, ShieldCheck } from "lucide-react";

export function LegalFooter() {
  return (
    <footer className="border-t bg-muted/30 py-12 mt-20">
      <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-6 h-6 text-primary" />
            <span className="font-heading font-bold text-xl tracking-tight">MissionMint</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
            The premier platform for commemorative mission patches and launch collectibles. 
            Preserving aerospace history on the blockchain.
          </p>
          <div className="mt-6 p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
             <p className="text-xs text-yellow-600/90 font-medium flex items-start gap-2">
               <AlertTriangle className="w-4 h-4 shrink-0" />
               <span>
                 <strong>Non-Affiliation Disclaimer:</strong> This project is an independent commemorative art collection. 
                 It is NOT affiliated with, endorsed by, or connected to SpaceX, NASA, Blue Origin, ULA, or any other government or private aerospace entity. 
                 All mission names and vehicle designations are used for factual descriptive purposes only.
               </span>
             </p>
          </div>
        </div>
        
        <div>
          <h4 className="font-heading font-semibold mb-4">Mission Control</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Terms of Mission
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Privacy Policy
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Collector Rights
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-semibold mb-4">Flight Safety</h4>
          <div className="text-xs text-muted-foreground space-y-2 leading-relaxed opacity-80">
            <p>
              NFTs are speculative collectibles. No guarantees of future value are made.
            </p>
            <p>
              Mission outcomes (Success/Failure) in metadata are historical records and do not affect token ownership rights.
            </p>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 pt-8 border-t text-center text-xs text-muted-foreground/50 font-mono uppercase tracking-widest">
        © 2024 MissionMint Commemorative. All Rights Reserved.
      </div>
    </footer>
  );
}
