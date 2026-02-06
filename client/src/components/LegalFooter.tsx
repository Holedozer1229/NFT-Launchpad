import { AlertTriangle, Scale, ShieldCheck } from "lucide-react";

export function LegalFooter() {
  return (
    <footer className="border-t bg-muted/30 py-12 mt-20">
      <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-heading font-bold text-xl tracking-tight">LegalMint</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
            A compliant launchpad for digital collectibles. 
            All smart contracts verified on Etherscan. 
            Metadata permanently pinned to IPFS. 
            Full commercial rights as defined in the Terms of Sale.
          </p>
        </div>
        
        <div>
          <h4 className="font-heading font-semibold mb-4">Compliance</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Scale className="w-3 h-3" /> Terms of Service
            </li>
            <li className="flex items-center gap-2">
              <Scale className="w-3 h-3" /> Privacy Policy
            </li>
            <li className="flex items-center gap-2">
              <Scale className="w-3 h-3" /> IP Licensing Agreement
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-semibold mb-4">Disclaimers</h4>
          <div className="text-xs text-muted-foreground space-y-2 leading-relaxed opacity-80">
            <p className="flex gap-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>NFTs are speculative assets. Do not spend money you cannot afford to lose.</span>
            </p>
            <p>
              This interface is not a broker, financial institution, or creditor. 
              The platform facilitates interaction with the Ethereum blockchain.
            </p>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 pt-8 border-t text-center text-xs text-muted-foreground/50 font-mono uppercase tracking-widest">
        © 2024 LegalMint Framework. All Rights Reserved.
      </div>
    </footer>
  );
}
