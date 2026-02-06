import { useState } from "react";
import { MintCard } from "@/components/MintCard";
import { WalletConnect } from "@/components/WalletConnect";
import { LegalFooter } from "@/components/LegalFooter";
import { LaunchSelector } from "@/components/LaunchSelector";
import { Separator } from "@/components/ui/separator";
import { FileCode2, Lock, FileCheck, Rocket, Globe, Database } from "lucide-react";
import rocketLaunchHero from "@/assets/rocket-launch.png";
import { MOCK_LAUNCHES } from "@/lib/mock-web3";

export default function Home() {
  const [selectedLaunch, setSelectedLaunch] = useState(MOCK_LAUNCHES[0]);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg rounded-full">
              <Rocket className="w-4 h-4" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">MissionMint</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block">Mission Control</a>
            <WalletConnect />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Text */}
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wide">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              Official Commemorative Manifest
            </div>
            
            <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-balance">
              Own a Piece of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                Launch History.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed text-balance">
              Mint limited edition digital mission patches linked to historic aerospace events. 
              Immutable provenance for the new space age.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Global Registry</div>
                  <div className="text-xs">On-Chain Verified</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Flight Data</div>
                  <div className="text-xs">IPFS Archived</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mint Card & Visuals */}
          <div className="relative flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-6 duration-1000 delay-200">
            <div className="absolute -inset-4 bg-gradient-to-tr from-orange-500/20 to-transparent blur-3xl opacity-50 rounded-full" />
            
            {/* 3D Abstract Element placed decoratively */}
            <img 
              src={rocketLaunchHero} 
              alt="" 
              className="absolute -top-20 -left-20 w-80 h-auto opacity-80 mix-blend-lighten pointer-events-none hidden lg:block rounded-2xl mask-image-gradient"
              style={{ maskImage: 'linear-gradient(to bottom, black, transparent)' }}
            />

            <MintCard mission={selectedLaunch} />
          </div>
        </div>
      </main>

      {/* Launch Selector Section */}
      <section className="container mx-auto px-4 py-12 bg-muted/5 rounded-3xl border border-border/50">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-bold">Select Mission Profile</h2>
          <p className="text-muted-foreground">Choose a launch manifest to mint its commemorative patch.</p>
        </div>
        <LaunchSelector 
          launches={MOCK_LAUNCHES} 
          selectedId={selectedLaunch.id} 
          onSelect={setSelectedLaunch} 
        />
      </section>

      <div className="container mx-auto px-4 py-12">
        <Separator className="mb-12" />
        <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border rounded-xl bg-card hover:shadow-lg transition-shadow">
               <FileCode2 className="w-8 h-8 text-primary mb-4" />
               <h3 className="font-heading font-bold text-lg mb-2">Smart Contract Manifest</h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 Every mission patch is a unique ERC721 token. 
                 Ownership is secured by the Ethereum blockchain.
               </p>
            </div>
            <div className="p-6 border rounded-xl bg-card hover:shadow-lg transition-shadow">
               <Lock className="w-8 h-8 text-primary mb-4" />
               <h3 className="font-heading font-bold text-lg mb-2">Independent Commemoration</h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 An artistic tribute to aerospace engineering. 
                 Not affiliated with any government agency or private launch provider.
               </p>
            </div>
             <div className="p-6 border rounded-xl bg-card hover:shadow-lg transition-shadow">
               <FileCheck className="w-8 h-8 text-primary mb-4" />
               <h3 className="font-heading font-bold text-lg mb-2">Historical Provenance</h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 Metadata includes flight date, vehicle type, and mission outcome. 
                 Permanently archived on IPFS.
               </p>
            </div>
        </div>
      </div>

      <LegalFooter />
    </div>
  );
}
