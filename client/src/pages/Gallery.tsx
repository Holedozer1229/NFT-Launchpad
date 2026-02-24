import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Sparkles, Shield, Gem, Flame, Zap, Star, Crown, Loader2, ExternalLink, Link2, ShoppingBag, Maximize2 } from "lucide-react";
import { SUPPORTED_CHAINS, type ChainId } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import NFTPreview3D from "@/components/NFTPreview3D";

type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

interface NFTItem {
  id: number;
  title: string;
  image: string;
  rarity: string;
  status: string;
  mintDate: string;
  tokenId: string;
  owner: string;
  price: string;
  chain: string;
  openseaUrl: string | null;
  openseaStatus: string | null;
  openseaListingId: string | null;
}

const rarityConfig: Record<string, { color: string; cardClass: string; icon: React.ReactNode }> = {
  Common: { color: "text-gray-400 border-gray-500/40", cardClass: "", icon: <Shield className="w-3 h-3" /> },
  Uncommon: { color: "text-neon-green border-neon-green/40", cardClass: "cosmic-card-green", icon: <Star className="w-3 h-3" /> },
  Rare: { color: "text-neon-cyan border-neon-cyan/40", cardClass: "cosmic-card-cyan", icon: <Gem className="w-3 h-3" /> },
  Epic: { color: "text-neon-magenta border-neon-magenta/40", cardClass: "cosmic-card-magenta", icon: <Sparkles className="w-3 h-3" /> },
  Legendary: { color: "text-neon-orange border-neon-orange/40", cardClass: "cosmic-card-orange", icon: <Flame className="w-3 h-3" /> },
  Mythic: { color: "text-sphinx-gold border-sphinx-gold/40", cardClass: "cosmic-card-orange", icon: <Crown className="w-3 h-3" /> },
};

const statusColors: Record<string, string> = {
  minted: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  staked: "bg-neon-green/10 text-neon-green border-neon-green/30",
  listed: "bg-neon-orange/10 text-neon-orange border-neon-orange/30",
};

type FilterRarity = "All" | Rarity;
type FilterStatus = "all" | "minted" | "staked" | "listed";
type FilterChain = "all" | ChainId;

function getExplorerUrl(chain: string, tokenId: string): string | null {
  const chainData = SUPPORTED_CHAINS[chain as ChainId];
  if (!chainData) return null;
  if (chain === "stacks") return `${chainData.explorer}/txid/${chainData.contractAddress}`;
  if (chain === "solana") return `${chainData.explorer}/address/${chainData.contractAddress}`;
  return `${chainData.explorer}/token/${chainData.contractAddress}`;
}

