import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Sparkles, Shield, Gem, Flame, Zap, Star, Crown, Loader2, ExternalLink, Link2, ShoppingBag, Maximize2, Search, Upload, CheckCircle2, AlertCircle, ArrowRight, Wallet } from "lucide-react";
import { SUPPORTED_CHAINS, type ChainId } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import NFTPreview3D from "@/components/NFTPreview3D";

type AddressValidation =
  | { status: "empty" }
  | { status: "invalid"; error: string }
  | { status: "corrected"; address: string; original: string }
  | { status: "valid"; address: string };

function validateEthAddress(raw: string): AddressValidation {
  if (!raw.trim()) return { status: "empty" };
  const stripped = raw.trim();
  const hasPrefix = stripped.startsWith("0x") || stripped.startsWith("0X");
  const hexBody = hasPrefix ? stripped.slice(2) : stripped;

  if (!/^[0-9a-fA-F]*$/.test(hexBody)) {
    return { status: "invalid", error: "Contains invalid characters — only 0–9 and a–f are allowed" };
  }
  if (hexBody.length !== 40) {
    return { status: "invalid", error: `Must be 40 hex characters — got ${hexBody.length}` };
  }

  const normalized = "0x" + hexBody.toLowerCase();
  const isMixedCase = hexBody !== hexBody.toLowerCase() && hexBody !== hexBody.toUpperCase();
  const allLower = hexBody === hexBody.toLowerCase();

  if (!hasPrefix || (allLower && hasPrefix)) {
    // Auto-corrected: added 0x prefix or will be checksummed by server
    return { status: "corrected", address: normalized, original: stripped };
  }
  if (isMixedCase) {
    // Already appears to be EIP-55 checksummed — accept as-is
    return { status: "valid", address: (hasPrefix ? stripped : "0x" + stripped) };
  }
  return { status: "valid", address: normalized };
}

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

