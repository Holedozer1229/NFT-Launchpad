import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Rocket, Upload, Sparkles, Image, ShieldCheck, Crown,
  Star, Flame, X, Check, ChevronDown, RefreshCw, Coins,
  Lock, AlertTriangle, Zap, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NEON = {
  pink: "#ff2d78",
  magenta: "#ff00ff",
  cyan: "#00f3ff",
  gold: "#ffd700",
  green: "#39ff14",
  orange: "#ff6a00",
  violet: "#b44dff",
};

const COSMIC_TEMPLATES = [
  {
    id: "nebula-queen",
    name: "Nebula Queen",
    overlay: "radial-gradient(ellipse at 50% 30%, rgba(255,0,180,0.35) 0%, rgba(120,0,255,0.2) 40%, transparent 70%)",
    border: NEON.pink,
    badge: "COSMIC",
    desc: "Ethereal nebula halo with stardust particles",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    overlay: "radial-gradient(circle at 50% 60%, rgba(255,165,0,0.4) 0%, rgba(255,69,0,0.2) 35%, transparent 65%)",
    border: NEON.orange,
    badge: "FIRE",
    desc: "Solar corona burst with plasma ribbons",
  },
  {
    id: "aurora-empress",
    name: "Aurora Empress",
    overlay: "linear-gradient(135deg, rgba(0,255,128,0.25) 0%, rgba(0,200,255,0.25) 50%, rgba(180,0,255,0.2) 100%)",
    border: NEON.green,
    badge: "AURORA",
    desc: "Northern lights cascade with crystalline edges",
  },
  {
    id: "void-siren",
    name: "Void Siren",
    overlay: "radial-gradient(ellipse at 50% 50%, rgba(100,0,200,0.35) 0%, rgba(30,0,80,0.3) 50%, rgba(0,0,0,0.5) 80%)",
    border: NEON.violet,
    badge: "VOID",
    desc: "Dark matter aura with quantum particle trails",
  },
  {
    id: "supernova-diva",
    name: "Supernova Diva",
    overlay: "radial-gradient(circle at 50% 40%, rgba(255,215,0,0.45) 0%, rgba(255,100,0,0.2) 40%, transparent 70%)",
    border: NEON.gold,
    badge: "LEGENDARY",
    desc: "Explosive stellar collapse with golden shockwave",
  },
  {
    id: "cryo-angel",
    name: "Cryo Angel",
    overlay: "radial-gradient(ellipse at 50% 30%, rgba(0,200,255,0.4) 0%, rgba(0,100,200,0.2) 45%, transparent 70%)",
    border: NEON.cyan,
    badge: "ICE",
    desc: "Frozen crystalline wings with plasma frost",
  },
];

const RARITY_OPTIONS = [
  { id: "common", label: "Common", color: NEON.green, price: 0.1, discountPrice: 0.067 },
  { id: "rare", label: "Rare", color: NEON.cyan, price: 0.5, discountPrice: 0.335 },
  { id: "legendary", label: "Legendary", color: NEON.orange, price: 1.0, discountPrice: 0.67 },
  { id: "mythic", label: "Mythic", color: NEON.magenta, price: 100, discountPrice: 67.0 },
];

const CHAIN_OPTIONS = [
  { id: "ethereum", label: "Ethereum", icon: "⟠", color: "#627EEA" },
  { id: "polygon", label: "Polygon", icon: "⬡", color: "#8247E5" },
  { id: "base", label: "Base", icon: "◉", color: "#0052FF" },
  { id: "zksync", label: "zkSync", icon: "◆", color: "#8C8DFC" },
  { id: "skynt", label: "SKYNT", icon: "🦁", color: "#FFD700" },
];

function TemplatePreview({ template, image, selected, onClick }: {
  template: typeof COSMIC_TEMPLATES[0];
  image: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`template-${template.id}`}
      className="group relative rounded-lg overflow-hidden transition-all duration-300"
      style={{
        border: `2px solid ${selected ? template.border : "rgba(255,255,255,0.08)"}`,
        boxShadow: selected ? `0 0 20px ${template.border}40, inset 0 0 30px ${template.border}10` : "none",
      }}
    >
      <div className="aspect-[3/4] relative bg-black/60">
        {image ? (
          <img src={image} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Image className="w-8 h-8 text-white/15" />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: template.overlay }} />
        <div className="absolute inset-0 border-[3px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: template.border }} />
        {selected && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: template.border }}>
            <Check className="w-3 h-3 text-black" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 bg-black/80">
        <div className="flex items-center justify-between">
          <span className="font-heading text-[10px] tracking-wider text-white/80 truncate">{template.name}</span>
          <Badge variant="outline" className="text-[7px] h-3.5 px-1 border-0" style={{ color: template.border, background: `${template.border}15` }}>
            {template.badge}
          </Badge>
        </div>
      </div>
    </button>
  );
}

