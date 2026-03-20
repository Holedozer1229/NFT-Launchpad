import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Rocket, Upload, Sparkles, Image, ShieldCheck, Crown,
  Star, Flame, X, Check, ChevronDown, RefreshCw, Coins,
  Lock, AlertTriangle, Zap, Eye, Heart, Diamond, Camera,
  Award, TrendingUp, Users, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NEON = {
  pink:    "#ff1a6c",
  hot:     "#ff005c",
  magenta: "#ff00cc",
  cyan:    "#00e5ff",
  gold:    "#ffcc00",
  green:   "#00ff88",
  orange:  "#ff6600",
  violet:  "#cc00ff",
  red:     "#ff2020",
  rose:    "#ff4488",
};

const COSMIC_TEMPLATES = [
  {
    id: "nebula-queen",
    name: "Nebula Queen",
    overlay: "radial-gradient(ellipse at 50% 30%, rgba(255,0,120,0.45) 0%, rgba(120,0,255,0.28) 40%, transparent 70%)",
    border: NEON.pink,
    badge: "COSMIC",
    desc: "Ethereal nebula halo — stardust trails frame your curves",
    mood: "Ethereal",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    overlay: "radial-gradient(circle at 50% 70%, rgba(255,100,0,0.5) 0%, rgba(255,0,60,0.3) 35%, transparent 65%)",
    border: NEON.orange,
    badge: "FIRE",
    desc: "Solar plasma burst — pure heat radiating from your silhouette",
    mood: "Fierce",
  },
  {
    id: "aurora-goddess",
    name: "Aurora Goddess",
    overlay: "linear-gradient(160deg, rgba(0,255,160,0.3) 0%, rgba(0,180,255,0.25) 50%, rgba(200,0,255,0.28) 100%)",
    border: NEON.green,
    badge: "AURORA",
    desc: "Northern lights cascade — otherworldly beauty unveiled",
    mood: "Mystical",
  },
  {
    id: "void-siren",
    name: "Void Siren",
    overlay: "radial-gradient(ellipse at 50% 60%, rgba(120,0,220,0.45) 0%, rgba(20,0,60,0.35) 55%, rgba(0,0,0,0.6) 85%)",
    border: NEON.violet,
    badge: "VOID",
    desc: "Dark matter aura — danger wrapped in velvet shadow",
    mood: "Dark & Dangerous",
  },
  {
    id: "supernova-diva",
    name: "Supernova Diva",
    overlay: "radial-gradient(circle at 50% 45%, rgba(255,200,0,0.5) 0%, rgba(255,80,0,0.3) 42%, transparent 70%)",
    border: NEON.gold,
    badge: "LEGENDARY",
    desc: "Golden shockwave explosion — blinding, unstoppable, iconic",
    mood: "Legendary",
  },
  {
    id: "cryo-angel",
    name: "Cryo Angel",
    overlay: "radial-gradient(ellipse at 50% 25%, rgba(0,220,255,0.45) 0%, rgba(0,80,200,0.25) 48%, transparent 72%)",
    border: NEON.cyan,
    badge: "ICE",
    desc: "Frozen crystalline wings — ice-cold outside, burning inside",
    mood: "Cool & Lethal",
  },
];

const RARITY_OPTIONS = [
  { id: "common",    label: "Rookie",    icon: "🔥",  color: NEON.green,   price: 0.1,   discountPrice: 0.067, perks: ["Standard resolution", "Public listing"] },
  { id: "rare",      label: "Hot",       icon: "💋",  color: NEON.cyan,    price: 0.5,   discountPrice: 0.335, perks: ["HD resolution", "Featured placement", "Collector badge"] },
  { id: "legendary", label: "Goddess",   icon: "👑",  color: NEON.gold,    price: 1.0,   discountPrice: 0.67,  perks: ["4K + animated", "Priority listing", "10% royalties", "Private channel"] },
  { id: "mythic",    label: "ONLYFANS∞", icon: "💎",  color: NEON.magenta, price: 100,   discountPrice: 67.0,  perks: ["Ultra 8K", "1-of-1 exclusive", "Lifetime royalties", "VIP access", "IRL meetup NFT"] },
];

