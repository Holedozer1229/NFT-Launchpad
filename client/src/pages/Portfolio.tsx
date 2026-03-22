import { useQuery } from "@tanstack/react-query";
import {
  Wallet, Layers, TrendingUp, Coins, User, ArrowUpRight, Loader2, Image as ImageIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface PortfolioData {
  userId: number;
  username: string;
  walletCount: number;
  totalSkynt: number;
  totalEth: number;
  nftCount: number;
  nftsByRarity: Record<string, number>;
  yieldShare: number;
  yieldApr: number;
  yieldRunning: boolean;
  recentNfts: {
    id: number;
    name: string;
    rarity: string | null;
    imageUrl: string | null;
    mintedAt: string | null;
  }[];
  wallets: {
    id: number;
    name: string | null;
    address: string;
    skyntBalance: string | null;
    ethBalance: string | null;
  }[];
}

const RARITY_COLORS: Record<string, string> = {
  legendary: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  epic: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  rare: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  uncommon: "text-green-400 border-green-400/30 bg-green-400/10",
  common: "text-slate-400 border-slate-400/30 bg-slate-400/10",
};

function fmt(n: number, decimals = 4) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export default function Portfolio() {
  const { data, isLoading, isError } = useQuery<PortfolioData>({
    queryKey: ["/api/portfolio/me"],
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6" data-testid="portfolio-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan" data-testid="text-portfolio-title">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">Your SKYNT holdings, NFTs, and yield position</p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground" data-testid="text-portfolio-user">
            <User className="w-3 h-3 text-neon-cyan" />
            {data.username}
          </div>
        )}
      </div>

      {isError && (
        <div className="cosmic-card p-6 text-center text-plasma-red font-mono text-xs" data-testid="portfolio-error">
          Failed to load portfolio — please log in to continue.
        </div>
      )}

      {/* ── Overview Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "SKYNT Balance",
            value: isLoading ? null : `${fmt(data?.totalSkynt ?? 0, 2)}`,
            sub: "across all wallets",
            icon: Coins,
            color: "text-neon-cyan",
            card: "cosmic-card-cyan",
            testId: "text-portfolio-skynt",
          },
          {
            label: "ETH Holdings",
            value: isLoading ? null : `${fmt(data?.totalEth ?? 0, 5)} ETH`,
            sub: `${data?.walletCount ?? 0} wallets`,
            icon: Wallet,
            color: "text-neon-magenta",
            card: "cosmic-card-magenta",
            testId: "text-portfolio-eth",
          },
          {
            label: "NFTs Owned",
            value: isLoading ? null : (data?.nftCount ?? 0).toLocaleString(),
            sub: "minted on-chain",
            icon: Layers,
            color: "text-neon-orange",
            card: "cosmic-card-orange",
            testId: "text-portfolio-nfts",
          },
          {
            label: "Yield Share",
            value: isLoading ? null : `${fmt(data?.yieldShare ?? 0, 4)} SKYNT`,
            sub: `${data?.yieldApr ?? 0}% APR ${data?.yieldRunning ? "↑" : "(paused)"}`,
            icon: TrendingUp,
            color: "text-neon-green",
            card: "cosmic-card-green",
            testId: "text-portfolio-yield",
          },
        ].map((stat) => (
          <div key={stat.label} className={`cosmic-card ${stat.card} p-4`} data-testid={stat.testId}>
            <div className="flex items-center gap-1.5 mb-2">
              <stat.icon className={`w-3 h-3 ${stat.color}`} />
              <span className="text-[9px] font-heading tracking-widest text-muted-foreground uppercase">{stat.label}</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mb-1" />
            ) : (
              <div className={`font-mono text-base font-bold ${stat.color}`}>{stat.value}</div>
            )}
            <span className="text-[9px] text-muted-foreground font-mono">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Wallets ───────────────────────────────────────────────────── */}
        <div className="cosmic-card cosmic-card-cyan p-4">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-neon-cyan" />
            <h3 className="font-heading text-sm uppercase tracking-wider">Wallets</h3>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (data?.wallets ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono text-center py-4">No wallets yet</p>
          ) : (
            <div className="space-y-2">
              {(data?.wallets ?? []).map((w) => (
                <div key={w.id} className="flex items-center justify-between p-2.5 bg-black/30 rounded border border-border" data-testid={`wallet-row-${w.id}`}>
                  <div>
                    <div className="font-mono text-[11px] text-neon-cyan">{w.address.slice(0, 8)}...{w.address.slice(-6)}</div>
                    <div className="text-[9px] text-muted-foreground">{w.name ?? "Wallet"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[11px]">{fmt(parseFloat(w.skyntBalance ?? "0"), 2)} SKYNT</div>
                    <div className="font-mono text-[9px] text-muted-foreground">{fmt(parseFloat(w.ethBalance ?? "0"), 5)} ETH</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── NFT Rarity Breakdown ───────────────────────────────────────── */}
        <div className="cosmic-card cosmic-card-orange p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-neon-orange" />
            <h3 className="font-heading text-sm uppercase tracking-wider">NFT Rarity Breakdown</h3>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : Object.keys(data?.nftsByRarity ?? {}).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
              <Layers className="w-8 h-8 opacity-20" />
              <p className="text-xs font-mono">No NFTs minted yet</p>
              <Link href="/" className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1" data-testid="link-mint-nft">
                <ArrowUpRight className="w-3 h-3" /> Mint your first NFT
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(data?.nftsByRarity ?? {})
                .sort(([, a], [, b]) => b - a)
                .map(([rarity, count]) => (
                  <div key={rarity} className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono ${RARITY_COLORS[rarity] ?? RARITY_COLORS.common}`} data-testid={`rarity-row-${rarity}`}>
                    <span className="capitalize font-bold">{rarity}</span>
                    <span>{count} NFT{count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent NFTs Grid ───────────────────────────────────────────────── */}
      {(data?.recentNfts ?? []).length > 0 && (
        <div className="cosmic-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-neon-magenta" />
              <h3 className="font-heading text-sm uppercase tracking-wider">Recent NFTs</h3>
            </div>
            <Link href="/gallery" className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1" data-testid="link-view-all-nfts">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(data?.recentNfts ?? []).map((nft) => (
              <div key={nft.id} className="relative rounded border border-border bg-black/30 overflow-hidden group" data-testid={`nft-card-${nft.id}`}>
                <div className="aspect-square bg-black/50 flex items-center justify-center">
                  {nft.imageUrl ? (
                    <img
                      src={nft.imageUrl}
                      alt={nft.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground opacity-30" />
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[10px] font-mono truncate">{nft.name}</div>
                  <div className={`text-[8px] font-bold uppercase ${RARITY_COLORS[nft.rarity ?? "common"]?.split(" ")[0] ?? "text-muted-foreground"}`}>
                    {nft.rarity ?? "common"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Yield Info ─────────────────────────────────────────────────────── */}
      <div className="cosmic-card cosmic-card-green p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-neon-green" />
          <h3 className="font-heading text-sm uppercase tracking-wider">Yield Position</h3>
          <span className={`ml-auto text-[9px] font-heading px-2 py-0.5 rounded-full border ${data?.yieldRunning ? "text-neon-green border-neon-green/30 bg-neon-green/10" : "text-muted-foreground border-border"}`}>
            {data?.yieldRunning ? "ACTIVE" : "PAUSED"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Yield Share Estimate", value: isLoading ? "—" : `${fmt(data?.yieldShare ?? 0, 4)} SKYNT` },
            { label: "APR", value: isLoading ? "—" : `${data?.yieldApr ?? 0}%` },
            { label: "Status", value: data?.yieldRunning ? "Compounding" : "Engine offline" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-black/30 rounded p-3">
              <div className="text-[9px] font-heading text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
              <div className="font-mono text-sm text-neon-green">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Link href="/yield" className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1" data-testid="link-yield-page">
            <ArrowUpRight className="w-3 h-3" /> Open Yield Generator
          </Link>
        </div>
      </div>
    </div>
  );
}
