import { useState } from "react";
import { MintCard } from "@/components/MintCard";
import { WalletConnect } from "@/components/WalletConnect";
import { LegalFooter } from "@/components/LegalFooter";
import { LaunchSelector } from "@/components/LaunchSelector";
import { Separator } from "@/components/ui/separator";
import { Cpu, Shield, Globe, Rocket, Terminal, Database } from "lucide-react";
import rocketLaunchHero from "@/assets/rocket-launch.png";
import bgCosmic from "@/assets/bg-cosmic.png";
import { MOCK_LAUNCHES } from "@/lib/mock-web3";

export default function Home() {
  const [selectedLaunch, setSelectedLaunch] = useState(MOCK_LAUNCHES[0]);

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative">
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 z-[-1] bg-black">
        <img src={bgCosmic} alt="" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/80"></div>
        {/* Animated Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,20,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[1] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-primary/10 border border-primary text-primary flex items-center justify-center rounded-sm group-hover:bg-primary group-hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(0,243,255,0.3)]">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-2xl tracking-widest text-white retro-title">MISSIONMINT</span>
              <span className="font-mono text-[10px] text-primary/60 tracking-[0.3em] uppercase">Interstellar Registry</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <a href="/admin" className="text-xs font-mono font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors hidden md:flex items-center gap-2 uppercase">
              <Terminal className="w-3 h-3" /> Mission Control
            </a>
            <WalletConnect />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-40 pb-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Text */}
          <div className="space-y-8 animate-in fade-in slide-in-from-left-10 duration-1000">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-secondary/30 border border-secondary/50 text-secondary-foreground text-xs font-heading font-bold uppercase tracking-widest rounded-sm backdrop-blur-sm">
              <span className="w-2 h-2 bg-secondary-foreground rounded-full animate-pulse shadow-[0_0_10px_currentColor]"></span>
              Secure Frequency Established
            </div>
            
            <h1 className="font-heading text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter text-white drop-shadow-2xl">
              SECURE YOUR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-purple-500 text-glow">
                LEGACY
              </span>
              <br />
              AMONG THE STARS
            </h1>
            
            <p className="text-lg md:text-xl font-mono text-muted-foreground/80 max-w-lg leading-relaxed border-l-2 border-primary/30 pl-6">
              Mint immutable commemorative artifacts from humanity's greatest aerospace achievements. 
              Gothic aesthetics meet blockchain permanence.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 pt-6">
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-sm group-hover:border-primary/50 transition-colors">
                  <Globe className="w-6 h-6 text-primary group-hover:animate-spin-slow" />
                </div>
                <div>
                  <div className="font-heading font-bold text-white text-sm uppercase tracking-wide">Planetary Node</div>
                  <div className="text-[10px] font-mono text-primary/60">Verified On-Chain</div>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-sm group-hover:border-accent/50 transition-colors">
                  <Database className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <div className="font-heading font-bold text-white text-sm uppercase tracking-wide">Void Archive</div>
                  <div className="text-[10px] font-mono text-accent/60">IPFS Immutable</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mint Card & Visuals */}
          <div className="relative flex justify-center lg:justify-end animate-in fade-in zoom-in-95 duration-1000 delay-200">
            
            {/* Visual Effects behind card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-gradient-to-tr from-primary/20 via-purple-500/10 to-transparent blur-3xl opacity-40 pointer-events-none rounded-full animate-pulse"></div>

            {/* Floating spaceship/hero image in background layer */}
            <img 
              src={rocketLaunchHero} 
              alt="" 
              className="absolute -top-32 -right-32 w-full max-w-lg opacity-30 mix-blend-screen pointer-events-none select-none animate-[float_10s_ease-in-out_infinite]"
              style={{ maskImage: 'radial-gradient(circle, black 40%, transparent 80%)' }}
            />

            <MintCard mission={selectedLaunch} />
          </div>
        </div>
      </main>

      {/* Launch Selector Section */}
      <section className="container mx-auto px-4 py-20 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
        
        <div className="mb-12 flex items-end justify-between">
          <div>
            <h2 className="font-heading text-3xl font-bold text-white mb-2 uppercase tracking-wide">Flight Manifest</h2>
            <p className="font-mono text-muted-foreground text-sm">Select target mission for data extraction.</p>
          </div>
          <div className="hidden md:block">
             <div className="flex gap-1">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className={`w-2 h-8 skew-x-12 ${i===4 ? 'bg-primary' : 'bg-white/10'}`}></div>
               ))}
             </div>
          </div>
        </div>
        
        <LaunchSelector 
          launches={MOCK_LAUNCHES} 
          selectedId={selectedLaunch.id} 
          onSelect={setSelectedLaunch} 
        />
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-white/5 bg-black/40 backdrop-blur-sm rounded-sm hover:border-primary/30 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <Cpu className="w-10 h-10 text-primary mb-6 group-hover:drop-shadow-[0_0_10px_currentColor]" />
               <h3 className="font-heading font-bold text-lg mb-3 text-white uppercase tracking-wider">Smart Contract Logic</h3>
               <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                 Every mission patch is a unique ERC721 construct. 
                 Ownership is cryptographically secured by the Ethereum machine spirit.
               </p>
            </div>
            <div className="p-8 border border-white/5 bg-black/40 backdrop-blur-sm rounded-sm hover:border-accent/30 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <Shield className="w-10 h-10 text-accent mb-6 group-hover:drop-shadow-[0_0_10px_currentColor]" />
               <h3 className="font-heading font-bold text-lg mb-3 text-white uppercase tracking-wider">Unofficial Tribute</h3>
               <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                 An artistic homage to the titans of aerospace. 
                 Operating independently of any terrestrial faction or corporate entity.
               </p>
            </div>
             <div className="p-8 border border-white/5 bg-black/40 backdrop-blur-sm rounded-sm hover:border-purple-500/30 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <Database className="w-10 h-10 text-purple-500 mb-6 group-hover:drop-shadow-[0_0_10px_currentColor]" />
               <h3 className="font-heading font-bold text-lg mb-3 text-white uppercase tracking-wider">Immutable History</h3>
               <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                 Metadata includes flight telemetry, vehicle class, and mission outcome. 
                 Permanently etched into the IPFS void.
               </p>
            </div>
        </div>
      </div>

      <LegalFooter />
    </div>
  );
}