const CHAIN_OPTIONS = [
  { id: "ethereum", label: "Ethereum", icon: "⟠", color: "#627EEA" },
  { id: "polygon",  label: "Polygon",  icon: "⬡", color: "#8247E5" },
  { id: "base",     label: "Base",     icon: "◉", color: "#0052FF" },
  { id: "zksync",   label: "zkSync",   icon: "◆", color: "#8C8DFC" },
  { id: "skynt",    label: "SKYNT",    icon: "🦁", color: "#FFD700" },
];

const MODEL_TIERS = [
  { tier: "Rookie",    emoji: "🔥", count: 312,  earn: "~0.05–0.1 ETH/mint",  color: NEON.green   },
  { tier: "Hot",       emoji: "💋", count: 88,   earn: "~0.3–0.5 ETH/mint",   color: NEON.cyan    },
  { tier: "Goddess",   emoji: "👑", count: 24,   earn: "~0.6–1.0 ETH/mint",   color: NEON.gold    },
  { tier: "ONLYFANS∞", emoji: "💎", count: 3,    earn: "60–100 ETH/mint",      color: NEON.magenta },
];

const SHOWCASE_NFTS = [
  { name: "Void Siren #001",    template: "Void Siren",    rarity: "MYTHIC",    price: "67 ETH",   sold: true,   hearts: 4210 },
  { name: "Solar Flare #007",   template: "Solar Flare",   rarity: "GODDESS",   price: "0.67 ETH", sold: true,   hearts: 1893 },
  { name: "Nebula Queen #012",  template: "Nebula Queen",  rarity: "HOT",       price: "0.335 ETH",sold: false,  hearts: 944  },
  { name: "Aurora Goddess #003",template: "Aurora Goddess",rarity: "GODDESS",   price: "0.67 ETH", sold: false,  hearts: 2107 },
  { name: "Cryo Angel #019",    template: "Cryo Angel",    rarity: "HOT",       price: "0.335 ETH",sold: true,   hearts: 773  },
  { name: "Supernova Diva #001",template: "Supernova Diva",rarity: "MYTHIC",    price: "67 ETH",   sold: false,  hearts: 5521 },
];

