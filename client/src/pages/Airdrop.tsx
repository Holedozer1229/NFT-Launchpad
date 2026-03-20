import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Coins, Clock, CheckCircle2, Zap, Users, ExternalLink, Gift } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AirdropEntry {
  id: number;
  title: string;
  description: string;
  tokenAmount: string;
  totalSupply: number;
  claimedCount: number;
  eligibilityType: string;
  minSkynt: string;
  minNfts: number;
  requiredChain: string | null;
  status: string;
  startDate: string;
  endDate: string;
  claimed?: boolean;
  claimTxHash?: string | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-[10px]">● LIVE</Badge>;
  if (status === "upcoming") return <Badge className="bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 font-mono text-[10px]">◌ UPCOMING</Badge>;
  return <Badge className="bg-muted/30 text-muted-foreground border-border/40 font-mono text-[10px]">✕ ENDED</Badge>;
}

function EligibilityTag({ type }: { type: string }) {
  const labels: Record<string, string> = {
    all: "Open to All",
    holders: "NFT Holders",
    miners: "Miners",
    stakers: "Stakers",
  };
  return <span className="font-mono text-[10px] text-muted-foreground">{labels[type] ?? type}</span>;
}

function AirdropCard({ airdrop }: { airdrop: AirdropEntry }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const pct = Math.min(100, Math.round((airdrop.claimedCount / airdrop.totalSupply) * 100));
  const isActive = airdrop.status === "active";
  const isEnded = airdrop.status === "ended";
  const isSoldOut = airdrop.claimedCount >= airdrop.totalSupply;

  const claim = useMutation({
    mutationFn: () => apiRequest("POST", `/api/airdrops/${airdrop.id}/claim`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/airdrops"] });
      toast({ title: "Airdrop claimed!", description: `${airdrop.tokenAmount} SKYNT is on its way to your wallet.` });
    },
    onError: (e: any) => {
      toast({ title: "Claim failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div
      className={`cosmic-card p-6 flex flex-col gap-4 transition-all ${isActive && !airdrop.claimed && !isSoldOut ? "cosmic-card-cyan" : ""}`}
      data-testid={`card-airdrop-${airdrop.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-foreground leading-tight" data-testid={`text-airdrop-title-${airdrop.id}`}>{airdrop.title}</h3>
            <EligibilityTag type={airdrop.eligibilityType} />
          </div>
        </div>
        <StatusBadge status={airdrop.status} />
      </div>

      <p className="text-xs text-muted-foreground font-mono leading-relaxed">{airdrop.description}</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Coins className="w-4 h-4 text-neon-cyan mx-auto mb-1" />
          <p className="font-heading font-bold text-sm text-neon-cyan">{parseFloat(airdrop.tokenAmount).toLocaleString()}</p>
          <p className="font-mono text-[9px] text-muted-foreground">SKYNT / claim</p>
        </div>
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Users className="w-4 h-4 text-neon-green mx-auto mb-1" />
          <p className="font-heading font-bold text-sm text-neon-green">{airdrop.claimedCount.toLocaleString()}</p>
          <p className="font-mono text-[9px] text-muted-foreground">claimed</p>
        </div>
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Zap className="w-4 h-4 text-neon-orange mx-auto mb-1" />
          <p className="font-heading font-bold text-sm text-neon-orange">{(airdrop.totalSupply - airdrop.claimedCount).toLocaleString()}</p>
          <p className="font-mono text-[9px] text-muted-foreground">remaining</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>Distribution</span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {isEnded
            ? `Ended ${formatDistanceToNow(new Date(airdrop.endDate), { addSuffix: true })}`
            : isActive
            ? `Ends ${formatDistanceToNow(new Date(airdrop.endDate), { addSuffix: true })}`
            : `Starts ${formatDistanceToNow(new Date(airdrop.startDate), { addSuffix: true })}`}
        </span>
        {airdrop.requiredChain && (
          <span className="text-neon-cyan/70">{airdrop.requiredChain}</span>
        )}
      </div>

      {airdrop.claimed ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-green/10 border border-neon-green/20" data-testid={`status-claimed-${airdrop.id}`}>
          <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-neon-green font-mono">Claimed successfully</p>
            {airdrop.claimTxHash && (
              <a
                href={`https://etherscan.io/tx/${airdrop.claimTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
              >
                {airdrop.claimTxHash.slice(0, 18)}…<ExternalLink className="w-3 h-3 inline shrink-0" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <Button
          className="w-full font-heading font-bold tracking-wider"
          variant={isActive && !isSoldOut ? "default" : "outline"}
          disabled={!isActive || isSoldOut || claim.isPending}
          onClick={() => claim.mutate()}
          data-testid={`button-claim-airdrop-${airdrop.id}`}
        >
          {claim.isPending ? "Claiming…" : isSoldOut ? "Sold Out" : isEnded ? "Ended" : !isActive ? "Not Started" : "Claim Airdrop"}
        </Button>
      )}
    </div>
  );
}

export default function AirdropPage() {
  const { user } = useAuth();
  const { data: airdrops = [], isLoading } = useQuery<AirdropEntry[]>({
    queryKey: ["/api/airdrops"],
  });

  const active = airdrops.filter(a => a.status === "active");
  const upcoming = airdrops.filter(a => a.status === "upcoming");
  const ended = airdrops.filter(a => a.status === "ended");

  const totalDistributed = airdrops.reduce((sum, a) => sum + a.claimedCount * parseFloat(a.tokenAmount), 0);

  return (
    <div data-testid="airdrop-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-3 text-primary neon-glow-cyan">
            <Gift className="w-6 h-6" /> SKYNT Airdrops
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Claim your free SKYNT token allocations</p>
        </div>
        <div className="hidden md:flex gap-4">
          <div className="text-right">
            <p className="font-heading font-bold text-lg text-neon-cyan">{totalDistributed.toLocaleString()}</p>
            <p className="font-mono text-[10px] text-muted-foreground">SKYNT distributed</p>
          </div>
          <div className="text-right">
            <p className="font-heading font-bold text-lg text-neon-green">{active.length}</p>
            <p className="font-mono text-[10px] text-muted-foreground">live now</p>
          </div>
        </div>
      </div>

      {!user && (
        <div className="cosmic-card p-5 mb-8 border-neon-cyan/30 bg-neon-cyan/5 text-center">
          <p className="font-mono text-xs text-neon-cyan">Connect your account to claim airdrops and track your claims.</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="cosmic-card p-6 animate-pulse space-y-4 h-72">
              <div className="h-4 bg-muted/30 rounded w-2/3" />
              <div className="h-3 bg-muted/20 rounded w-full" />
              <div className="h-3 bg-muted/20 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : airdrops.length === 0 ? (
        <div className="cosmic-card p-12 text-center">
          <Gift className="w-10 h-10 text-primary/20 mx-auto mb-3" />
          <p className="font-heading text-base text-muted-foreground">No airdrops yet</p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">Check back soon — the protocol distributes SKYNT regularly.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="font-heading font-bold text-sm text-neon-green mb-4 flex items-center gap-2 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" /> Live Airdrops
              </h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {active.map(a => <AirdropCard key={a.id} airdrop={a} />)}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="font-heading font-bold text-sm text-neon-cyan mb-4 uppercase tracking-widest">Upcoming</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {upcoming.map(a => <AirdropCard key={a.id} airdrop={a} />)}
              </div>
            </section>
          )}
          {ended.length > 0 && (
            <section>
              <h2 className="font-heading font-bold text-sm text-muted-foreground mb-4 uppercase tracking-widest">Past Airdrops</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-60">
                {ended.map(a => <AirdropCard key={a.id} airdrop={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
