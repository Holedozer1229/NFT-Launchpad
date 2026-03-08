import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Download,
  Copy,
  CheckCircle2,
  Loader2,
  Award,
  Sparkles,
  Lock,
  Eye,
  FileCheck,
  Search,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface Nft {
  id: number;
  title: string;
  rarity: string;
  chain: string;
  tokenId: string;
  owner: string;
  status: string;
  mintDate: string | null;
}

interface RarityCertificate {
  id: number;
  nftId: number;
  userId: number;
  certificateId: string;
  rarityScore: number;
  rarityPercentile: string;
  zkProofHash: string;
  verificationKeyHash: string;
  phiBoost: string;
  fee: string;
  status: string;
  createdAt: string | null;
}

const RARITY_COLORS: Record<string, string> = {
  mythic: "text-amber-300 bg-amber-500/20",
  legendary: "text-neon-orange bg-orange-500/20",
  epic: "text-neon-magenta bg-pink-500/20",
  rare: "text-neon-cyan bg-cyan-500/20",
  uncommon: "text-neon-green bg-green-500/20",
  common: "text-muted-foreground bg-white/10",
};

export default function RarityProofEngine() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generationNftId, setGenerationNftId] = useState<number | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [viewCertificate, setViewCertificate] = useState<RarityCertificate | null>(null);

  const { data: nfts = [], isLoading: nftsLoading } = useQuery<Nft[]>({
    queryKey: ["/api/nfts"],
  });

  const { data: certificates = [], isLoading: certsLoading } = useQuery<
    RarityCertificate[]
  >({
    queryKey: ["/api/rarity-proof/certificates"],
  });

  const generateMutation = useMutation({
    mutationFn: async (nftId: number) => {
      const res = await apiRequest("POST", "/api/rarity-proof/generate", { nftId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rarity-proof/certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      toast({
        title: "Certificate Sealed",
        description: "ZK-proof rarity certificate generated successfully.",
      });
      setViewCertificate(data.certificate || data);
      setGenerationNftId(null);
      setGenerationStep(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
      setGenerationNftId(null);
      setGenerationStep(0);
    },
  });

  const handleGenerate = (nftId: number) => {
    setGenerationNftId(nftId);
    setGenerationStep(1);

    const steps = [1, 2, 3, 4];
    steps.forEach((step, index) => {
      setTimeout(() => {
        setGenerationStep(step);
        if (step === 4) {
          generateMutation.mutate(nftId);
        }
      }, (index + 1) * 800);
    });
  };

  const handleDownload = async (certificateId: string) => {
    try {
      const res = await fetch(`/api/rarity-proof/download/${certificateId}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${certificateId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast({
        title: "Download Failed",
        description: "Could not download the certificate data.",
        variant: "destructive",
      });
    }
  };

  const handleVerify = async (certificateId: string) => {
    try {
      const res = await apiRequest("GET", `/api/rarity-proof/verify/${certificateId}`);
      const data = await res.json();
      if (data.valid) {
        toast({
          title: "Verification Successful",
          description: "ZK-Proof is valid and matches on-chain state.",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: "Proof integrity could not be verified.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Verification Error",
        description: "An error occurred during verification.",
        variant: "destructive",
      });
    }
  };

  const getNftCert = (nftId: number) => {
    return certificates.find((c) => c.nftId === nftId);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-12 max-w-7xl">
      {/* Header */}
      <section className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <ShieldCheck className="w-12 h-12 text-neon-cyan animate-pulse" />
          <h1
            className="text-4xl md:text-6xl font-heading font-black text-white tracking-tighter"
            data-testid="text-page-title"
          >
            NFT RARITY PROOF ENGINE
          </h1>
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-lg font-mono" data-testid="text-subtitle">
            Generate ZK-proof certificates to verify your NFT rarity on-chain
          </p>
          <Badge
            variant="outline"
            className="text-neon-orange border-neon-orange/40 bg-orange-500/10 font-mono py-1 px-3"
            data-testid="badge-fee-notice"
          >
            Certificate fee: 0.5 SKYNT
          </Badge>
        </div>
      </section>

      {/* Your NFTs Panel */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-neon-cyan" />
          <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-wider">
            Your NFTs
          </h2>
        </div>

        {nftsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="cosmic-card h-64 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <Card className="cosmic-card p-12 text-center">
            <p className="text-muted-foreground font-mono">
              No NFTs found in your digital hangar.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {nfts.map((nft) => {
              const cert = getNftCert(nft.id);
              return (
                <Card
                  key={nft.id}
                  className="cosmic-card overflow-hidden hover-elevate group transition-all duration-300 border-white/10"
                  data-testid={`card-nft-${nft.id}`}
                >
                  <CardHeader className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <Badge
                        className={`${
                          RARITY_COLORS[nft.rarity.toLowerCase()] || "bg-white/10"
                        } uppercase text-[10px] font-bold`}
                      >
                        {nft.rarity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono opacity-70">
                        {nft.chain}
                      </Badge>
                    </div>
                    <h3 className="text-white font-heading font-bold text-lg leading-tight">
                      {nft.title}
                    </h3>
                    <p className="text-muted-foreground font-mono text-[10px] truncate">
                      ID: {nft.tokenId}
                    </p>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {cert ? (
                      <Button
                        data-testid={`button-view-cert-${nft.id}`}
                        onClick={() => setViewCertificate(cert)}
                        className="w-full bg-neon-green/20 hover:bg-neon-green/30 text-neon-green border border-neon-green/40 font-heading text-xs tracking-widest h-10"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        VIEW CERTIFICATE
                      </Button>
                    ) : (
                      <Button
                        data-testid={`button-generate-cert-${nft.id}`}
                        onClick={() => handleGenerate(nft.id)}
                        disabled={!!generationNftId}
                        className="w-full bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/40 font-heading text-xs tracking-widest h-10"
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        GENERATE ZK CERT
                        <span className="ml-1 opacity-60 text-[8px]">(0.5 SKYNT)</span>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* My Certificates Panel */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-neon-green" />
          <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-wider">
            Secured Certificates
          </h2>
        </div>

        {certsLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="cosmic-card h-32 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <Card className="cosmic-card p-12 text-center border-dashed border-white/10">
            <p className="text-muted-foreground font-mono">
              No ZK-Certificates issued yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {certificates.map((cert) => {
              const nft = nfts.find((n) => n.id === cert.nftId);
              return (
                <Card
                  key={cert.id}
                  className="cosmic-card p-6 flex flex-col md:flex-row gap-6 items-center border-white/5 hover:border-white/20 transition-colors"
                  data-testid={`card-cert-${cert.id}`}
                >
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-white font-heading font-bold text-lg">
                          {nft?.title || "Unknown NFT"}
                        </h4>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                          Certificate: {cert.certificateId.slice(0, 16)}...
                        </p>
                      </div>
                      <Badge className="bg-neon-green/10 text-neon-green border-neon-green/20 uppercase text-[9px]">
                        {cert.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">RARITY SCORE</span>
                          <span className="text-neon-cyan">{cert.rarityScore}/100</span>
                        </div>
                        <Progress
                          value={cert.rarityScore}
                          className="h-1.5 bg-white/5"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-heading text-muted-foreground uppercase">
                          Percentile
                        </p>
                        <p className="font-mono text-white text-sm">Top {cert.rarityPercentile}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-heading text-muted-foreground uppercase">
                          Φ Boost
                        </p>
                        <p className="font-mono text-neon-orange text-sm">
                          {cert.phiBoost}x
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-heading text-muted-foreground uppercase">
                          ZK Proof Hash
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {cert.zkProofHash}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-white"
                            onClick={() => {
                              navigator.clipboard.writeText(cert.zkProofHash);
                              toast({ description: "Hash copied to clipboard" });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full md:w-auto min-w-[160px]">
                    <Button
                      onClick={() => setViewCertificate(cert)}
                      variant="outline"
                      className="h-9 text-[10px] font-heading tracking-widest w-full"
                    >
                      VIEW FULL
                    </Button>
                    <Button
                      onClick={() => handleDownload(cert.certificateId)}
                      variant="outline"
                      className="h-9 text-[10px] font-heading tracking-widest w-full border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      DOWNLOAD
                    </Button>
                    <Button
                      onClick={() => handleVerify(cert.certificateId)}
                      variant="ghost"
                      className="h-9 text-[10px] font-heading tracking-widest w-full text-muted-foreground hover:text-neon-green"
                    >
                      VERIFY ON-CHAIN
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Generation Pipeline Modal */}
      <Dialog open={!!generationNftId} onOpenChange={() => {}}>
        <DialogContent className="cosmic-card border-neon-cyan/30 bg-black/95 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-white text-center flex flex-col items-center gap-4">
              <ShieldCheck className="w-12 h-12 text-neon-cyan animate-pulse" />
              ZK PROOF PIPELINE
            </DialogTitle>
            <DialogDescription className="text-center font-mono text-muted-foreground text-xs uppercase tracking-widest">
              Initializing cryptographic verification...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-8">
            {[
              { label: "Analyzing Rarity...", icon: Search },
              { label: "Computing ZK Proof...", icon: Lock },
              { label: "Guardian Verification...", icon: Sparkles },
              { label: "Certificate Sealed", icon: CheckCircle2 },
            ].map((step, idx) => {
              const stepNum = idx + 1;
              const isPast = generationStep > stepNum;
              const isActive = generationStep === stepNum;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-4 transition-all duration-300 ${
                    isActive || isPast ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <div
                    className={`p-2 rounded-sm border ${
                      isPast
                        ? "bg-neon-green/20 border-neon-green/40 text-neon-green"
                        : isActive
                        ? "bg-neon-cyan/20 border-neon-cyan/40 text-neon-cyan"
                        : "bg-white/5 border-white/10 text-muted-foreground"
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-heading text-sm uppercase tracking-wide ${
                        isActive ? "text-neon-cyan" : isPast ? "text-neon-green" : "text-white"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isActive && (
                      <Progress value={generationStep * 25} className="h-0.5 mt-2 bg-white/5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Preview Modal */}
      <Dialog open={!!viewCertificate} onOpenChange={(open) => !open && setViewCertificate(null)}>
        <DialogContent className="max-w-3xl bg-[#0a0a0c] border-white/20 p-0 overflow-hidden">
          <div className="relative p-12 space-y-12">
            {/* Background Branding */}
            <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center overflow-hidden">
              <ShieldCheck className="w-[500px] h-[500px] text-white" />
            </div>

            <div className="relative z-10 space-y-12">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-neon-cyan/20 rounded-full flex items-center justify-center border border-neon-cyan/40">
                      <ShieldCheck className="w-4 h-4 text-neon-cyan" />
                    </div>
                    <span className="font-heading font-black text-xl text-white tracking-tighter">
                      SKYNT PROTOCOL
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
                    Cryptographic Proof of Rarity
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">
                    CERTIFICATE ID
                  </p>
                  <p className="text-xs font-mono text-white">
                    {viewCertificate?.certificateId}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mt-2">
                    ISSUE DATE
                  </p>
                  <p className="text-xs font-mono text-white">
                    {viewCertificate?.createdAt ? new Date(viewCertificate.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="border-y border-white/10 py-12 grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] font-heading text-muted-foreground uppercase tracking-widest mb-4">
                      NFT IDENTIFICATION
                    </h5>
                    {(() => {
                      const nft = nfts.find(n => n.id === viewCertificate?.nftId);
                      return (
                        <div className="space-y-3">
                          <p className="text-2xl font-heading font-bold text-white uppercase">
                            {nft?.title || "Digital Asset"}
                          </p>
                          <div className="flex gap-4">
                            <div>
                              <p className="text-[9px] font-mono text-muted-foreground uppercase">
                                CHAIN
                              </p>
                              <p className="text-xs font-mono text-neon-cyan">
                                {nft?.chain}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-mono text-muted-foreground uppercase">
                                TOKEN ID
                              </p>
                              <p className="text-xs font-mono text-white truncate max-w-[120px]">
                                {nft?.tokenId}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <h5 className="text-[10px] font-heading text-muted-foreground uppercase tracking-widest mb-4">
                      RARITY ANALYSIS
                    </h5>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-white/5 rounded-sm border border-white/5">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">
                          SCORE
                        </p>
                        <p className="text-2xl font-mono text-neon-magenta">
                          {viewCertificate?.rarityScore}
                          <span className="text-xs opacity-40 ml-1">/100</span>
                        </p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-sm border border-white/5">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">
                          PERCENTILE
                        </p>
                        <p className="text-2xl font-mono text-neon-orange">
                          {viewCertificate?.rarityPercentile}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] font-heading text-muted-foreground uppercase tracking-widest mb-4">
                      ZK PROOF DETAILS
                    </h5>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">
                          ZK PROOF HASH (SHA-256)
                        </p>
                        <div className="p-3 bg-black/40 border border-white/5 font-mono text-[9px] text-muted-foreground break-all rounded-sm">
                          {viewCertificate?.zkProofHash}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">
                          VERIFICATION KEY
                        </p>
                        <div className="p-3 bg-black/40 border border-white/5 font-mono text-[9px] text-muted-foreground break-all rounded-sm">
                          {viewCertificate?.verificationKeyHash}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          Protocol Boost
                        </span>
                        <span className="text-neon-green font-bold text-sm">
                          {viewCertificate?.phiBoost}x
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-neon-green">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em]">
                      Status: Verified On-Chain
                    </span>
                  </div>
                  <p className="text-[8px] font-mono text-muted-foreground max-w-sm">
                    This document is a mathematically verifiable proof of NFT rarity, generated
                    using zero-knowledge circuits. The integrity of this certificate is
                    guaranteed by the SKYNT Protocol.
                  </p>
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={() => viewCertificate && handleDownload(viewCertificate.certificateId)}
                    className="bg-white text-black hover:bg-white/90 font-heading text-[10px] tracking-widest h-10 px-8"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    DOWNLOAD
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
