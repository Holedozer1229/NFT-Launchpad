import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { SUPPORTED_CHAINS, RARITY_TIERS } from "@shared/schema";
import {
  Store, ShoppingCart, Tag, Filter, Plus, X, ExternalLink,
  Gem, Loader2, TrendingUp, Users, Package, Coins, Search
} from "lucide-react";

const CHAIN_LIST = [
  { id: "all", label: "All Chains", icon: "◈", color: "#9ca3af" },
  ...Object.entries(SUPPORTED_CHAINS).map(([id, c]) => ({ id, label: c.name, icon: c.icon, color: c.color })),
];

const RARITY_COLORS: Record<string, string> = {
  mythic: "text-neon-magenta border-neon-magenta/40 bg-neon-magenta/10",
  legendary: "text-neon-orange border-neon-orange/40 bg-neon-orange/10",
  rare: "text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10",
  common: "text-neon-green border-neon-green/40 bg-neon-green/10",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-neon-green border-neon-green/40",
  sold: "text-muted-foreground border-white/10",
  cancelled: "text-red-400 border-red-400/30",
};

const NFT_IMAGES = [
  "/assets/sphinx-eye.png",
  "/assets/mission-patch.png",
  "/assets/quantum-tunnel.png",
  "/assets/rocket-launch.png",
  "/assets/forge-hud.png",
  "/assets/sphinx-stream.png",
  "/assets/nft-preview.png",
  "/assets/hero-abstract.png",
];

