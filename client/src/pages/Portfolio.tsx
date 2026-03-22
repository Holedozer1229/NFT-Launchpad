import { useQuery } from "@tanstack/react-query";
import {
  Wallet, Layers, TrendingUp, Coins, User, ArrowUpRight, Loader2, Image as ImageIcon, Vote, FileText
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

interface PortfolioData {
  userId: number;
  username: string;
  walletCount: number;
  totalSkynt: number;
  totalEth: number;
  nftCount: number;
  nftsByRarity: Record<string, number>;
  totalYieldEarned: number;
  yieldPositionCount: number;
  yieldApr: number;
  yieldRunning: boolean;
  totalSkyntLive: number;
  governance: {
    proposalsCreated: number;
    votesCast: number;
    votingWeight: number;
  };
  onChainActivitySummary: {
    nftsMinted: number;
    walletsLinked: number;
    yieldPositions: number;
    governanceActions: number;
  };
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
  const { user } = useAuth();
  const { isConnected, address } = useAccount();

  const { data, isLoading, isError } = useQuery<PortfolioData>({
    queryKey: ["/api/portfolio/me"],
    refetchInterval: 60_000,
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6" data-testid="portfolio-page">
        <User className="w-12 h-12 text-muted-foreground opacity-30" />
        <div className="text-center space-y-2">
          <h2 className="font-heading text-lg">Sign in to view your portfolio</h2>
          <p className="text-xs text-muted-foreground font-mono">Log in to see your wallets, NFTs, yield, and governance activity</p>
        </div>
        <Link href="/auth" className="text-neon-cyan text-sm hover:underline" data-testid="link-login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="portfolio-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan" data-testid="text-portfolio-title">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">Your SKYNT holdings, NFTs, yield positions and governance activity</p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground" data-testid="text-portfolio-user">
            <User className="w-3 h-3 text-neon-cyan" />
            {data.username}
          </div>
        )}
      </div>

      {/* ── Wallet Connection Banner ──────────────────────────────────────── */}
      {!isConnected && (
        <div className="cosmic-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-dashed" data-testid="wallet-connect-banner">
          <div className="flex-1">
            <p className="text-sm font-heading text-neon-cyan">Connect your wallet</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Connect to see live on-chain balances from your linked address</p>
          </div>
          <ConnectWalletButton showBalance={false} chainStatus="icon" accountStatus="address" label="Connect Wallet" />
        </div>
      )}

      {isConnected && address && (
        <div className="cosmic-card cosmic-card-cyan p-3 flex items-center gap-3" data-testid="wallet-connected-banner">
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          <span className="font-mono text-xs text-neon-cyan">Wallet: {address.slice(0, 8)}…{address.slice(-6)}</span>
          <span className="text-[9px] text-muted-foreground ml-auto">On-chain</span>
        </div>
      )}

      {isError && (
        <div className="cosmic-card p-4 text-center text-plasma-red font-mono text-xs" data-testid="portfolio-error">
          Failed to load portfolio data
        </div>
      )}

      {/* ── Overview Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "SKYNT Balance",
            value: isLoading ? null : `${fmt(data?.totalSkynt ?? 0, 2)}`,
            sub: data?.totalSkyntLive ? "live on-chain" : `across ${data?.walletCount ?? 0} wallets`,
            icon: Coins,
            color: "text-neon-cyan",
            card: "cosmic-card-cyan",
            testId: "text-portfolio-skynt",
          },
          {
            label: "ETH Holdings",
            value: isLoading ? null : `${fmt(data?.totalEth ?? 0, 5)} ETH`,
            sub: "stored balances",
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
            label: "Yield Earned",
            value: isLoading ? null : `${fmt(data?.totalYieldEarned ?? 0, 4)} SKYNT`,
            sub: `${data?.yieldPositionCount ?? 0} active positions`,
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
            <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
              <Wallet className="w-8 h-8 opacity-20" />
              <p className="text-xs font-mono">No wallets yet</p>
              <Link href="/wallet" className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1" data-testid="link-create-wallet">
                <ArrowUpRight className="w-3 h-3" /> Create a wallet
              </Link>
            </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Yield Position ─────────────────────────────────────────────── */}
        <div className="cosmic-card cosmic-card-green p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-neon-green" />
            <h3 className="font-heading text-sm uppercase tracking-wider">Yield Position</h3>
            <span className={`ml-auto text-[9px] font-heading px-2 py-0.5 rounded-full border ${data?.yieldRunning ? "text-neon-green border-neon-green/30 bg-neon-green/10" : "text-muted-foreground border-border"}`}>
              {data?.yieldRunning ? "ACTIVE" : "PAUSED"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Earned", value: isLoading ? "—" : `${fmt(data?.totalYieldEarned ?? 0, 4)} SKYNT`, testId: "text-yield-earned" },
              { label: "Active Positions", value: isLoading ? "—" : (data?.yieldPositionCount ?? 0).toString(), testId: "text-yield-positions" },
              { label: "Current APR", value: isLoading ? "—" : `${data?.yieldApr ?? 0}%`, testId: "text-yield-apr" },
              { label: "Status", value: data?.yieldRunning ? "Compounding" : "Engine offline", testId: "text-yield-status" },
            ].map(({ label, value, testId }) => (
              <div key={label} className="bg-black/30 rounded p-3">
                <div className="text-[9px] font-heading text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
                <div className="font-mono text-sm text-neon-green" data-testid={testId}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/yield" className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1" data-testid="link-yield-page">
              <ArrowUpRight className="w-3 h-3" /> Open Yield Generator
            </Link>
          </div>
        </div>

        {/* ── Governance Activity ────────────────────────────────────────── */}
        <div className="cosmic-card cosmic-card-magenta p-4">
          <div className="flex items-center gap-2 mb-3">
            <Vote className="w-4 h-4 text-neon-magenta" />
            <h3 className="font-heading text-sm uppercase tracking-wider">Governance Activity</h3>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/30 rounded p-4 text-center" data-testid="text-governance-votes">
                <Vote className="w-5 h-5 text-neon-magenta mx-auto mb-1" />
                <div className="font-mono text-2xl font-bold text-neon-magenta">{data?.governance?.votesCast ?? 0}</div>
                <div className="text-[9px] font-heading text-muted-foreground uppercase tracking-wider mt-1">Votes Cast</div>
              </div>
              <div className="bg-black/30 rounded p-4 text-center" data-testid="text-governance-proposals">
                <FileText className="w-5 h-5 text-neon-cyan mx-auto mb-1" />
                <div className="font-mono text-2xl font-bold text-neon-cyan">{data?.governance?.proposalsCreated ?? 0}</div>
                <div className="text-[9px] font-heading text-muted-foreground uppercase tracking-wider mt-1">Proposals</div>
              </div>
              <div className="bg-black/30 rounded p-4 text-center" data-testid="text-governance-voting-weight">
                <TrendingUp className="w-5 h-5 text-neon-green mx-auto mb-1" />
                <div className="font-mono text-2xl font-bold text-neon-green">{data?.governance?.votingWeight ?? 0}</div>
                <div className="text-[9px] font-heading text-muted-foreground uppercase tracking-wider mt-1">Voting Weight</div>
              </div>
            </div>
            {data?.onChainActivitySummary && (
              <div className="mt-3 grid grid-cols-4 gap-2" data-testid="section-onchain-activity">
                {[
                  { label: "NFTs Minted", val: data.onChainActivitySummary.nftsMinted },
                  { label: "Wallets", val: data.onChainActivitySummary.walletsLinked },
                  { label: "Yield Positions", val: data.onChainActivitySummary.yieldPositions },
                  { label: "Gov Actions", val: data.onChainActivitySummary.governanceActions },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-black/20 rounded p-2 text-center">
                    <div className="font-mono text-sm font-bold text-foreground">{val}</div>
                    <div className="text-[8px] font-heading text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}
          )}
          <div className="mt-3">
            <Link href="/governance" className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1" data-testid="link-governance-page">
              <ArrowUpRight className="w-3 h-3" /> Open Governance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