export default function Gallery() {
  const [filterRarity, setFilterRarity] = useState<FilterRarity>("All");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterChain, setFilterChain] = useState<FilterChain>("all");
  const [listingNftId, setListingNftId] = useState<number | null>(null);
  const [previewNft, setPreviewNft] = useState<NFTItem | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleListOnOpenSea = async (nftId: number) => {
    setListingNftId(nftId);
    try {
      const res = await apiRequest("POST", "/api/opensea/list", { nftId });
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      if (result.success) {
        toast({ title: "LISTED ON OPENSEA", description: "NFT successfully listed on OpenSea marketplace." });
      } else {
        toast({ title: "OPENSEA LISTING SENT", description: result.error || "Listing submitted to OpenSea Seaport protocol." });
      }
    } catch {
      toast({ title: "LISTING FAILED", description: "Could not list on OpenSea.", variant: "destructive" });
    } finally {
      setListingNftId(null);
    }
  };

  const { data: nfts = [], isLoading } = useQuery<NFTItem[]>({
    queryKey: ["/api/nfts"],
  });

  const filtered = nfts.filter((nft) => {
    if (filterRarity !== "All" && nft.rarity !== filterRarity) return false;
    if (filterStatus !== "all" && nft.status !== filterStatus) return false;
    if (filterChain !== "all" && nft.chain !== filterChain) return false;
    return true;
  });

  const chainCounts: Record<string, number> = {};
  for (const nft of nfts) {
    chainCounts[nft.chain] = (chainCounts[nft.chain] || 0) + 1;
  }

  const chainIds = Object.keys(SUPPORTED_CHAINS) as ChainId[];

  return (
    <div className="space-y-8" data-testid="gallery-page">
      <div>
        <h1 className="text-3xl font-heading font-bold text-primary neon-glow-cyan" data-testid="text-gallery-title">
          NFT Gallery
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1">
          Browse your minted artifacts across all chains
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2" data-testid="chain-distribution">
        {chainIds.map((cid) => {
          const c = SUPPORTED_CHAINS[cid];
          const count = chainCounts[cid] || 0;
          const isActive = filterChain === cid;
          return (
            <button
              key={cid}
              data-testid={`button-chain-stat-${cid}`}
              onClick={() => setFilterChain(isActive ? "all" : cid)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border text-left transition-all ${
                isActive
                  ? "border-white/40 bg-white/10"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
              }`}
            >
              <span className="text-base" style={{ color: c.color }}>{c.icon}</span>
              <div className="min-w-0">
                <div className="font-heading text-[10px] uppercase tracking-wider text-foreground truncate">{c.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{count} NFT{count !== 1 ? "s" : ""}</div>
              </div>
            </button>
          );
        })}
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

        {filterChain !== "all" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs font-mono text-neon-cyan ml-2"
            onClick={() => setFilterChain("all")}
            data-testid="button-clear-chain-filter"
          >
            <Link2 className="w-3 h-3 mr-1" />
            {SUPPORTED_CHAINS[filterChain].name} &times;
          </Button>
        )}
      </div>

      <div className="text-xs font-mono text-muted-foreground" data-testid="text-gallery-count">
        Showing {filtered.length} of {nfts.length} artifacts
        {filterChain !== "all" && ` on ${SUPPORTED_CHAINS[filterChain].name}`}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((nft) => {
            const rConf = rarityConfig[nft.rarity] || rarityConfig.Common;
            const chainData = SUPPORTED_CHAINS[nft.chain as ChainId];
            const explorerUrl = getExplorerUrl(nft.chain, nft.tokenId);
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

                  <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                    <Badge variant="outline" className={`${statusColors[nft.status] || ""} text-[10px] font-mono uppercase tracking-widest backdrop-blur-md`}>
                      {nft.status}
                    </Badge>
                    {chainData && (
                      <Badge variant="outline" className="text-[9px] font-mono uppercase tracking-widest backdrop-blur-md bg-black/50 border-white/20" data-testid={`badge-chain-${nft.id}`}>
                        <span style={{ color: chainData.color }}>{chainData.icon}</span>
                        <span className="ml-1">{chainData.name}</span>
                      </Badge>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewNft(nft); }}
                      className="h-8 px-3 rounded-sm text-[10px] font-heading flex items-center gap-1.5 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors backdrop-blur-md"
                      data-testid={`button-3d-preview-${nft.id}`}
                    >
                      <Maximize2 className="w-3 h-3" />
                      3D View
                    </button>
                  </div>

                  <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {nft.openseaUrl && (
                      <a
                        href={nft.openseaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 px-2.5 rounded-sm text-[10px] font-heading flex items-center gap-1 bg-[#2081E2]/20 border border-[#2081E2]/40 text-[#2081E2] hover:bg-[#2081E2]/30 transition-colors backdrop-blur-md"
                        data-testid={`link-opensea-${nft.id}`}
                      >
                        <ShoppingBag className="w-3 h-3" />
                        OpenSea
                      </a>
                    )}
                    {!nft.openseaUrl && nft.status === "minted" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleListOnOpenSea(nft.id); }}
                        disabled={listingNftId === nft.id}
                        className="h-7 px-2.5 rounded-sm text-[10px] font-heading flex items-center gap-1 bg-[#2081E2]/10 border border-[#2081E2]/30 text-[#2081E2] hover:bg-[#2081E2]/20 transition-colors backdrop-blur-md disabled:opacity-50"
                        data-testid={`button-list-opensea-${nft.id}`}
                      >
                        <ShoppingBag className="w-3 h-3" />
                        {listingNftId === nft.id ? "Listing..." : "List"}
                      </button>
                    )}
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 px-2.5 rounded-sm text-[10px] font-heading flex items-center gap-1 bg-white/10 border border-white/20 text-foreground hover:bg-white/20 transition-colors backdrop-blur-md"
                        data-testid={`link-explorer-${nft.id}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {chainData?.name}
                      </a>
                    )}
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

                  {nft.openseaUrl && (
                    <a
                      href={nft.openseaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-mono text-[#2081E2] hover:text-[#2081E2]/80 transition-colors"
                      data-testid={`link-opensea-bottom-${nft.id}`}
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>View on OpenSea</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}

                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground/60 pt-2 border-t border-border/50">
                    <span>{nft.mintDate}</span>
                    <span>{nft.owner}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 space-y-4" data-testid="text-gallery-empty">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="font-heading text-muted-foreground">No artifacts match your filters</p>
          <Button variant="ghost" className="text-primary text-xs" onClick={() => { setFilterRarity("All"); setFilterStatus("all"); setFilterChain("all"); }} data-testid="button-clear-filters">
            Clear Filters
          </Button>
        </div>
      )}

      {previewNft && (
        <NFTPreview3D nft={previewNft} onClose={() => setPreviewNft(null)} />
      )}
    </div>
  );
}
