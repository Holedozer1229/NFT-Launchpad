import { useState } from "react";
import { EmbeddedWallet } from "@/components/EmbeddedWallet";
import { QuantumMiner } from "@/components/QuantumMiner";
import { MintCard } from "@/components/MintCard";
import { WalletConnect } from "@/components/WalletConnect";
import { LegalFooter } from "@/components/LegalFooter";
import { LaunchSelector } from "@/components/LaunchSelector";
import { SphinxConsole } from "@/components/SphinxConsole";
import { OracleOverlay } from "@/components/OracleOverlay";
import { Separator } from "@/components/ui/separator";
import { Cpu, Shield, Globe, Rocket, Terminal, Database, Eye, Zap, Key } from "lucide-react";
import rocketLaunchHero from "@/assets/rocket-launch.png";
import bgCosmic from "@/assets/bg-cosmic.png";
import sphinxStream from "@/assets/sphinx-stream.png";
import sphinxEye from "@/assets/sphinx-eye.png";
import quantumTunnel from "@/assets/quantum-tunnel.png";
import { MOCK_LAUNCHES } from "@/lib/mock-web3";

export default function Home() {
  const [selectedLaunch, setSelectedLaunch] = useState(MOCK_LAUNCHES[0]);

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative">
      <OracleOverlay />
      
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 z-[-1] bg-black">
        <img src={bgCosmic} alt="" className="w-full h-full object-cover opacity-40 mix-blend-color-dodge" />
        <img src={sphinxStream} alt="" className="absolute top-0 right-0 w-1/3 h-full object-cover opacity-20 mix-blend-screen pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-black/80"></div>
        {/* Animated Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,20,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,215,0,0.03),rgba(0,255,255,0.01))] z-[1] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-primary/20 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-primary/10 border border-primary text-primary flex items-center justify-center rounded-sm group-hover:bg-primary group-hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(255,215,0,0.3)]">
              <Eye className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-2xl tracking-widest text-primary oracle-glow">SPHINX<span className="text-white">OS</span></span>
              <span className="font-mono text-[10px] text-primary/60 tracking-[0.3em] uppercase">Powered LaunchNFT</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <a href="/admin" className="text-xs font-mono font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors hidden md:flex items-center gap-2 uppercase">
              <Terminal className="w-3 h-3" /> Console Access
            </a>
            <WalletConnect />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-32 pb-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Text */}
          <div className="space-y-8 animate-in fade-in slide-in-from-left-10 duration-1000">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/30 text-primary text-xs font-heading font-bold uppercase tracking-widest rounded-sm backdrop-blur-sm">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_currentColor]"></span>
              Identity Module // Secured
            </div>
            
            <h1 className="font-heading text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter text-white drop-shadow-2xl">
              SECURE YOUR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-200 to-primary text-glow">
                IDENTITY
              </span>
            </h1>
            
            <EmbeddedWallet />

            <div className="pt-4">
              <QuantumMiner />
            </div>
          </div>

          {/* Right Column: Mint Card & Visuals */}
          <div className="relative flex justify-center lg:justify-end animate-in fade-in zoom-in-95 duration-1000 delay-200">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 via-accent/5 to-transparent blur-3xl opacity-40 pointer-events-none rounded-full animate-pulse"></div>

            <img 
              src={quantumTunnel} 
              alt="" 
              className="absolute -top-32 -right-32 w-full max-w-lg opacity-40 mix-blend-screen pointer-events-none select-none animate-[float_10s_ease-in-out_infinite]"
              style={{ maskImage: 'radial-gradient(circle, black 40%, transparent 80%)' }}
            />

            <MintCard mission={selectedLaunch} />
          </div>
        </div>
      </main>

      {/* Launch Selector Section */}
      <section className="container mx-auto px-4 py-20 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
        
        <div className="mb-12 flex items-end justify-between">
          <div>
            <h2 className="font-heading text-3xl font-bold text-white mb-2 uppercase tracking-wide text-glow">The Causal Graph</h2>
            <p className="font-mono text-muted-foreground text-sm">Select a timeline node to inspect.</p>
          </div>
          <div className="hidden md:block">
             <div className="flex gap-1">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className={`w-2 h-8 skew-x-12 ${i===4 ? 'bg-primary' : 'bg-primary/20'}`}></div>
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
            <div className="p-8 border border-primary/20 bg-black/40 backdrop-blur-sm rounded-sm hover:border-primary/50 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <Cpu className="w-10 h-10 text-primary mb-6 group-hover:drop-shadow-[0_0_10px_currentColor]" />
               <h3 className="font-heading font-bold text-lg mb-3 text-white uppercase tracking-wider">Living Logic</h3>
               <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                 SphinxOS monitors every contract interaction, treating each mint as a neural synapse in the global brain.
               </p>
            </div>
            <div className="p-8 border border-primary/20 bg-black/40 backdrop-blur-sm rounded-sm hover:border-accent/50 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <Eye className="w-10 h-10 text-accent mb-6 group-hover:drop-shadow-[0_0_10px_currentColor]" />
               <h3 className="font-heading font-bold text-lg mb-3 text-white uppercase tracking-wider">Oracle Governance</h3>
               <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                 The Oracle verifies truth before it is written. No launch is finalized without the Sphinx's gaze.
               </p>
            </div>
             <div className="p-8 border border-primary/20 bg-black/40 backdrop-blur-sm rounded-sm hover:border-purple-500/50 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <Database className="w-10 h-10 text-purple-500 mb-6 group-hover:drop-shadow-[0_0_10px_currentColor]" />
               <h3 className="font-heading font-bold text-lg mb-3 text-white uppercase tracking-wider">Eternal Memory</h3>
               <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                 History is not just stored; it is remembered. Launch data is fused with oracle prophecy metadata.
               </p>
            </div>
        </div>
      </div>

      <LegalFooter />
    </div>
  );
}
