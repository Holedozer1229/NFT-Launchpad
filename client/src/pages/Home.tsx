import { MintCard } from "@/components/MintCard";
import { WalletConnect } from "@/components/WalletConnect";
import { LegalFooter } from "@/components/LegalFooter";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileCode2, Lock, FileCheck } from "lucide-react";
import heroAbstract from "@/assets/hero-abstract.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-grid-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg rounded">L</div>
            <span className="font-heading font-bold text-xl tracking-tight">LegalMint</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block">Admin Dashboard</a>
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
              Verified Compliant Collection
            </div>
            
            <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-balance">
              Digital Ownership, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                Legally Secured.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed text-balance">
              Mint official ERC721 digital collectibles backed by clear legal frameworks. 
              Full commercial rights, transparent provenance, and on-chain verification.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Verified Contract</div>
                  <div className="text-xs">Etherscan Verified</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Secure Metadata</div>
                  <div className="text-xs">IPFS Pinned</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mint Card & Visuals */}
          <div className="relative flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-6 duration-1000 delay-200">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-transparent blur-3xl opacity-50 rounded-full" />
            
            {/* 3D Abstract Element placed decoratively */}
            <img 
              src={heroAbstract} 
              alt="" 
              className="absolute -top-20 -left-20 w-64 h-64 opacity-50 mix-blend-multiply pointer-events-none hidden lg:block"
            />

            <MintCard />
          </div>
        </div>
      </main>

      <div className="container mx-auto px-4 py-12">
        <Separator className="mb-12" />
        <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border rounded-xl bg-card hover:shadow-lg transition-shadow">
               <FileCode2 className="w-8 h-8 text-primary mb-4" />
               <h3 className="font-heading font-bold text-lg mb-2">Code is Law</h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 Our smart contracts are rigorously audited and open-source. 
                 The blockchain is the ultimate source of truth for ownership.
               </p>
            </div>
            <div className="p-6 border rounded-xl bg-card hover:shadow-lg transition-shadow">
               <Lock className="w-8 h-8 text-primary mb-4" />
               <h3 className="font-heading font-bold text-lg mb-2">Rights Reserved</h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 Purchasers receive a clear license for personal and commercial use. 
                 We respect creator rights and enforce on-chain royalties.
               </p>
            </div>
             <div className="p-6 border rounded-xl bg-card hover:shadow-lg transition-shadow">
               <FileCheck className="w-8 h-8 text-primary mb-4" />
               <h3 className="font-heading font-bold text-lg mb-2">Provenance</h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 Full history of every token is preserved forever. 
                 Metadata is decentralized and pinned to IPFS, ensuring longevity.
               </p>
            </div>
        </div>
      </div>

      <LegalFooter />
    </div>
  );
}
