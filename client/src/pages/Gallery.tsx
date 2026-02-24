import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Sparkles, Shield, Gem, Flame, Zap, Star, Crown } from "lucide-react";

import missionPatch from "@/assets/mission-patch.png";
import sphinxEye from "@/assets/sphinx-eye.png";
import nftPreview from "@/assets/nft-preview.png";
import quantumTunnel from "@/assets/quantum-tunnel.png";
import rocketLaunch from "@/assets/rocket-launch.png";
import forgeHud from "@/assets/forge-hud.png";
import sphinxStream from "@/assets/sphinx-stream.png";
import heroAbstract from "@/assets/hero-abstract.png";

type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

interface NFTItem {
  id: number;
  title: string;
  image: string;
  rarity: Rarity;
  status: "minted" | "staked" | "listed";
  mintDate: string;
  tokenId: string;
  owner: string;
  price: string;
}

const rarityConfig: Record<Rarity, { color: string; cardClass: string; icon: React.ReactNode }> = {
  Common: { color: "text-gray-400 border-gray-500/40", cardClass: "", icon: <Shield className="w-3 h-3" /> },
  Uncommon: { color: "text-neon-green border-neon-green/40", cardClass: "cosmic-card-green", icon: <Star className="w-3 h-3" /> },
  Rare: { color: "text-neon-cyan border-neon-cyan/40", cardClass: "cosmic-card-cyan", icon: <Gem className="w-3 h-3" /> },
  Epic: { color: "text-neon-magenta border-neon-magenta/40", cardClass: "cosmic-card-magenta", icon: <Sparkles className="w-3 h-3" /> },
  Legendary: { color: "text-neon-orange border-neon-orange/40", cardClass: "cosmic-card-orange", icon: <Flame className="w-3 h-3" /> },
  Mythic: { color: "text-sphinx-gold border-sphinx-gold/40", cardClass: "cosmic-card-orange", icon: <Crown className="w-3 h-3" /> },
};

const mockNFTs: NFTItem[] = [
  {
    id: 1,
    title: "Oracle Genesis Fragment",
    image: sphinxEye,
    rarity: "Mythic",
    status: "minted",
    mintDate: "2025-01-15",
    tokenId: "0x7A3F...E1D9",
    owner: "0xDEAD...BEEF",
    price: "2.4 ETH",
  },
  {
    id: 2,
    title: "Mission Patch Alpha",
    image: missionPatch,
    rarity: "Legendary",
    status: "staked",
    mintDate: "2025-02-03",
    tokenId: "0x9B2C...A4F7",
    owner: "0xCAFE...BABE",
    price: "1.8 ETH",
  },
  {
    id: 3,
    title: "Quantum Tunnel Passage",
    image: quantumTunnel,
    rarity: "Epic",
    status: "listed",
    mintDate: "2025-02-18",
    tokenId: "0x4E8D...C3B2",
    owner: "0xFACE...D00D",
    price: "0.95 ETH",
  },
  {
    id: 4,
    title: "Rocket Launch Sequence",
    image: rocketLaunch,
    rarity: "Rare",
    status: "minted",
    mintDate: "2025-03-01",
    tokenId: "0x1F6A...D8E5",
    owner: "0xBEEF...CAFE",
    price: "0.45 ETH",
  },
  {
    id: 5,
    title: "Forge HUD Interface",
    image: forgeHud,
    rarity: "Uncommon",
    status: "minted",
    mintDate: "2025-03-12",
    tokenId: "0x3C9E...B7A1",
    owner: "0xDEAD...FACE",
    price: "0.22 ETH",
  },
  {
    id: 6,
    title: "Sphinx Data Stream",
    image: sphinxStream,
    rarity: "Epic",
    status: "staked",
    mintDate: "2025-03-20",
    tokenId: "0x6D4B...F2C8",
    owner: "0xBABE...DEAD",
    price: "1.1 ETH",
  },
  {
    id: 7,
    title: "NFT Preview Core",
    image: nftPreview,
    rarity: "Rare",
    status: "listed",
    mintDate: "2025-04-01",
    tokenId: "0x8A5F...E9D3",
    owner: "0xD00D...BEEF",
    price: "0.55 ETH",
  },
  {
    id: 8,
    title: "Abstract Cosmos Shard",
    image: heroAbstract,
    rarity: "Common",
    status: "minted",
    mintDate: "2025-04-10",
    tokenId: "0x2B7C...A1F6",
    owner: "0xCAFE...FACE",
    price: "0.08 ETH",
  },
];

