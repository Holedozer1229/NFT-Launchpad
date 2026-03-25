import { AlertTriangle, Gem, ShieldAlert, ExternalLink } from "lucide-react";
import warpDivider from "@/assets/warp-divider.png";

const currentYear = new Date().getFullYear();

export function LegalFooter() {
  return (
    <footer className="relative mt-20 bg-black/80 backdrop-blur-lg border-t border-white/5">
      <img src={warpDivider} className="absolute top-0 left-0 w-full h-1 object-cover opacity-50" />

      <div className="container mx-auto px-4 py-16 grid md:grid-cols-4 gap-12 font-mono text-xs">
        <div className="col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-sm">
              <Gem className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-heading font-bold text-xl tracking-widest text-white uppercase">SKYNT</span>
              <span className="font-mono text-[10px] text-muted-foreground ml-2 tracking-widest">PROTOCOL</span>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed max-w-md">
            An integrated DeFi and NFT ecosystem powered by the IIT Φ-consciousness engine,
            cross-chain bridge infrastructure, and the Genesis BTC hard-fork miner.
            Built for the on-chain frontier.
          </p>

          <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-20">
              <ShieldAlert className="w-12 h-12 text-destructive" />
            </div>
            <p className="text-destructive font-bold mb-1 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Risk Disclosure
            </p>
            <p className="text-destructive/80 leading-relaxed">
              Crypto-assets and NFTs are highly speculative and unregulated. Their value can fall to zero.
              SKYNT Protocol is not a registered investment advisor. Nothing here constitutes financial advice.
              Participate only with funds you can afford to lose entirely.
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-heading text-white font-bold mb-6 tracking-widest uppercase text-sm border-l-2 border-primary pl-3">Protocol</h4>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" /> Terms of Service
            </li>
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" /> Privacy Policy
            </li>
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" /> Smart Contract Audit
            </li>
            <li className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" /> Tokenomics
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading text-white font-bold mb-6 tracking-widest uppercase text-sm border-l-2 border-primary pl-3">Advisories</h4>
          <div className="text-muted-foreground space-y-4 leading-relaxed opacity-70">
            <p>
              SKYNT token (<code className="text-primary/70">0x22d3...2517</code>) is not listed on any regulated exchange.
              Token price is determined solely by market activity.
            </p>
            <p>
              Smart contract interactions are irreversible once confirmed on-chain.
              Always verify contract addresses before transacting.
            </p>
            <p>
              KYC may be required for certain protocol features in accordance with applicable regulations.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 bg-black py-4">
        <div className="container mx-auto px-4 text-center text-[10px] text-muted-foreground/40 font-mono uppercase tracking-[0.2em]">
          SKYNT PROTOCOL // CONTRACT: 0x22d3f06afB69e5FCFAa98C20009510dD11aF2517 // © {currentYear} SKYNT PROTOCOL — ALL RIGHTS RESERVED
        </div>
      </div>
    </footer>
  );
}
