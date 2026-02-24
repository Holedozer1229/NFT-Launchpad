import { useState, useRef, useCallback, useEffect } from "react";
import { X, Sparkles, Gem, Shield, Star, Flame, Crown, ExternalLink, RotateCcw, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NFTPreviewProps {
  nft: {
    id: number;
    title: string;
    image: string;
    rarity: string;
    status: string;
    tokenId: string;
    chain: string;
    price: string;
    owner: string;
    mintDate: string;
  };
  onClose: () => void;
}

const rarityColors: Record<string, { border: string; glow: string; text: string; icon: React.ReactNode }> = {
  Common: { border: "border-gray-500/60", glow: "rarity-glow-Common", text: "text-gray-400", icon: <Shield className="w-4 h-4" /> },
  Uncommon: { border: "border-neon-green/60", glow: "rarity-glow-Uncommon", text: "text-neon-green", icon: <Star className="w-4 h-4" /> },
  Rare: { border: "border-neon-cyan/60", glow: "rarity-glow-Rare", text: "text-neon-cyan", icon: <Gem className="w-4 h-4" /> },
  Epic: { border: "border-neon-magenta/60", glow: "rarity-glow-Epic", text: "text-neon-magenta", icon: <Sparkles className="w-4 h-4" /> },
  Legendary: { border: "border-neon-orange/60", glow: "rarity-glow-Legendary", text: "text-neon-orange", icon: <Flame className="w-4 h-4" /> },
  Mythic: { border: "border-sphinx-gold/60", glow: "rarity-glow-Mythic", text: "text-sphinx-gold", icon: <Crown className="w-4 h-4" /> },
};

function Particles({ color }: { color: string }) {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 4,
    size: 2 + Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: color,
            opacity: 0,
            animation: `particle-float ${p.duration}s ease-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function NFTPreview3D({ nft, onClose }: NFTPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const animFrameRef = useRef<number>(0);
  const angleRef = useRef(0);

  const rarity = rarityColors[nft.rarity] || rarityColors.Common;

  const particleColor = nft.rarity === "Mythic" ? "hsl(45 100% 50%)"
    : nft.rarity === "Legendary" ? "hsl(30 100% 55%)"
    : nft.rarity === "Epic" ? "hsl(300 100% 60%)"
    : nft.rarity === "Rare" ? "hsl(185 100% 50%)"
    : nft.rarity === "Uncommon" ? "hsl(145 100% 50%)"
    : "hsl(0 0% 60%)";

  useEffect(() => {
    if (!isAutoRotating) return;

    const animate = () => {
      angleRef.current += 0.3;
      const x = Math.sin(angleRef.current * 0.02) * 8;
      const y = Math.cos(angleRef.current * 0.015) * 12;
      setRotation({ x, y });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isAutoRotating]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isAutoRotating) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 25;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 25;
    setRotation({ x: rotateX, y: rotateY });
  }, [isAutoRotating]);

  const handleMouseLeave = useCallback(() => {
    if (!isAutoRotating) {
      setRotation({ x: 0, y: 0 });
    }
  }, [isAutoRotating]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isAutoRotating) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((touch.clientX - centerX) / (rect.width / 2)) * 25;
    const rotateX = -((touch.clientY - centerY) / (rect.height / 2)) * 25;
    setRotation({ x: rotateX, y: rotateY });
  }, [isAutoRotating]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" data-testid="nft-preview-overlay">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${rarity.text} ${rarity.border} text-xs font-mono uppercase tracking-widest`}>
              {rarity.icon}
              <span className="ml-1.5">{nft.rarity}</span>
            </Badge>
            <span className="font-heading text-sm text-foreground truncate">{nft.title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-close-preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="nft-preview-3d relative"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={handleTouchMove}
        >
          <Particles color={particleColor} />

          <div
            ref={cardRef}
            className={`nft-card-3d mx-auto w-full max-w-[380px] aspect-square rounded-lg border-2 ${rarity.border} ${rarity.glow} overflow-hidden relative`}
            style={{
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${zoom})`,
            }}
          >
            <div className="nft-shine" />
            <img
              src={nft.image}
              alt={nft.title}
              className="w-full h-full object-cover nft-card-3d-face"
              data-testid={`img-3d-preview-${nft.id}`}
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`p-2 rounded-sm border text-xs font-heading uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              isAutoRotating ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-muted-foreground border-border/40 hover:border-white/20"
            }`}
            data-testid="button-toggle-auto-rotate"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isAutoRotating ? "animate-spin" : ""}`} style={isAutoRotating ? { animationDuration: "3s" } : {}} />
            Auto
          </button>
          <button
            onClick={() => setIsAutoRotating(false)}
            className={`p-2 rounded-sm border text-xs font-heading uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              !isAutoRotating ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-muted-foreground border-border/40 hover:border-white/20"
            }`}
            data-testid="button-manual-rotate"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Manual
          </button>
          <button
            onClick={() => setZoom(Math.min(zoom + 0.2, 1.8))}
            className="p-2 rounded-sm border border-border/40 bg-white/5 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(Math.max(zoom - 0.2, 0.6))}
            className="p-2 rounded-sm border border-border/40 bg-white/5 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="cosmic-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="stat-label">Token ID</span>
              <p className="text-foreground mt-0.5">{nft.tokenId}</p>
            </div>
            <div>
              <span className="stat-label">Chain</span>
              <p className="text-foreground mt-0.5 uppercase">{nft.chain}</p>
            </div>
            <div>
              <span className="stat-label">Price</span>
              <p className="text-primary mt-0.5 font-bold">{nft.price}</p>
            </div>
            <div>
              <span className="stat-label">Status</span>
              <p className="text-neon-green mt-0.5 uppercase">{nft.status}</p>
            </div>
            <div>
              <span className="stat-label">Owner</span>
              <p className="text-foreground mt-0.5 truncate">{nft.owner}</p>
            </div>
            <div>
              <span className="stat-label">Minted</span>
              <p className="text-foreground mt-0.5">{nft.mintDate}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