const statusColors: Record<string, string> = {
  minted: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  staked: "bg-neon-green/10 text-neon-green border-neon-green/30",
  listed: "bg-neon-orange/10 text-neon-orange border-neon-orange/30",
};

type FilterRarity = "All" | Rarity;
type FilterStatus = "all" | "minted" | "staked" | "listed";

export default function Gallery() {
  const [filterRarity, setFilterRarity] = useState<FilterRarity>("All");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const filtered = mockNFTs.filter((nft) => {
    if (filterRarity !== "All" && nft.rarity !== filterRarity) return false;
    if (filterStatus !== "all" && nft.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-8" data-testid="gallery-page">
      <div>
        <h1 className="text-3xl font-heading font-bold text-primary neon-glow-cyan" data-testid="text-gallery-title">
          NFT Gallery
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1">
          Browse your minted artifacts from the SphinxOS Oracle
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs font-heading uppercase tracking-widest text-muted-foreground">Rarity:</span>
        {(["All", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"] as FilterRarity[]).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={filterRarity === r ? "default" : "ghost"}
            className={`text-xs font-mono uppercase tracking-wider ${filterRarity === r ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setFilterRarity(r)}
            data-testid={`button-filter-rarity-${r.toLowerCase()}`}
          >
            {r}
          </Button>
        ))}

        <span className="text-xs font-heading uppercase tracking-widest text-muted-foreground ml-4">Status:</span>
        {(["all", "minted", "staked", "listed"] as FilterStatus[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatus === s ? "default" : "ghost"}
            className={`text-xs font-mono uppercase tracking-wider ${filterStatus === s ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setFilterStatus(s)}
            data-testid={`button-filter-status-${s}`}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="text-xs font-mono text-muted-foreground" data-testid="text-gallery-count">
        Showing {filtered.length} of {mockNFTs.length} artifacts
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((nft) => {
          const rConf = rarityConfig[nft.rarity];
          return (
            <div
              key={nft.id}
              className={`cosmic-card ${rConf.cardClass} group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_hsl(var(--primary)/0.15)]`}
              data-testid={`card-nft-${nft.id}`}
            >
              <div className="relative aspect-square overflow-hidden bg-black/60">
                <img
                  src={nft.image}
                  alt={nft.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  data-testid={`img-nft-${nft.id}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="absolute top-3 left-3">
                  <Badge variant="outline" className={`${rConf.color} text-[10px] font-mono uppercase tracking-widest backdrop-blur-md bg-black/40`}>
                    {rConf.icon}
                    <span className="ml-1">{nft.rarity}</span>
                  </Badge>
                </div>

                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className={`${statusColors[nft.status]} text-[10px] font-mono uppercase tracking-widest backdrop-blur-md`}>
                    {nft.status}
                  </Badge>
                </div>

                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button size="sm" className="connect-wallet-btn text-[10px] font-heading h-7 px-3" data-testid={`button-view-nft-${nft.id}`}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <h3 className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate" data-testid={`text-nft-title-${nft.id}`}>
                  {nft.title}
                </h3>

                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary/60" />
                    {nft.tokenId}
                  </span>
                  <span className="text-primary font-bold" data-testid={`text-nft-price-${nft.id}`}>{nft.price}</span>
                </div>

                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground/60 pt-2 border-t border-border/50">
                  <span>{nft.mintDate}</span>
                  <span>{nft.owner}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 space-y-4" data-testid="text-gallery-empty">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="font-heading text-muted-foreground">No artifacts match your filters</p>
          <Button variant="ghost" className="text-primary text-xs" onClick={() => { setFilterRarity("All"); setFilterStatus("all"); }} data-testid="button-clear-filters">
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