export default function RocketGirlsNFT() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(COSMIC_TEMPLATES[0].id);
  const [selectedRarity, setSelectedRarity] = useState("rare");
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [nftName, setNftName] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [showChainPicker, setShowChainPicker] = useState(false);

  const { data: approvalStatus } = useQuery<{ approved: boolean; role: string; mintCount: number }>({
    queryKey: ["/api/rocket-girls/status"],
  });

  const { data: collection = [] } = useQuery<any[]>({
    queryKey: ["/api/rocket-girls/collection"],
  });

  const mintMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      template: string;
      rarity: string;
      chain: string;
      imageData: string;
    }) => {
      const res = await apiRequest("POST", "/api/rocket-girls/mint", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rocket-girls/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rocket-girls/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
      toast({ title: "NFT Minted!", description: `${data.nft?.title || "RocketGirl"} minted on ${selectedChain} — zero fees applied` });
      setUploadedImage(null);
      setUploadedFile(null);
      setNftName("");
    },
    onError: (err: Error) => {
      let msg = err.message;
      try { const m = err.message.match(/^\d+:\s*(.+)$/s); if (m) msg = JSON.parse(m[1]).message; } catch {}
      toast({ title: "Mint Failed", description: msg, variant: "destructive" });
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum file size is 10MB", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleMint = useCallback(() => {
    if (!uploadedImage || !nftName.trim()) {
      toast({ title: "Missing Info", description: "Please upload an image and enter a name", variant: "destructive" });
      return;
    }
    mintMutation.mutate({
      name: nftName.trim(),
      template: selectedTemplate,
      rarity: selectedRarity,
      chain: selectedChain,
      imageData: uploadedImage,
    });
  }, [uploadedImage, nftName, selectedTemplate, selectedRarity, selectedChain, mintMutation, toast]);

  const activeTemplate = COSMIC_TEMPLATES.find(t => t.id === selectedTemplate)!;
  const activeRarity = RARITY_OPTIONS.find(r => r.id === selectedRarity)!;
  const activeChain = CHAIN_OPTIONS.find(c => c.id === selectedChain)!;
  const isApproved = approvalStatus?.approved ?? true;

  return (
    <div className="space-y-6 pb-12" data-testid="rocket-girls-page">
      <div className="relative overflow-hidden rounded-lg p-6 sm:p-8" style={{
        background: "linear-gradient(135deg, rgba(255,0,120,0.12) 0%, rgba(180,0,255,0.08) 50%, rgba(0,200,255,0.06) 100%)",
        border: `1px solid ${NEON.pink}30`,
      }}>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-20" style={{
          background: `radial-gradient(circle, ${NEON.pink}40 0%, transparent 70%)`,
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
              background: `linear-gradient(135deg, ${NEON.pink}, ${NEON.magenta})`,
              boxShadow: `0 0 20px ${NEON.pink}50`,
            }}>
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-heading tracking-widest" style={{ color: NEON.pink }} data-testid="text-page-title">
                ROCKETGIRLS NFT
              </h1>
              <p className="text-[10px] font-mono text-white/40 tracking-wider">COSMIC MODEL COLLECTION — 33% DISCOUNT — ZERO FEES</p>
            </div>
          </div>
          <p className="text-xs text-white/50 max-w-xl mt-2">
            Approved models upload photos to cosmic-themed NFT templates. Mint at a 33% discount with zero gas or platform fees.
          </p>
        </div>

        <div className="absolute bottom-2 right-4 flex items-center gap-2">
          {isApproved ? (
            <Badge className="text-[9px] px-2 py-0.5 border-0" style={{ background: `${NEON.green}20`, color: NEON.green }}>
              <ShieldCheck className="w-3 h-3 mr-1" /> APPROVED MODEL
            </Badge>
          ) : (
            <Badge className="text-[9px] px-2 py-0.5 border-0" style={{ background: `${NEON.orange}20`, color: NEON.orange }}>
              <Lock className="w-3 h-3 mr-1" /> PENDING APPROVAL
            </Badge>
          )}
        </div>
      </div>

      {!isApproved && (
        <div className="p-4 rounded-lg flex items-start gap-3" style={{
          background: `${NEON.orange}08`,
          border: `1px solid ${NEON.orange}25`,
        }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: NEON.orange }} />
          <div>
            <p className="text-sm font-heading" style={{ color: NEON.orange }}>Approval Required</p>
            <p className="text-xs text-white/50 mt-1">Your account is pending model approval. Contact an admin or mint through the standard Mint NFT page in the meantime.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-sm tracking-wider flex items-center gap-2" style={{ color: NEON.cyan }}>
                <Sparkles className="w-4 h-4" /> COSMIC TEMPLATES
              </h2>
              <span className="text-[9px] font-mono text-white/30">{COSMIC_TEMPLATES.length} AVAILABLE</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {COSMIC_TEMPLATES.map(t => (
                <TemplatePreview
                  key={t.id}
                  template={t}
                  image={uploadedImage}
                  selected={selectedTemplate === t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                />
              ))}
            </div>
            <p className="text-[9px] font-mono text-white/25 mt-2 text-center">{activeTemplate.desc}</p>
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="font-heading text-sm tracking-wider flex items-center gap-2 mb-3" style={{ color: NEON.pink }}>
              <Upload className="w-4 h-4" /> UPLOAD MODEL PHOTO
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-file-upload"
            />
            {!uploadedImage ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-area"
                className="w-full py-12 rounded-lg border-2 border-dashed transition-all hover:border-opacity-60 flex flex-col items-center gap-3"
                style={{ borderColor: `${NEON.pink}30` }}
              >
                <Upload className="w-8 h-8" style={{ color: `${NEON.pink}60` }} />
                <span className="text-sm text-white/40 font-heading tracking-wider">CLICK TO UPLOAD</span>
                <span className="text-[10px] text-white/20 font-mono">PNG, JPG, WebP — Max 10MB</span>
              </button>
            ) : (
              <div className="relative">
                <div className="aspect-[4/5] max-h-[400px] rounded-lg overflow-hidden relative mx-auto" style={{
                  border: `2px solid ${activeTemplate.border}40`,
                  boxShadow: `0 0 30px ${activeTemplate.border}15`,
                }}>
                  <img src={uploadedImage} alt="uploaded" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: activeTemplate.overlay }} />
                  <div className="absolute bottom-0 left-0 right-0 p-3" style={{
                    background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                  }}>
                    <p className="font-heading text-xs tracking-wider" style={{ color: activeTemplate.border }}>
                      {activeTemplate.name}
                    </p>
                    {nftName && <p className="font-heading text-sm text-white mt-0.5">{nftName}</p>}
                  </div>
                </div>
                <div className="flex justify-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="button-change-image"
                    className="text-[10px] h-7 border-white/10 text-white/50 hover:text-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Change
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="button-remove-image"
                    className="text-[10px] h-7 border-red-500/20 text-red-400/60 hover:text-red-400"
                    onClick={() => { setUploadedImage(null); setUploadedFile(null); }}
                  >
                    <X className="w-3 h-3 mr-1" /> Remove
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="button-preview-fullscreen"
                    className="text-[10px] h-7 border-white/10 text-white/50 hover:text-white"
                    onClick={() => setPreviewMode(true)}
                  >
                    <Eye className="w-3 h-3 mr-1" /> Preview
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="font-heading text-sm tracking-wider flex items-center gap-2 mb-3" style={{ color: NEON.gold }}>
              <Crown className="w-4 h-4" /> NFT DETAILS
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-heading tracking-wider text-white/40 uppercase mb-1 block">Name</label>
                <input
                  data-testid="input-nft-name"
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value.slice(0, 60))}
                  placeholder="Enter NFT name..."
                  maxLength={60}
                  className="w-full p-3 bg-black/40 border border-white/10 rounded-lg font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-heading tracking-wider text-white/40 uppercase mb-2 block">Rarity Tier</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RARITY_OPTIONS.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      data-testid={`rarity-${r.id}`}
                      onClick={() => setSelectedRarity(r.id)}
                      className="p-2.5 rounded-lg text-center transition-all"
                      style={{
                        background: selectedRarity === r.id ? `${r.color}15` : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selectedRarity === r.id ? `${r.color}50` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <span className="font-heading text-xs tracking-wider block" style={{ color: r.color }}>{r.label}</span>
                      <span className="text-[9px] font-mono text-white/30 line-through block">{r.price} ETH</span>
                      <span className="text-[10px] font-mono block" style={{ color: r.color }}>{r.discountPrice} ETH</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-heading tracking-wider text-white/40 uppercase mb-2 block">Blockchain</label>
                <div className="relative">
                  <button
                    type="button"
                    data-testid="button-chain-picker"
                    onClick={() => setShowChainPicker(!showChainPicker)}
                    className="w-full p-3 rounded-lg flex items-center justify-between transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${showChainPicker ? activeChain.color + "50" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{activeChain.icon}</span>
                      <span className="font-heading text-xs tracking-wider text-white/80">{activeChain.label}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${showChainPicker ? "rotate-180" : ""}`} />
                  </button>
                  {showChainPicker && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-20" style={{
                      background: "rgba(10,10,20,0.98)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}>
                      {CHAIN_OPTIONS.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          data-testid={`chain-option-${c.id}`}
                          onClick={() => { setSelectedChain(c.id); setShowChainPicker(false); }}
                          className="w-full px-3 py-2.5 flex items-center gap-2 transition-colors hover:bg-white/5"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        >
                          <span>{c.icon}</span>
                          <span className="font-heading text-xs tracking-wider" style={{ color: selectedChain === c.id ? c.color : "rgba(255,255,255,0.6)" }}>
                            {c.label}
                          </span>
                          {selectedChain === c.id && <Check className="w-3 h-3 ml-auto" style={{ color: c.color }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg p-4 sticky top-4" style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${NEON.pink}20`,
          }}>
            <h3 className="font-heading text-sm tracking-wider mb-3 flex items-center gap-2" style={{ color: NEON.pink }}>
              <Flame className="w-4 h-4" /> MINT SUMMARY
            </h3>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-white/40">Template</span>
                <span style={{ color: activeTemplate.border }}>{activeTemplate.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Rarity</span>
                <span style={{ color: activeRarity.color }}>{activeRarity.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Chain</span>
                <span className="text-white/70">{activeChain.icon} {activeChain.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Standard Price</span>
                <span className="text-white/30 line-through">{activeRarity.price} ETH</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40">RocketGirls Price</span>
                <span className="font-heading text-sm" style={{ color: NEON.green }}>{activeRarity.discountPrice} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Platform Fee</span>
                <span style={{ color: NEON.green }}>FREE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Gas Fee</span>
                <span style={{ color: NEON.green }}>COVERED</span>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2" />
              <div className="flex justify-between items-center">
                <span className="text-white/60 font-heading tracking-wider">YOU SAVE</span>
                <span className="font-heading text-sm" style={{ color: NEON.gold }}>
                  {(activeRarity.price - activeRarity.discountPrice).toFixed(3)} ETH (33%)
                </span>
              </div>
            </div>

            <Button
              data-testid="button-mint-nft"
              className="w-full mt-4 py-4 font-heading tracking-widest text-sm text-black"
              style={{
                background: `linear-gradient(135deg, ${NEON.pink}, ${NEON.magenta})`,
                boxShadow: `0 0 20px ${NEON.pink}30`,
              }}
              disabled={!uploadedImage || !nftName.trim() || mintMutation.isPending || !isApproved}
              onClick={handleMint}
            >
              {mintMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              {mintMutation.isPending ? "MINTING..." : "MINT ROCKETGIRL NFT"}
            </Button>

            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Zap className="w-3 h-3" style={{ color: NEON.green }} />
              <span className="text-[9px] font-mono" style={{ color: NEON.green }}>ZERO FEES — 33% DISCOUNT</span>
            </div>
          </div>

          <div className="rounded-lg p-4" style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <h3 className="font-heading text-xs tracking-wider mb-2 flex items-center gap-2 text-white/50">
              <Star className="w-3.5 h-3.5" /> COLLECTION ({collection.length})
            </h3>
            {collection.length === 0 ? (
              <p className="text-[10px] font-mono text-white/25 text-center py-4">No RocketGirl NFTs minted yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {collection.slice(0, 6).map((nft: any) => (
                  <div key={nft.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }} data-testid={`collection-nft-${nft.id}`}>
                    {nft.image ? (
                      <img src={nft.image} alt={nft.title} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-black/40 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white/10" />
                      </div>
                    )}
                    <div className="px-1.5 py-1 bg-black/70">
                      <p className="text-[8px] font-heading tracking-wider text-white/60 truncate">{nft.title}</p>
                      <p className="text-[7px] font-mono" style={{ color: NEON.pink }}>{nft.rarity}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewMode && uploadedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" data-testid="preview-overlay" onClick={() => setPreviewMode(false)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewMode(false)}
              className="absolute -top-8 right-0 text-white/40 hover:text-white"
              data-testid="button-close-preview"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="aspect-[3/4] rounded-lg overflow-hidden relative" style={{
              border: `3px solid ${activeTemplate.border}60`,
              boxShadow: `0 0 40px ${activeTemplate.border}20`,
            }}>
              <img src={uploadedImage} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: activeTemplate.overlay }} />
              <div className="absolute bottom-0 left-0 right-0 p-4" style={{
                background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
              }}>
                <Badge className="text-[8px] mb-1 border-0" style={{ background: `${activeTemplate.border}20`, color: activeTemplate.border }}>
                  {activeTemplate.badge}
                </Badge>
                <p className="font-heading text-lg text-white tracking-wider">{nftName || "Untitled"}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono" style={{ color: activeRarity.color }}>{activeRarity.label}</span>
                  <span className="text-[10px] font-mono text-white/30">{activeChain.icon} {activeChain.label}</span>
                  <span className="text-[10px] font-mono" style={{ color: NEON.green }}>{activeRarity.discountPrice} ETH</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