// ─── Age Gate ────────────────────────────────────────────────────────────────
function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 text-center space-y-6 p-8 rounded-2xl"
        style={{ border: `1px solid ${NEON.pink}40`, background: "rgba(10,0,20,0.98)" }}>
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl"
          style={{ background: `linear-gradient(135deg, ${NEON.hot}, ${NEON.violet})` }}>
          🔞
        </div>
        <div>
          <h2 className="font-heading text-2xl tracking-widest" style={{ color: NEON.pink }}>ADULTS ONLY</h2>
          <p className="text-xs font-mono text-white/40 mt-1 tracking-wider">ROCKETBABES CONTAINS ADULT MODEL CONTENT</p>
        </div>
        <p className="text-sm text-white/50 leading-relaxed">
          This platform hosts professional model photography intended for adult audiences (18+).
          By entering you confirm you are of legal age in your jurisdiction.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            data-testid="button-age-confirm"
            className="w-full py-3.5 rounded-xl font-heading tracking-widest text-sm text-black transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${NEON.pink}, ${NEON.magenta})`, boxShadow: `0 0 30px ${NEON.pink}40` }}
          >
            I AM 18+ — ENTER
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 rounded-xl font-heading tracking-widest text-xs text-white/30 border border-white/10 hover:border-white/20 transition-all"
          >
            EXIT
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Showcase NFT Card ────────────────────────────────────────────────────────
function ShowcaseCard({ nft, idx }: { nft: typeof SHOWCASE_NFTS[0]; idx: number }) {
  const template = COSMIC_TEMPLATES.find(t => t.name === nft.template) ?? COSMIC_TEMPLATES[0];
  const rarityColor =
    nft.rarity === "MYTHIC" ? NEON.magenta :
    nft.rarity === "GODDESS" ? NEON.gold :
    nft.rarity === "HOT" ? NEON.cyan : NEON.green;

  return (
    <div
      data-testid={`showcase-nft-${idx}`}
      className="rounded-xl overflow-hidden group relative transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
      style={{
        border: `1px solid ${rarityColor}30`,
        boxShadow: `0 4px 30px ${rarityColor}10`,
        background: "rgba(10,0,20,0.8)",
      }}
    >
      <div className="aspect-[3/4] relative" style={{ background: `linear-gradient(180deg, rgba(30,0,60,0.9), rgba(5,0,15,0.95))` }}>
        <div className="absolute inset-0" style={{ background: template.overlay }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className="w-10 h-10" style={{ color: `${rarityColor}40` }} />
        </div>
        {nft.sold && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="font-heading tracking-widest text-white/60 text-sm rotate-[-20deg] border border-white/20 px-4 py-1 rounded">SOLD</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className="text-[8px] px-1.5 py-0.5 border-0 font-heading tracking-wider"
            style={{ background: `${rarityColor}25`, color: rarityColor }}>
            {nft.rarity}
          </Badge>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
          <Heart className="w-2.5 h-2.5" style={{ color: NEON.pink }} />
          <span className="text-[9px] font-mono text-white/60">{nft.hearts.toLocaleString()}</span>
        </div>
      </div>
      <div className="p-3" style={{ borderTop: `1px solid ${rarityColor}15` }}>
        <p className="font-heading text-xs tracking-wider text-white/80 truncate">{nft.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] font-mono" style={{ color: rarityColor }}>{nft.price}</span>
          <span className="text-[9px] font-mono text-white/30">{template.mood}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Template Preview ─────────────────────────────────────────────────────────
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
      className="group relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        border: `2px solid ${selected ? template.border : "rgba(255,255,255,0.06)"}`,
        boxShadow: selected ? `0 0 25px ${template.border}50, inset 0 0 30px ${template.border}10` : "none",
        transform: selected ? "scale(1.03)" : "scale(1)",
      }}
    >
      <div className="aspect-[3/4] relative" style={{ background: "linear-gradient(180deg, rgba(20,0,40,0.95), rgba(5,0,15,0.98))" }}>
        {image ? (
          <img src={image} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-7 h-7" style={{ color: `${template.border}30` }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: template.overlay }} />
        {selected && (
          <div className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center" style={{ background: template.border }}>
            <Check className="w-2.5 h-2.5 text-black" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 py-1 px-1.5" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
          <span className="text-[7px] font-mono tracking-widest" style={{ color: template.border }}>{template.mood.toUpperCase()}</span>
        </div>
      </div>
      <div className="px-1.5 py-1 bg-black/90 flex items-center justify-between">
        <span className="font-heading text-[9px] tracking-wider text-white/70 truncate">{template.name}</span>
        <Badge variant="outline" className="text-[6px] h-3 px-0.5 border-0 shrink-0"
          style={{ color: template.border, background: `${template.border}18` }}>
          {template.badge}
        </Badge>
      </div>
    </button>
  );
}

// ─── Fullscreen Preview Modal ─────────────────────────────────────────────────
function FullscreenPreview({ image, template, name, onClose }: {
  image: string;
  template: typeof COSMIC_TEMPLATES[0];
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md" onClick={onClose}>
      <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} data-testid="button-close-preview"
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${template.border}60`, boxShadow: `0 0 60px ${template.border}25` }}>
          <div className="aspect-[3/4] relative">
            <img src={image} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: template.overlay }} />
            <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.9))" }}>
              <p className="font-heading text-xs tracking-wider" style={{ color: template.border }}>{template.name}</p>
              {name && <p className="font-heading text-xl text-white mt-0.5">{name}</p>}
              <p className="text-[10px] text-white/40 font-mono mt-1">{template.desc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RocketBabesNFT() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ageVerified, setAgeVerified] = useState(() => {
    try { return sessionStorage.getItem("rb_age_ok") === "1"; } catch { return false; }
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(COSMIC_TEMPLATES[0].id);
  const [selectedRarity, setSelectedRarity] = useState("rare");
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [nftName, setNftName] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [showChainPicker, setShowChainPicker] = useState(false);

  const { data: approvalStatus } = useQuery<{ approved: boolean; role: string; mintCount: number }>({
    queryKey: ["/api/rocket-babes/status"],
  });

  const { data: rbStats } = useQuery<{ totalMinted: number; totalModels: number; soldVolume: string }>({
    queryKey: ["/api/rocket-babes/stats"],
    refetchInterval: 60000,
  });

  const { data: collection = [] } = useQuery<any[]>({
    queryKey: ["/api/rocket-babes/collection"],
  });

  const mintMutation = useMutation({
    mutationFn: async (data: { name: string; template: string; rarity: string; chain: string; imageData: string }) => {
      const res = await apiRequest("POST", "/api/rocket-babes/mint", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rocket-babes/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rocket-babes/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
      toast({ title: "🔥 NFT Minted!", description: `${data.nft?.title || "RocketBabe"} is live on ${selectedChain} — zero fees` });
      setUploadedImage(null); setUploadedFile(null); setNftName("");
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
      toast({ title: "Invalid File", description: "PNG, JPG, WebP only", variant: "destructive" }); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max 10MB", variant: "destructive" }); return;
    }
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleMint = useCallback(() => {
    if (!uploadedImage || !nftName.trim()) {
      toast({ title: "Missing Info", description: "Upload a photo and enter a name", variant: "destructive" }); return;
    }
    mintMutation.mutate({ name: nftName.trim(), template: selectedTemplate, rarity: selectedRarity, chain: selectedChain, imageData: uploadedImage });
  }, [uploadedImage, nftName, selectedTemplate, selectedRarity, selectedChain, mintMutation, toast]);

  const handleAgeConfirm = () => {
    try { sessionStorage.setItem("rb_age_ok", "1"); } catch {}
    setAgeVerified(true);
  };

  const activeTemplate = COSMIC_TEMPLATES.find(t => t.id === selectedTemplate)!;
  const activeRarity   = RARITY_OPTIONS.find(r => r.id === selectedRarity)!;
  const activeChain    = CHAIN_OPTIONS.find(c => c.id === selectedChain)!;
  const isApproved     = approvalStatus?.approved ?? true;
  const mintCount      = approvalStatus?.mintCount ?? 0;

  if (!ageVerified) return <AgeGate onConfirm={handleAgeConfirm} />;

  return (
    <div className="min-h-screen pb-16 space-y-8" data-testid="rocket-babes-page"
      style={{ background: "linear-gradient(180deg, rgba(20,0,30,0.6) 0%, transparent 40%)" }}>

      {previewMode && uploadedImage && (
        <FullscreenPreview image={uploadedImage} template={activeTemplate} name={nftName} onClose={() => setPreviewMode(false)} />
      )}

      {/* ── HERO BANNER ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,0,80,0.14) 0%, rgba(180,0,255,0.10) 50%, rgba(0,200,255,0.07) 100%)",
          border: `1px solid ${NEON.pink}35`,
          boxShadow: `0 0 80px ${NEON.hot}12, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}>
        {/* glow blobs */}
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${NEON.pink} 0%, transparent 70%)` }} />
        <div className="absolute -bottom-10 right-0 w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{ background: `radial-gradient(circle, ${NEON.violet} 0%, transparent 70%)` }} />

        <div className="relative z-10 p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${NEON.hot}, ${NEON.magenta})`,
                boxShadow: `0 0 30px ${NEON.pink}55`,
              }}>
              <Rocket className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-heading tracking-[0.2em]"
                  style={{
                    background: `linear-gradient(90deg, ${NEON.pink}, ${NEON.magenta}, ${NEON.violet})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                  data-testid="text-page-title">
                  ROCKETBABES
                </h1>
                <Badge className="text-[9px] px-2 h-5 border-0 font-heading tracking-widest"
                  style={{ background: `${NEON.pink}20`, color: NEON.pink }}>NFT</Badge>
                <Badge className="text-[8px] px-1.5 h-5 border-0 font-heading"
                  style={{ background: "rgba(255,0,0,0.15)", color: "#ff4444" }}>🔞 18+</Badge>
              </div>
              <p className="text-xs font-mono text-white/35 tracking-[0.15em] mt-1">
                PROFESSIONAL MODEL COLLECTION · COSMIC THEMED · ZERO FEES · 33% DISCOUNT
              </p>
            </div>
            <div className="sm:ml-auto shrink-0">
              {isApproved ? (
                <Badge className="text-[9px] px-2.5 py-1 border-0 font-heading tracking-wider"
                  style={{ background: `${NEON.green}18`, color: NEON.green, border: `1px solid ${NEON.green}30` }}>
                  <ShieldCheck className="w-3 h-3 mr-1.5" /> VERIFIED MODEL
                </Badge>
              ) : (
                <Badge className="text-[9px] px-2.5 py-1 border-0 font-heading tracking-wider"
                  style={{ background: `${NEON.orange}18`, color: NEON.orange }}>
                  <Lock className="w-3 h-3 mr-1" /> PENDING APPROVAL
                </Badge>
              )}
            </div>
          </div>

          <p className="text-sm text-white/45 max-w-2xl leading-relaxed">
            The most provocative NFT platform in the galaxy. Upload your professional model shots,
            choose a cosmic overlay, mint 1-of-1 editions at a <span style={{ color: NEON.gold }}>33% discount</span> with
            <span style={{ color: NEON.green }}> zero gas fees</span>. Your curves, your art, your chain.
          </p>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-6 mt-6">
            {[
              { label: "Models",    value: rbStats ? String(rbStats.totalModels) : "—",                          icon: "💋", color: NEON.pink  },
              { label: "Minted",    value: rbStats ? rbStats.totalMinted.toLocaleString() : "—",                 icon: "🔥", color: NEON.orange},
              { label: "Sold Vol.", value: rbStats ? `${parseFloat(rbStats.soldVolume).toLocaleString()} SKYNT` : "—", icon: "💰", color: NEON.gold  },
              { label: "Your Mints",value: String(mintCount),                                                    icon: "👑", color: NEON.cyan },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g,"-")}`}>
                <span className="text-base">{s.icon}</span>
                <div>
                  <p className="font-heading text-sm" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[9px] font-mono text-white/30 tracking-wider">{s.label.toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isApproved && (
        <div className="p-4 rounded-xl flex items-start gap-3"
          style={{ background: `${NEON.orange}08`, border: `1px solid ${NEON.orange}25` }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: NEON.orange }} />
          <div>
            <p className="text-sm font-heading" style={{ color: NEON.orange }}>Approval Required</p>
            <p className="text-xs text-white/45 mt-1">
              Your account is pending model verification. You must be approved before minting on RocketBabes.
              Contact an admin or submit your portfolio for review.
            </p>
          </div>
        </div>
      )}

      {/* ── NFT SHOWCASE ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-sm tracking-widest flex items-center gap-2" style={{ color: NEON.gold }}>
            <Star className="w-4 h-4" /> FEATURED COLLECTION
          </h2>
          <span className="text-[9px] font-mono text-white/25 tracking-wider">LIVE ON-CHAIN</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SHOWCASE_NFTS.map((nft, i) => (
            <ShowcaseCard key={nft.name} nft={nft} idx={i} />
          ))}
        </div>
      </div>

      {/* ── MODEL TIERS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MODEL_TIERS.map(t => (
          <div key={t.tier}
            className="p-4 rounded-xl text-center"
            style={{ background: `${t.color}08`, border: `1px solid ${t.color}25` }}
            data-testid={`tier-${t.tier.toLowerCase()}`}>
            <div className="text-2xl mb-1">{t.emoji}</div>
            <p className="font-heading text-xs tracking-wider" style={{ color: t.color }}>{t.tier}</p>
            <p className="text-[9px] font-mono text-white/25 mt-0.5">{t.count} models</p>
            <p className="text-[9px] font-mono mt-1" style={{ color: t.color }}>{t.earn}</p>
          </div>
        ))}
      </div>

      {/* ── MAIN MINT UI ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Template + Upload + Details */}
        <div className="lg:col-span-2 space-y-5">

          {/* Templates */}
          <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-sm tracking-widest flex items-center gap-2" style={{ color: NEON.cyan }}>
                <Sparkles className="w-4 h-4" /> CHOOSE YOUR COSMIC LOOK
              </h2>
              <span className="text-[9px] font-mono text-white/25">{COSMIC_TEMPLATES.length} OVERLAYS</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {COSMIC_TEMPLATES.map(t => (
                <TemplatePreview key={t.id} template={t} image={uploadedImage} selected={selectedTemplate === t.id} onClick={() => setSelectedTemplate(t.id)} />
              ))}
            </div>
            <p className="text-[10px] font-mono text-white/25 mt-3 text-center italic">"{activeTemplate.desc}"</p>
          </div>

          {/* Upload */}
          <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="font-heading text-sm tracking-widest flex items-center gap-2 mb-4" style={{ color: NEON.pink }}>
              <Camera className="w-4 h-4" /> UPLOAD YOUR SHOOT
            </h2>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" data-testid="input-file-upload" />
            {!uploadedImage ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-area"
                className="w-full py-14 rounded-xl border-2 border-dashed flex flex-col items-center gap-3 transition-all hover:border-opacity-60 group"
                style={{ borderColor: `${NEON.pink}28`, background: `${NEON.pink}04` }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                  style={{ background: `${NEON.pink}12`, border: `1px solid ${NEON.pink}25` }}>
                  <Camera className="w-6 h-6" style={{ color: `${NEON.pink}80` }} />
                </div>
                <span className="font-heading tracking-widest text-sm" style={{ color: `${NEON.pink}70` }}>DROP YOUR SHOT HERE</span>
                <span className="text-[10px] font-mono text-white/20">PNG · JPG · WebP · Max 10MB</span>
                <span className="text-[9px] font-mono text-white/15">Professional model photography only</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative mx-auto max-w-xs">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden relative"
                    style={{ border: `2px solid ${activeTemplate.border}50`, boxShadow: `0 0 40px ${activeTemplate.border}20` }}>
                    <img src={uploadedImage} alt="uploaded" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: activeTemplate.overlay }} />
                    <div className="absolute bottom-0 left-0 right-0 p-4"
                      style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.9))" }}>
                      <p className="font-heading text-xs tracking-widest" style={{ color: activeTemplate.border }}>{activeTemplate.name}</p>
                      {nftName && <p className="font-heading text-lg text-white mt-0.5">{nftName}</p>}
                      <p className="text-[9px] font-mono text-white/40 mt-0.5">{activeTemplate.mood}</p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge className="text-[8px] border-0 px-1.5"
                        style={{ background: `${activeTemplate.border}30`, color: activeTemplate.border }}>
                        {activeTemplate.badge}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-2">
                  <Button size="sm" variant="outline" data-testid="button-change-image"
                    className="text-[10px] h-7 border-white/10 text-white/45 hover:text-white"
                    onClick={() => fileInputRef.current?.click()}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Change
                  </Button>
                  <Button size="sm" variant="outline" data-testid="button-remove-image"
                    className="text-[10px] h-7 border-red-500/20 text-red-400/60 hover:text-red-400"
                    onClick={() => { setUploadedImage(null); setUploadedFile(null); }}>
                    <X className="w-3 h-3 mr-1" /> Remove
                  </Button>
                  <Button size="sm" variant="outline" data-testid="button-preview-fullscreen"
                    className="text-[10px] h-7 border-white/10 text-white/45 hover:text-white"
                    onClick={() => setPreviewMode(true)}>
                    <Eye className="w-3 h-3 mr-1" /> Full Preview
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* NFT Details */}
          <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="font-heading text-sm tracking-widest flex items-center gap-2 mb-4" style={{ color: NEON.gold }}>
              <Crown className="w-4 h-4" /> NFT DETAILS
            </h2>
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="text-[9px] font-heading tracking-widest text-white/35 uppercase mb-1.5 block">NFT Name / Stage Name</label>
                <input
                  data-testid="input-nft-name"
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value.slice(0, 60))}
                  placeholder="e.g. Nebula Queen #001 by QueenXX..."
                  maxLength={60}
                  className="w-full p-3.5 bg-black/50 border border-white/08 rounded-xl font-mono text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* Rarity */}
              <div>
                <label className="text-[9px] font-heading tracking-widest text-white/35 uppercase mb-2 block">Model Tier</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RARITY_OPTIONS.map(r => (
                    <button key={r.id} type="button" data-testid={`rarity-${r.id}`}
                      onClick={() => setSelectedRarity(r.id)}
                      className="p-3 rounded-xl text-center transition-all"
                      style={{
                        background: selectedRarity === r.id ? `${r.color}12` : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selectedRarity === r.id ? r.color + "45" : "rgba(255,255,255,0.06)"}`,
                        transform: selectedRarity === r.id ? "scale(1.03)" : "scale(1)",
                      }}>
                      <span className="text-lg block mb-0.5">{r.icon}</span>
                      <span className="font-heading text-xs tracking-wider block" style={{ color: r.color }}>{r.label}</span>
                      <span className="text-[8px] font-mono text-white/25 line-through block mt-0.5">{r.price} ETH</span>
                      <span className="text-[10px] font-mono block" style={{ color: r.color }}>{r.discountPrice} ETH</span>
                      {selectedRarity === r.id && (
                        <div className="mt-1.5 space-y-0.5">
                          {r.perks.slice(0, 2).map(p => (
                            <p key={p} className="text-[8px] font-mono text-white/30 leading-tight">{p}</p>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chain */}
              <div>
                <label className="text-[9px] font-heading tracking-widest text-white/35 uppercase mb-2 block">Blockchain</label>
                <div className="relative">
                  <button type="button" data-testid="button-chain-picker"
                    onClick={() => setShowChainPicker(!showChainPicker)}
                    className="w-full p-3.5 rounded-xl flex items-center justify-between transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${showChainPicker ? activeChain.color + "45" : "rgba(255,255,255,0.07)"}`,
                    }}>
                    <span className="flex items-center gap-2.5">
                      <span className="text-lg">{activeChain.icon}</span>
                      <span className="font-heading text-xs tracking-wider text-white/70">{activeChain.label}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-white/25 transition-transform duration-200 ${showChainPicker ? "rotate-180" : ""}`} />
                  </button>
                  {showChainPicker && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                      style={{ background: "rgba(8,0,18,0.99)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      {CHAIN_OPTIONS.map(c => (
                        <button key={c.id} type="button" data-testid={`chain-option-${c.id}`}
                          onClick={() => { setSelectedChain(c.id); setShowChainPicker(false); }}
                          className="w-full px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/04"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span className="text-base">{c.icon}</span>
                          <span className="font-heading text-xs tracking-wider" style={{ color: selectedChain === c.id ? c.color : "rgba(255,255,255,0.5)" }}>
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

        {/* RIGHT: Mint Panel */}
        <div className="space-y-4">
          <div className="rounded-xl p-5 sticky top-4 space-y-5"
            style={{
              background: "rgba(255,0,80,0.04)",
              border: `1px solid ${NEON.pink}25`,
              boxShadow: `0 0 40px ${NEON.hot}08`,
            }}>
            <h3 className="font-heading text-sm tracking-widest flex items-center gap-2" style={{ color: NEON.pink }}>
              <Flame className="w-4 h-4" /> MINT SUMMARY
            </h3>

            {/* Preview thumbnail */}
            {uploadedImage && (
              <div className="aspect-[3/4] max-h-48 rounded-xl overflow-hidden relative mx-auto"
                style={{ border: `1px solid ${activeTemplate.border}35` }}>
                <img src={uploadedImage} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: activeTemplate.overlay }} />
              </div>
            )}

            <div className="space-y-2.5 text-xs font-mono">
              {[
                { label: "Template",   value: activeTemplate.name,            color: activeTemplate.border },
                { label: "Tier",       value: `${activeRarity.icon} ${activeRarity.label}`, color: activeRarity.color },
                { label: "Chain",      value: `${activeChain.icon} ${activeChain.label}`,    color: "rgba(255,255,255,0.6)" },
                { label: "List Price", value: `${activeRarity.price} ETH`,    color: "rgba(255,255,255,0.25)", strikethrough: true },
                { label: "Your Price", value: `${activeRarity.discountPrice} ETH`, color: NEON.green },
                { label: "Platform Fee",value: "FREE",                        color: NEON.green },
                { label: "Gas Fee",    value: "COVERED",                      color: NEON.green },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-white/35">{row.label}</span>
                  <span className={row.strikethrough ? "line-through" : ""} style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg p-3 text-center"
              style={{ background: `${NEON.gold}08`, border: `1px solid ${NEON.gold}20` }}>
              <p className="text-[9px] font-mono text-white/35 tracking-wider">YOU SAVE</p>
              <p className="font-heading text-xl mt-0.5" style={{ color: NEON.gold }}>
                {(activeRarity.price - activeRarity.discountPrice).toFixed(3)} ETH
              </p>
              <p className="text-[9px] font-mono text-white/25">33% model discount applied</p>
            </div>

            {/* Royalty info */}
            <div className="text-[9px] font-mono text-white/25 space-y-1 px-1">
              {activeRarity.perks.map(p => (
                <div key={p} className="flex items-center gap-1.5">
                  <Check className="w-2.5 h-2.5 shrink-0" style={{ color: activeRarity.color }} />
                  <span>{p}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleMint}
              disabled={mintMutation.isPending || !isApproved}
              data-testid="button-mint-nft"
              className="w-full py-4 rounded-xl font-heading tracking-widest text-sm text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: mintMutation.isPending
                  ? `rgba(255,0,80,0.4)`
                  : `linear-gradient(135deg, ${NEON.hot}, ${NEON.magenta})`,
                boxShadow: mintMutation.isPending ? "none" : `0 0 30px ${NEON.pink}40`,
              }}
            >
              {mintMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> MINTING…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" /> MINT NFT
                </span>
              )}
            </button>

            {!isApproved && (
              <p className="text-[9px] font-mono text-white/30 text-center">
                Account pending approval — contact admin
              </p>
            )}
          </div>

          {/* Your minted collection */}
          {collection.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="font-heading text-xs tracking-widest text-white/35 mb-3 flex items-center gap-2">
                <Award className="w-3.5 h-3.5" /> YOUR COLLECTION
                <Badge className="ml-auto text-[8px] border-0" style={{ background: `${NEON.pink}15`, color: NEON.pink }}>{collection.length}</Badge>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {collection.slice(0, 8).map((nft: any, i: number) => (
                  <div key={i} data-testid={`my-nft-${i}`}
                    className="flex items-center gap-2.5 p-2 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="w-8 h-10 rounded-md overflow-hidden shrink-0"
                      style={{ background: `${NEON.violet}20`, border: `1px solid ${NEON.violet}25` }}>
                      {nft.imageData && <img src={nft.imageData} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-heading text-white/60 truncate">{nft.title}</p>
                      <p className="text-[8px] font-mono text-white/25">{nft.chain} · {nft.rarity}</p>
                    </div>
                    <Heart className="w-3 h-3 ml-auto shrink-0" style={{ color: `${NEON.pink}50` }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM INFO STRIP ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: <Diamond className="w-4 h-4" style={{ color: NEON.cyan }} />,
            title: "1-of-1 Editions",
            desc: "Every RocketBabe NFT is a unique 1-of-1. Your shot, your terms, your blockchain forever.",
            color: NEON.cyan,
          },
          {
            icon: <TrendingUp className="w-4 h-4" style={{ color: NEON.green }} />,
            title: "Earn on Every Sale",
            desc: "10% perpetual royalties on secondary sales. The hotter the NFT, the more you earn for life.",
            color: NEON.green,
          },
          {
            icon: <Gift className="w-4 h-4" style={{ color: NEON.gold }} />,
            title: "VIP Collector Perks",
            desc: "SKYNT token rewards, priority access to drops, and exclusive collector-only model content.",
            color: NEON.gold,
          },
        ].map(info => (
          <div key={info.title} className="p-4 rounded-xl"
            style={{ background: `${info.color}06`, border: `1px solid ${info.color}18` }}>
            <div className="flex items-center gap-2 mb-2">
              {info.icon}
              <h3 className="font-heading text-xs tracking-wider" style={{ color: info.color }}>{info.title}</h3>
            </div>
            <p className="text-[10px] font-mono text-white/30 leading-relaxed">{info.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