const OPENSEA_SUPPORTED = new Set(["ethereum", "polygon", "arbitrum", "base"]);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [listingNftId, setListingNftId] = useState<number | null>(null);
  const [previewNft, setPreviewNft] = useState<NFTItem | null>(null);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<number>>(new Set());
  const [sellerAddressInput, setSellerAddressInput] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addressValidation = useMemo(() => validateEthAddress(sellerAddressInput), [sellerAddressInput]);

  const resolvedSellerAddress =
    addressValidation.status === "valid" || addressValidation.status === "corrected"
      ? addressValidation.address
      : undefined;

  const handleListOnOpenSea = async (nftId: number) => {
    if (sellerAddressInput && !resolvedSellerAddress) return;
    setListingNftId(nftId);
    try {
      const body: Record<string, unknown> = { nftId };
      if (resolvedSellerAddress) body.sellerAddress = resolvedSellerAddress;
      const res = await apiRequest("POST", "/api/opensea/list", body);
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      if (result.success) {
        const addrDesc = resolvedSellerAddress ? ` → ${result.sellerAddress || resolvedSellerAddress}` : "";
        toast({ title: "LISTED ON OPENSEA", description: `NFT successfully listed on OpenSea marketplace.${addrDesc}` });
      } else {
        toast({ title: "OPENSEA LISTING SENT", description: result.error || "Listing submitted to OpenSea Seaport protocol." });
      }
    } catch {
      toast({ title: "LISTING FAILED", description: "Could not list on OpenSea.", variant: "destructive" });
    } finally {
      setListingNftId(null);
    }
  };

  const bulkListMutation = useMutation({
    mutationFn: async (nftIds: number[]) => {
      const body: Record<string, unknown> = { nftIds };
      if (resolvedSellerAddress) body.sellerAddress = resolvedSellerAddress;
      const res = await apiRequest("POST", "/api/opensea/bulk-list", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      setSelectedForBulk(new Set());
      toast({
        title: "BULK LISTING COMPLETE",
        description: `${data.listed}/${data.total} NFTs pushed to OpenSea`,
      });
    },
    onError: () => {
      toast({ title: "BULK LISTING FAILED", description: "Could not complete bulk listing.", variant: "destructive" });
    },
  });

  const { data: nfts = [], isLoading } = useQuery<NFTItem[]>({
    queryKey: ["/api/nfts"],
  });

  const ITEMS_PER_PAGE = 12;

  const listableNfts = nfts.filter(
    (nft) =>
      OPENSEA_SUPPORTED.has(nft.chain) &&
      nft.status !== "listed" &&
      (nft.openseaStatus === null || nft.openseaStatus === "pending" || nft.openseaStatus === "submitted" || nft.openseaStatus === "error")
  );

  const listedNfts = nfts.filter((nft) => nft.openseaUrl || nft.status === "listed");

  const filtered = nfts.filter((nft) => {
    if (filterRarity !== "All" && nft.rarity !== filterRarity) return false;
    if (filterStatus !== "all" && nft.status !== filterStatus) return false;
    if (filterChain !== "all" && nft.chain !== filterChain) return false;
    if (searchQuery && !nft.title.toLowerCase().includes(searchQuery.toLowerCase()) && !nft.tokenId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedNfts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const chainCounts: Record<string, number> = {};
  for (const nft of nfts) {
    chainCounts[nft.chain] = (chainCounts[nft.chain] || 0) + 1;
  }

  const chainIds = Object.keys(SUPPORTED_CHAINS) as ChainId[];

  const toggleBulkSelect = (nftId: number) => {
    setSelectedForBulk((prev) => {
      const next = new Set(prev);
      if (next.has(nftId)) next.delete(nftId);
      else next.add(nftId);
      return next;
    });
  };

  const selectAllListable = () => {
    if (selectedForBulk.size === listableNfts.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(listableNfts.map((n) => n.id)));
    }
  };

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

      {(listableNfts.length > 0 || listedNfts.length > 0) && (
        <div className="rounded-sm border border-[#2081E2]/30 bg-gradient-to-r from-[#2081E2]/5 via-[#2081E2]/10 to-[#2081E2]/5 p-5" data-testid="opensea-push-panel">
          <div className="flex flex-col gap-4">
            {/* Header row */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-sm bg-[#2081E2]/20 border border-[#2081E2]/30 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-6 h-6 text-[#2081E2]" />
                </div>
                <div>
                  <h2 className="font-heading text-sm font-bold text-[#2081E2] uppercase tracking-wider">
                    Push to OpenSea Marketplace
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    Seaport v1.6 Protocol  |  {listableNfts.length} ready to list  |  {listedNfts.length} already listed
                  </p>
                </div>
              </div>
            </div>

            {/* Seller address input */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-wider text-[#2081E2]/80" htmlFor="opensea-seller-address">
                <Wallet className="w-3 h-3" />
                Recipient / Seller Address
              </label>
              <div className="relative">
                <Input
                  id="opensea-seller-address"
                  data-testid="input-opensea-seller-address"
                  value={sellerAddressInput}
                  onChange={(e) => setSellerAddressInput(e.target.value)}
                  placeholder="0x... (leave blank to use NFT owner address)"
                  className={`font-mono text-xs h-9 pr-8 bg-background/40 border-[#2081E2]/20 focus:border-[#2081E2]/60 placeholder:text-muted-foreground/40 ${
                    addressValidation.status === "invalid"
                      ? "border-red-500/60 focus:border-red-500"
                      : addressValidation.status === "corrected"
                      ? "border-yellow-500/60 focus:border-yellow-500"
                      : addressValidation.status === "valid"
                      ? "border-neon-green/40 focus:border-neon-green/60"
                      : ""
                  }`}
                  spellCheck={false}
                />
                {addressValidation.status === "valid" && (
                  <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-green pointer-events-none" />
                )}
                {addressValidation.status === "corrected" && (
                  <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400 pointer-events-none" />
                )}
                {addressValidation.status === "invalid" && (
                  <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
                )}
              </div>
              {addressValidation.status === "invalid" && (
                <p className="text-[10px] font-mono text-red-400 flex items-center gap-1" data-testid="text-address-error">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {addressValidation.error}
                </p>
              )}
              {addressValidation.status === "corrected" && (
                <p className="text-[10px] font-mono text-yellow-400 flex items-center gap-1" data-testid="text-address-corrected">
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  Auto-corrected → {addressValidation.address} (checksum applied server-side)
                </p>
              )}
              {addressValidation.status === "valid" && (
                <p className="text-[10px] font-mono text-neon-green/70 flex items-center gap-1" data-testid="text-address-valid">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  Valid address — will be used as seller / recipient
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {listableNfts.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllListable}
                    className="text-[10px] font-heading uppercase tracking-wider border-[#2081E2]/30 text-[#2081E2] hover:bg-[#2081E2]/10"
                    data-testid="button-select-all-opensea"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {selectedForBulk.size === listableNfts.length ? "Deselect All" : `Select All (${listableNfts.length})`}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => bulkListMutation.mutate(Array.from(selectedForBulk))}
                    disabled={selectedForBulk.size === 0 || bulkListMutation.isPending || addressValidation.status === "invalid"}
                    className="text-[10px] font-heading uppercase tracking-wider bg-[#2081E2] hover:bg-[#2081E2]/80 text-white"
                    data-testid="button-bulk-list-opensea"
                  >
                    {bulkListMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3 mr-1" />
                    )}
                    {bulkListMutation.isPending
                      ? "Pushing..."
                      : `Push ${selectedForBulk.size} to OpenSea`}
                  </Button>
                </>
              )}

              {listableNfts.length === 0 && listedNfts.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-mono text-[#2081E2]">
                  <CheckCircle2 className="w-4 h-4" />
                  All eligible NFTs are listed
                </div>
              )}
            </div>
          </div>

          {listableNfts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {listableNfts.slice(0, 8).map((nft) => {
                const isSelected = selectedForBulk.has(nft.id);
                const rConf = rarityConfig[nft.rarity] || rarityConfig.Common;
                return (
                  <button
                    key={nft.id}
                    onClick={() => toggleBulkSelect(nft.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-sm border transition-all text-left ${
                      isSelected
                        ? "border-[#2081E2]/60 bg-[#2081E2]/15"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-[#2081E2]/30"
                    }`}
                    data-testid={`button-select-nft-${nft.id}`}
                  >
                    <img
                      src={nft.image}
                      alt={nft.title}
                      className="w-8 h-8 rounded-sm object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-heading text-foreground truncate max-w-[150px] sm:max-w-[120px]">{nft.title}</div>
                      <div className={`text-[9px] font-mono ${rConf.color.split(" ")[0]}`}>{nft.rarity} | {nft.price}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#2081E2] shrink-0" />}
                  </button>
                );
              })}
              {listableNfts.length > 8 && (
                <div className="flex items-center px-3 text-[10px] font-mono text-muted-foreground">
                  +{listableNfts.length - 8} more
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" data-testid="chain-distribution">
        {chainIds.map((cid) => {
          const c = SUPPORTED_CHAINS[cid];
          const count = chainCounts[cid] || 0;
          const isActive = filterChain === cid;
          return (
            <button
              key={cid}
              data-testid={`button-chain-stat-${cid}`}
              onClick={() => { setFilterChain(isActive ? "all" : cid); setCurrentPage(1); }}
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-search-gallery"
            type="text"
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full sm:w-64 pl-10 pr-4 py-2 bg-black/40 border border-border rounded-sm font-mono text-sm focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
          />
        </div>

        <span className="text-xs font-heading uppercase tracking-widest text-muted-foreground">Rarity:</span>
        {(["All", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"] as FilterRarity[]).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={filterRarity === r ? "default" : "ghost"}
            className={`text-xs font-mono uppercase tracking-wider ${filterRarity === r ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setFilterRarity(r); setCurrentPage(1); }}
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
            onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
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
        Showing {paginatedNfts.length} of {filtered.length} artifacts (page {currentPage} of {totalPages || 1})
        {filterChain !== "all" && ` on ${SUPPORTED_CHAINS[filterChain].name}`}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedNfts.map((nft) => {
            const rConf = rarityConfig[nft.rarity] || rarityConfig.Common;
            const chainData = SUPPORTED_CHAINS[nft.chain as ChainId];
            const explorerUrl = getExplorerUrl(nft.chain, nft.tokenId);
            const canListOnOpenSea = nft.status === "minted" && !nft.openseaUrl && OPENSEA_SUPPORTED.has(nft.chain);
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

                  {nft.openseaUrl ? (
                    <a
                      href={nft.openseaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-sm text-[10px] font-heading uppercase tracking-wider bg-[#2081E2]/15 border border-[#2081E2]/30 text-[#2081E2] hover:bg-[#2081E2]/25 transition-colors"
                      data-testid={`link-opensea-${nft.id}`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      View on OpenSea
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : canListOnOpenSea ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleListOnOpenSea(nft.id); }}
                      disabled={listingNftId === nft.id}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-sm text-[10px] font-heading uppercase tracking-wider bg-[#2081E2]/10 border border-[#2081E2]/40 text-[#2081E2] hover:bg-[#2081E2]/20 transition-all hover:border-[#2081E2]/60 disabled:opacity-50"
                      data-testid={`button-list-opensea-${nft.id}`}
                    >
                      {listingNftId === nft.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      {listingNftId === nft.id ? "Pushing to OpenSea..." : "Push to OpenSea"}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : !OPENSEA_SUPPORTED.has(nft.chain) ? (
                    <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-sm text-[10px] font-mono text-muted-foreground/50 border border-white/[0.04]">
                      <AlertCircle className="w-3 h-3" />
                      Chain not supported on OpenSea
                    </div>
                  ) : null}

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

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8" data-testid="gallery-pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-sm border border-border text-xs font-heading uppercase tracking-wider disabled:opacity-30 hover:border-primary/40 transition-colors"
            data-testid="button-prev-page"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
            Math.max(0, currentPage - 3),
            Math.min(totalPages, currentPage + 2)
          ).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-sm text-xs font-mono transition-colors ${
                currentPage === page ? "bg-primary/20 text-primary border border-primary/40" : "border border-border text-muted-foreground hover:border-primary/30"
              }`}
              data-testid={`button-page-${page}`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-sm border border-border text-xs font-heading uppercase tracking-wider disabled:opacity-30 hover:border-primary/40 transition-colors"
            data-testid="button-next-page"
          >
            Next
          </button>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 space-y-4" data-testid="text-gallery-empty">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="font-heading text-muted-foreground">No artifacts match your filters</p>
          <Button variant="ghost" className="text-primary text-xs" onClick={() => { setFilterRarity("All"); setFilterStatus("all"); setFilterChain("all"); setSearchQuery(""); setCurrentPage(1); }} data-testid="button-clear-filters">
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