export default function Marketplace() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chainFilter, setChainFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"browse" | "my-listings">("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [sellDialogOpen, setSellDialogOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newRarity, setNewRarity] = useState("common");
  const [newChain, setNewChain] = useState("ethereum");
  const [newCurrency, setNewCurrency] = useState("ETH");

  const { data: listings, isLoading } = useQuery<any[]>({
    queryKey: ["/api/marketplace/listings", chainFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (chainFilter !== "all") params.set("chain", chainFilter);
      params.set("status", "active");
      const res = await fetch(`/api/marketplace/listings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000,
    enabled: viewMode === "browse",
  });

  const { data: myListings } = useQuery<any[]>({
    queryKey: ["/api/marketplace/my-listings"],
    enabled: viewMode === "my-listings",
  });

  const { data: myNfts } = useQuery<any[]>({
    queryKey: ["/api/nfts"],
  });

  const listMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/marketplace/list", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-listings"] });
      toast({ title: "Listed!", description: "Your NFT is now on the marketplace" });
      setSellDialogOpen(false);
      setNewTitle("");
      setNewPrice("");
    },
    onError: () => toast({ title: "Error", description: "Failed to create listing", variant: "destructive" }),
  });

  const buyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/marketplace/buy/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Purchase failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
      toast({ title: "NFT Purchased!", description: `Transaction: ${data.txHash?.slice(0, 12)}...` });
    },
    onError: (err: any) => toast({ title: "Purchase Failed", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/marketplace/cancel/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-listings"] });
      toast({ title: "Listing Cancelled" });
    },
  });

  const handleCreateListing = () => {
    if (!newTitle.trim() || !newPrice.trim()) return;
    const image = NFT_IMAGES[Math.floor(Math.random() * NFT_IMAGES.length)];
    const chainData = SUPPORTED_CHAINS[newChain as keyof typeof SUPPORTED_CHAINS];
    listMutation.mutate({
      title: newTitle,
      image,
      rarity: newRarity,
      chain: newChain,
      price: newPrice,
      currency: newCurrency,
      tokenId: "0x" + Math.random().toString(16).slice(2, 10),
      contractAddress: chainData?.contractAddress || "0x0000",
    });
  };

  const displayedListings = viewMode === "browse" ? (listings || []) : (myListings || []);

  const searchFiltered = displayedListings.filter((listing: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return listing.title?.toLowerCase().includes(q) || listing.sellerUsername?.toLowerCase().includes(q);
  });

  const listingsArr = listings || [];
  const { totalVolume, chainSet } = listingsArr.reduce(
    (acc: { totalVolume: number; chainSet: Set<string> }, l: any) => {
      acc.totalVolume += parseFloat(l.price || "0");
      acc.chainSet.add(l.chain);
      return acc;
    },
    { totalVolume: 0, chainSet: new Set<string>() }
  );
  const stats = {
    totalActive: listingsArr.length,
    totalVolume: totalVolume.toFixed(2),
    avgPrice: listingsArr.length > 0 ? (totalVolume / listingsArr.length).toFixed(3) : "0",
    chains: chainSet.size,
  };

  return (
    <div className="space-y-6" data-testid="marketplace-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-widest text-neon-cyan" data-testid="text-page-title">
            NFT MARKETPLACE
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            MULTI-CHAIN // BUY & SELL // SEAPORT PROTOCOL
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-neon-cyan to-neon-green text-black font-heading tracking-wider" data-testid="button-sell-nft">
                <Plus className="w-4 h-4 mr-1" /> SELL NFT
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black/95 border-neon-cyan/30 max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading tracking-widest text-neon-cyan flex items-center gap-2">
                  <Tag className="w-5 h-5" /> LIST NFT FOR SALE
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="font-mono text-xs text-muted-foreground">NFT TITLE</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Enter NFT name..."
                    className="bg-white/5 border-white/10 font-mono"
                    data-testid="input-nft-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-mono text-xs text-muted-foreground">PRICE</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-white/5 border-white/10 font-mono"
                      data-testid="input-nft-price"
                    />
                  </div>
                  <div>
                    <Label className="font-mono text-xs text-muted-foreground">CURRENCY</Label>
                    <Select value={newCurrency} onValueChange={setNewCurrency}>
                      <SelectTrigger className="bg-white/5 border-white/10 font-mono" data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="SKYNT">SKYNT</SelectItem>
                        <SelectItem value="STX">STX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-mono text-xs text-muted-foreground">RARITY</Label>
                    <Select value={newRarity} onValueChange={setNewRarity}>
                      <SelectTrigger className="bg-white/5 border-white/10 font-mono" data-testid="select-rarity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RARITY_TIERS).map(([key, tier]) => (
                          <SelectItem key={key} value={key}>{tier.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-mono text-xs text-muted-foreground">CHAIN</Label>
                    <Select value={newChain} onValueChange={setNewChain}>
                      <SelectTrigger className="bg-white/5 border-white/10 font-mono" data-testid="select-chain">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SUPPORTED_CHAINS).map(([id, c]) => (
                          <SelectItem key={id} value={id}>{c.icon} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-neon-cyan via-neon-green to-neon-orange text-black font-heading tracking-widest"
                  onClick={handleCreateListing}
                  disabled={listMutation.isPending || !newTitle.trim() || !newPrice.trim()}
                  data-testid="button-confirm-list"
                >
                  {listMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
                  LIST ON MARKETPLACE
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="cosmic-card-cyan p-3">
          <div className="font-mono text-[10px] text-neon-cyan/70 uppercase">Active Listings</div>
          <div className="font-heading text-xl text-neon-cyan flex items-center gap-1" data-testid="text-active-count">
            <Package className="w-4 h-4" /> {stats.totalActive}
          </div>
        </div>
        <div className="cosmic-card-green p-3">
          <div className="font-mono text-[10px] text-neon-green/70 uppercase">Total Volume</div>
          <div className="font-heading text-xl text-neon-green flex items-center gap-1" data-testid="text-total-volume">
            <Coins className="w-4 h-4" /> {stats.totalVolume}
          </div>
        </div>
        <div className="cosmic-card-orange p-3">
          <div className="font-mono text-[10px] text-neon-orange/70 uppercase">Avg Price</div>
          <div className="font-heading text-xl text-neon-orange flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> {stats.avgPrice}
          </div>
        </div>
        <div className="cosmic-card-magenta p-3">
          <div className="font-mono text-[10px] text-neon-magenta/70 uppercase">Chains Active</div>
          <div className="font-heading text-xl text-neon-magenta flex items-center gap-1">
            <Users className="w-4 h-4" /> {stats.chains}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="bg-black/50 border border-white/10">
            <TabsTrigger value="browse" className="font-heading tracking-wider text-xs data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan" data-testid="tab-browse">
              <Store className="w-3 h-3 mr-1" /> BROWSE
            </TabsTrigger>
            <TabsTrigger value="my-listings" className="font-heading tracking-wider text-xs data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green" data-testid="tab-my-listings">
              <Tag className="w-3 h-3 mr-1" /> MY LISTINGS
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === "browse" && (
          <div className="flex flex-wrap gap-1.5 items-center" data-testid="chain-filters">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                data-testid="input-search-marketplace"
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-10 pr-4 py-1.5 bg-black/40 border border-white/10 rounded-sm font-mono text-xs focus:outline-none focus:border-neon-cyan/60 transition-colors placeholder:text-muted-foreground/40"
              />
            </div>
            {CHAIN_LIST.map((c) => (
              <button
                key={c.id}
                data-testid={`filter-chain-${c.id}`}
                className={`px-3 py-1.5 rounded-sm font-mono text-[11px] border transition-all ${
                  chainFilter === c.id
                    ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                    : "border-white/10 text-muted-foreground hover:border-white/30"
                }`}
                onClick={() => setChainFilter(c.id)}
              >
                <span className="mr-1">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
        </div>
      ) : searchFiltered.length === 0 ? (
        <Card className="cosmic-card bg-black/50 border-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Store className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="font-heading text-lg text-muted-foreground tracking-wider">
              {viewMode === "browse" ? "NO ACTIVE LISTINGS" : "YOU HAVE NO LISTINGS"}
            </p>
            <p className="font-mono text-xs text-muted-foreground/50 mt-1">
              {viewMode === "browse" ? "Be the first to list an NFT on the marketplace" : "Click 'Sell NFT' to create your first listing"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="listings-grid">
          {searchFiltered.map((listing: any) => {
            const chainData = SUPPORTED_CHAINS[listing.chain as keyof typeof SUPPORTED_CHAINS];
            const isOwner = user?.id === listing.sellerId;
            return (
              <Card key={listing.id} className="cosmic-card bg-black/60 border-primary/10 hover:border-neon-cyan/30 transition-all group overflow-hidden" data-testid={`listing-card-${listing.id}`}>
                <div className="relative aspect-square overflow-hidden bg-black/50">
                  <img
                    src={listing.image}
                    alt={listing.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/assets/nft-preview.png"; }}
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <Badge variant="outline" className={`text-[9px] font-heading ${RARITY_COLORS[listing.rarity] || RARITY_COLORS.common}`}>
                      {listing.rarity?.toUpperCase()}
                    </Badge>
                    {listing.status !== "active" && (
                      <Badge variant="outline" className={`text-[9px] font-heading ${STATUS_COLORS[listing.status] || ""}`}>
                        {listing.status?.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  {chainData && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="text-[9px] font-mono border-white/20" style={{ color: chainData.color }}>
                        {chainData.icon} {chainData.name}
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <div className="font-heading text-sm tracking-wider text-foreground truncate">{listing.title}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">by {listing.sellerUsername}</div>
                  </div>
                </div>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[9px] text-muted-foreground uppercase">Price</div>
                      <div className="font-heading text-lg text-neon-green flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        {listing.price} <span className="text-xs text-muted-foreground">{listing.currency}</span>
                      </div>
                    </div>
                    {listing.tokenId && (
                      <div className="text-right">
                        <div className="font-mono text-[9px] text-muted-foreground uppercase">Token</div>
                        <div className="font-mono text-[10px] text-primary/60">{listing.tokenId.slice(0, 8)}...</div>
                      </div>
                    )}
                  </div>

                  {listing.status === "active" && (
                    <div className="flex gap-2">
                      {isOwner ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-[10px] h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 font-heading tracking-wider"
                          onClick={() => cancelMutation.mutate(listing.id)}
                          disabled={cancelMutation.isPending}
                          data-testid={`button-cancel-${listing.id}`}
                        >
                          <X className="w-3 h-3 mr-1" /> CANCEL
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1 text-[10px] h-8 bg-gradient-to-r from-neon-cyan to-neon-green text-black font-heading tracking-wider"
                          onClick={() => buyMutation.mutate(listing.id)}
                          disabled={buyMutation.isPending}
                          data-testid={`button-buy-${listing.id}`}
                        >
                          {buyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ShoppingCart className="w-3 h-3 mr-1" />}
                          BUY NOW
                        </Button>
                      )}
                      {listing.openseaUrl && (
                        <a href={listing.openseaUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-[10px] h-8 border-white/10">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </div>
                  )}

                  {listing.status === "sold" && (
                    <div className="text-center py-1">
                      <Badge variant="outline" className="text-[9px] border-neon-green/30 text-neon-green font-heading">
                        SOLD TO {listing.buyerUsername}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
