import { useState, type CSSProperties } from "react";
import {
  Vote, Shield, Zap, Clock, CheckCircle, XCircle, Minus, Loader2,
  TrendingUp, Lock, Coins, Server, Globe, Cpu, Activity, Hash,
  ChevronDown, ChevronUp, Plus, AlertTriangle, ExternalLink, Users,
  Settings, Play, Database, ArrowRight
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import type { GovernanceProposal, PriceDriverParamKey } from "@shared/schema";
import { PRICE_DRIVER_PARAMS } from "@shared/schema";

const CATEGORY_COLORS: Record<string, string> = {
  protocol: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5",
  treasury: "text-neon-green border-neon-green/30 bg-neon-green/5",
  parameter: "text-neon-orange border-neon-orange/30 bg-neon-orange/5",
  upgrade: "text-neon-magenta border-neon-magenta/30 bg-neon-magenta/5",
  community: "text-primary border-primary/30 bg-primary/5",
  price_driver_params: "text-neon-orange border-neon-orange/40 bg-neon-orange/10",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: "Active", color: "text-neon-green bg-neon-green/10 border-neon-green/20", icon: Activity },
  passed: { label: "Passed", color: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
  executed: { label: "Executed", color: "text-primary bg-primary/10 border-primary/20", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground bg-white/5 border-white/10", icon: XCircle },
};

interface VoteRecord {
  id: number; proposalId: number; voterId: number; choice: string; weight: number; reason: string | null;
}

interface ExecutionRecord {
  proposalId: number;
  title: string;
  category: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  executedAt: string;
}

interface ProtocolSetting {
  key: string;
  value: string;
  updatedBy: string;
  updatedAt: string | null;
}

interface RosettaStatus {
  blockchain: string; network: string; symbol: string; decimals: number;
  rosettaVersion: string; blockHeight: number; syncStatus: string;
  supportedOperations: string[]; constructionEndpoints: number;
  dataEndpoints: number; totalEndpoints: number;
}

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m left`;
}

interface PdPayload { parameter: string; newValue: string; currentValue?: string }
function isPdPayload(v: unknown): v is PdPayload {
  return typeof v === "object" && v !== null && "parameter" in v && "newValue" in v;
}
function PdParamBadge({ payload }: { payload: unknown }) {
  if (!isPdPayload(payload)) return null;
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono p-2.5 bg-neon-orange/5 border border-neon-orange/20 rounded-sm">
      <Settings className="w-3 h-3 text-neon-orange shrink-0" />
      <span className="text-neon-orange font-bold">WILL CHANGE:</span>
      <span className="text-muted-foreground truncate max-w-[120px]">{payload.parameter}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-neon-green font-bold">{payload.newValue}</span>
      {payload.currentValue && (
        <span className="text-muted-foreground">(was: {payload.currentValue})</span>
      )}
    </div>
  );
}

function ProposalCard({ proposal, myVote, onVote, isPending }: {
  proposal: GovernanceProposal;
  myVote: VoteRecord | null | undefined;
  onVote: (id: number, choice: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = (proposal.votesFor || 0) + (proposal.votesAgainst || 0) + (proposal.votesAbstain || 0);
  const forPct = total > 0 ? ((proposal.votesFor || 0) / total) * 100 : 0;
  const againstPct = total > 0 ? ((proposal.votesAgainst || 0) / total) * 100 : 0;
  const abstainPct = total > 0 ? ((proposal.votesAbstain || 0) / total) * 100 : 0;
  const quorumPct = Math.min(100, (total / (proposal.quorumRequired || 100)) * 100);
  const statusCfg = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;
  const isActive = proposal.status === "active";

  return (
    <div className="cosmic-card p-5 space-y-4" data-testid={`card-proposal-${proposal.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className={`text-[9px] uppercase font-heading border ${CATEGORY_COLORS[proposal.category] || CATEGORY_COLORS.protocol}`}>
              {proposal.category}
            </Badge>
            <Badge className={`text-[9px] uppercase font-heading border ${statusCfg.color}`}>
              <StatusIcon className="w-2.5 h-2.5 mr-1" />
              {statusCfg.label}
            </Badge>
            {isActive && (
              <span className="text-[9px] font-mono text-neon-orange flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeLeft(proposal.endsAt as unknown as string)}
              </span>
            )}
          </div>
          <h3 className="font-heading text-sm text-white leading-snug" data-testid={`text-proposal-title-${proposal.id}`}>
            {proposal.title}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] text-muted-foreground font-mono">GIP-{String(proposal.id).padStart(3, "0")}</div>
          <div className="text-[9px] text-muted-foreground font-mono">{proposal.timelockHours}h timelock</div>
        </div>
      </div>

      {/* Vote bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-neon-green w-14">FOR {forPct.toFixed(0)}%</span>
          <Progress value={forPct} className="h-1.5 flex-1 bg-white/5" style={{ "--progress-color": "hsl(145 100% 50%)" } as CSSProperties} />
          <span className="text-[9px] font-mono text-neon-green w-8 text-right">{proposal.votesFor}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-red-400 w-14">AGAINST {againstPct.toFixed(0)}%</span>
          <Progress value={againstPct} className="h-1.5 flex-1 bg-white/5" />
          <span className="text-[9px] font-mono text-red-400 w-8 text-right">{proposal.votesAgainst}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-muted-foreground w-14">ABSTAIN {abstainPct.toFixed(0)}%</span>
          <Progress value={abstainPct} className="h-1.5 flex-1 bg-white/5" />
          <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{proposal.votesAbstain}</span>
        </div>
      </div>

      {/* Quorum */}
      <div className="flex items-center gap-3 text-[9px] font-mono">
        <span className="text-muted-foreground shrink-0">QUORUM</span>
        <Progress value={quorumPct} className="h-1 flex-1 bg-white/5" />
        <span className={quorumPct >= 100 ? "text-neon-green" : "text-neon-orange"}>{total}/{proposal.quorumRequired}</span>
      </div>

      {/* Price driver param change indicator */}
      <PdParamBadge payload={proposal.category === "price_driver_params" ? proposal.executionPayload : undefined} />

      {/* Description toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors font-mono"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <div className="p-3 bg-black/20 rounded-sm border border-border/30">
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">{proposal.description}</p>
        </div>
      )}

      {/* Vote buttons / already voted */}
      {isActive && (
        myVote ? (
          <div className="flex items-center gap-2 text-[10px] font-mono p-2.5 bg-black/20 border border-border/30 rounded-sm">
            <CheckCircle className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-muted-foreground">Voted:</span>
            <span className={`capitalize font-bold ${myVote.choice === "for" ? "text-neon-green" : myVote.choice === "against" ? "text-red-400" : "text-muted-foreground"}`}>
              {myVote.choice}
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            {[
              { choice: "for", label: "Vote For", icon: CheckCircle, cls: "bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30" },
              { choice: "against", label: "Against", icon: XCircle, cls: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30" },
              { choice: "abstain", label: "Abstain", icon: Minus, cls: "bg-white/5 hover:bg-white/10 text-muted-foreground border border-white/10" },
            ].map(({ choice, label, icon: Icon, cls }) => (
              <button
                key={choice}
                data-testid={`button-vote-${choice}-${proposal.id}`}
                onClick={() => onVote(proposal.id, choice)}
                disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-[10px] font-heading tracking-wider transition-colors disabled:opacity-40 ${cls}`}
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function Governance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("protocol");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pdParam, setPdParam] = useState(Object.keys(PRICE_DRIVER_PARAMS)[0]);
  const [pdNewValue, setPdNewValue] = useState("");

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<GovernanceProposal[]>({
    queryKey: ["/api/governance/proposals"],
    refetchInterval: 30000,
  });

  const { data: myVotes = [] } = useQuery<VoteRecord[]>({
    queryKey: ["/api/governance/my-votes"],
  });

  const { data: rosetta } = useQuery<RosettaStatus>({
    queryKey: ["/api/rosetta/status"],
    refetchInterval: 60000,
  });

  const { data: executionLog = [] } = useQuery<ExecutionRecord[]>({
    queryKey: ["/api/governance/execution-log"],
    refetchInterval: 30000,
  });

  const { data: protocolSettings = [] } = useQuery<ProtocolSetting[]>({
    queryKey: ["/api/governance/protocol-settings"],
    refetchInterval: 60000,
  });

  const executeMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const res = await apiRequest("POST", `/api/governance/execute/${proposalId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/execution-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/protocol-settings"] });
      toast({ title: "Proposal Executed", description: "Governance parameters have been written to protocol settings." });
    },
    onError: (error: any) => {
      toast({ title: "Execution Failed", description: error.message, variant: "destructive" });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ proposalId, choice }: { proposalId: number; choice: string }) => {
      const res = await apiRequest("POST", `/api/governance/proposals/${proposalId}/vote`, { choice });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/my-votes"] });
      toast({ title: "Vote Recorded", description: "Your governance vote has been submitted on-chain." });
    },
    onError: (error: any) => {
      toast({ title: "Vote Failed", description: error.message, variant: "destructive" });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; category: string; executionPayload?: PdPayload }) => {
      const res = await apiRequest("POST", "/api/governance/proposals", { ...data, timelockHours: 48 });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/proposals"] });
      toast({ title: "Proposal Submitted", description: "Your governance proposal is now live for voting." });
      setShowNewForm(false);
      setNewTitle(""); setNewDesc(""); setNewCategory("protocol");
      setPdParam(Object.keys(PRICE_DRIVER_PARAMS)[0]); setPdNewValue("");
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  });

  const myVoteMap = new Map(myVotes.map(v => [v.proposalId, v]));

  const filteredProposals = filterStatus === "all" ? proposals : proposals.filter(p => p.status === filterStatus);

  const activeCount = proposals.filter(p => p.status === "active").length;
  const passedCount = proposals.filter(p => p.status === "passed").length;
  const totalVotesCast = myVotes.length;

  const UTILITY_ITEMS = [
    { icon: Vote, title: "Governance Voting", desc: "SKYNT holders vote on protocol upgrades, treasury spend, and parameter changes via SKYNTGovernor DAO.", color: "text-neon-cyan" },
    { icon: Lock, title: "veSKYNT Escrow", desc: "Lock SKYNT 1-4 years for veSKYNT — vote-escrowed tokens that grant 3x yield boost and amplified governance power.", color: "text-neon-magenta" },
    { icon: TrendingUp, title: "Bridge Fee Discount", desc: "SKYNT holders receive up to 50% discount on SphinxBridge cross-chain fees based on holding tier.", color: "text-neon-green" },
    { icon: Zap, title: "Mining Boosts", desc: "Stake SKYNT in the protocol to increase IIT Phi consciousness score, unlocking higher block reward multipliers.", color: "text-neon-orange" },
    { icon: Shield, title: "Guardian Eligibility", desc: "Top SKYNT stakers are eligible to serve as guardian validators in the 5-of-9 bridge multi-sig network.", color: "text-primary" },
    { icon: Coins, title: "ZK-EVM Gas", desc: "SKYNT (8 decimals, ERC-20) is used as gas on SphinxSkynet L2, with treasury funding Alchemy-powered transactions.", color: "text-neon-cyan" },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-5xl" data-testid="governance-page">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Vote className="w-8 h-8 text-neon-cyan animate-pulse" />
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-white tracking-tighter" data-testid="text-governance-title">
            SKYNT Governance
          </h1>
        </div>
        <p className="text-muted-foreground font-mono text-sm max-w-2xl mx-auto">
          SphinxSkynet DAO — decentralized protocol governance via SKYNTGovernor, veSKYNT escrow, and 48h timelock
        </p>
      </div>

      {/* Rosetta + Network Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="cosmic-card p-3 space-y-1">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Server className="w-3 h-3" /> Rosetta API
          </p>
          <p className="text-sm font-mono text-neon-green">v{rosetta?.rosettaVersion || "1.4.13"}</p>
          <p className="text-[9px] font-mono text-muted-foreground">{rosetta?.totalEndpoints || 17} endpoints live</p>
        </div>
        <div className="cosmic-card p-3 space-y-1">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Globe className="w-3 h-3" /> Mainnet Block
          </p>
          <p className="text-sm font-mono text-neon-cyan">#{rosetta?.blockHeight?.toLocaleString() || "—"}</p>
          <p className="text-[9px] font-mono text-muted-foreground capitalize">{rosetta?.syncStatus || "synced"}</p>
        </div>
        <div className="cosmic-card p-3 space-y-1">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3" /> Active Proposals
          </p>
          <p className="text-sm font-mono text-neon-orange">{activeCount}</p>
          <p className="text-[9px] font-mono text-muted-foreground">{passedCount} passed</p>
        </div>
        <div className="cosmic-card p-3 space-y-1">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Vote className="w-3 h-3" /> My Votes Cast
          </p>
          <p className="text-sm font-mono text-primary">{totalVotesCast}</p>
          <p className="text-[9px] font-mono text-muted-foreground">SKYNT holder</p>
        </div>
      </div>

      {/* Token Utility Grid */}
      <section className="space-y-3">
        <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
          <Coins className="w-5 h-5 text-neon-cyan" /> SKYNT ERC-20 Token Utility
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {UTILITY_ITEMS.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="cosmic-card p-4 space-y-2 hover-elevate" data-testid={`card-utility-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`font-heading text-xs uppercase tracking-wider ${color}`}>{title}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* veSKYNT Escrow Panel */}
      <section className="cosmic-card cosmic-card-magenta p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-neon-magenta" /> veSKYNT Voting Escrow
          </h2>
          <Badge className="bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/30 text-[9px] font-heading uppercase">VotingEscrow.sol</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { lock: "1 Year", multiplier: "1.5x", power: "1.5x Governance", yield: "+50% Yield", color: "border-neon-cyan/20 bg-neon-cyan/5" },
            { lock: "2 Years", multiplier: "2x", power: "2x Governance", yield: "+100% Yield", color: "border-neon-magenta/20 bg-neon-magenta/5" },
            { lock: "4 Years", multiplier: "3x", power: "3x Governance", yield: "+200% Yield", color: "border-neon-orange/20 bg-neon-orange/5" },
          ].map(({ lock, multiplier, power, yield: yld, color }) => (
            <div key={lock} className={`p-4 rounded-sm border ${color} space-y-2 text-center`} data-testid={`card-escrow-${lock.toLowerCase().replace(" ", "-")}`}>
              <div className="text-xs font-heading text-muted-foreground uppercase">{lock} Lock</div>
              <div className="text-2xl font-mono text-white">{multiplier}</div>
              <div className="text-[10px] font-mono text-neon-cyan">{power}</div>
              <div className="text-[10px] font-mono text-neon-green">{yld} Boost</div>
              <button
                data-testid={`button-lock-${lock.toLowerCase().replace(" ", "-")}`}
                className="w-full mt-2 py-1.5 rounded-sm border border-white/20 text-[10px] font-heading tracking-wider text-muted-foreground hover:text-white hover:border-white/40 transition-colors"
              >
                Lock SKYNT
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> SKYNTGovernor.sol — OpenZeppelin Governor</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 48h TimelockController</span>
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> Rosetta Construction API supported</span>
        </div>
      </section>

      {/* Proposals Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-neon-green" /> Governance Proposals
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-black/30 border border-border rounded-sm">
              {["all", "active", "passed", "rejected"].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  data-testid={`filter-${s}`}
                  className={`px-3 py-1 rounded-sm text-[10px] font-heading tracking-wider capitalize transition-all ${
                    filterStatus === s ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            <Button
              data-testid="button-new-proposal"
              size="sm"
              onClick={() => setShowNewForm(!showNewForm)}
              className="bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 font-heading text-[10px] tracking-wider h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Proposal
            </Button>
          </div>
        </div>

        {/* New Proposal Form */}
        {showNewForm && (
          <div className="cosmic-card cosmic-card-green p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
            <h3 className="font-heading text-sm text-neon-green flex items-center gap-2">
              <Plus className="w-4 h-4" /> Submit New Proposal
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-heading text-muted-foreground uppercase">Title</label>
                <input
                  data-testid="input-proposal-title"
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Proposal title..."
                  className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-sm focus:outline-none focus:border-neon-green/60 transition-colors placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-heading text-muted-foreground uppercase">Description</label>
                <textarea
                  data-testid="input-proposal-description"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Describe the proposal and its expected impact on the protocol..."
                  rows={4}
                  className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-sm focus:outline-none focus:border-neon-green/60 transition-colors placeholder:text-muted-foreground/40 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-heading text-muted-foreground uppercase">Category</label>
                <select
                  data-testid="select-proposal-category"
                  value={newCategory}
                  onChange={e => { setNewCategory(e.target.value); }}
                  className="w-full p-3 bg-black/40 border border-border rounded-sm font-heading text-sm appearance-none focus:outline-none focus:border-neon-green/60 transition-colors"
                >
                  <option value="protocol">Protocol</option>
                  <option value="treasury">Treasury</option>
                  <option value="parameter">Parameter</option>
                  <option value="upgrade">Upgrade</option>
                  <option value="community">Community</option>
                  <option value="price_driver_params">Price Driver Parameter</option>
                </select>
              </div>

              {/* Price driver param fields */}
              {newCategory === "price_driver_params" && (
                <div className="p-3 bg-neon-orange/5 border border-neon-orange/20 rounded-sm space-y-3">
                  <div className="text-[10px] font-heading text-neon-orange uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-3 h-3" /> Price Driver Parameter Change
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-heading text-muted-foreground uppercase">Parameter</label>
                    <select
                      data-testid="select-pd-param"
                      value={pdParam}
                      onChange={e => setPdParam(e.target.value)}
                      className="w-full p-2.5 bg-black/40 border border-border rounded-sm font-mono text-xs appearance-none focus:outline-none focus:border-neon-orange/60 transition-colors"
                    >
                      {Object.entries(PRICE_DRIVER_PARAMS).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label} ({key})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-heading text-muted-foreground uppercase">
                      {(() => { const m = (pdParam in PRICE_DRIVER_PARAMS) ? PRICE_DRIVER_PARAMS[pdParam as PriceDriverParamKey] : null; return `New Value${m?.unit ? ` (${m.unit})` : ""}`; })()}
                    </label>
                    <input
                      data-testid="input-pd-new-value"
                      type="number"
                      value={pdNewValue}
                      onChange={e => setPdNewValue(e.target.value)}
                      placeholder={`e.g. ${(pdParam in PRICE_DRIVER_PARAMS) ? PRICE_DRIVER_PARAMS[pdParam as PriceDriverParamKey].min : ""}`}
                      className="w-full p-2.5 bg-black/40 border border-border rounded-sm font-mono text-xs focus:outline-none focus:border-neon-orange/60 transition-colors placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground bg-black/20 p-2 rounded-sm">
                    <span className="text-neon-orange font-bold">WILL CHANGE:</span>
                    <span className="text-muted-foreground">{pdParam}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-neon-green font-bold">{pdNewValue || "?"}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="button-submit-proposal"
                onClick={() => {
                  if (!newTitle.trim() || !newDesc.trim()) {
                    toast({ title: "Validation Error", description: "Title and description are required.", variant: "destructive" });
                    return;
                  }
                  if (newCategory === "price_driver_params" && !pdNewValue.trim()) {
                    toast({ title: "Validation Error", description: "New value is required for price driver parameter proposals.", variant: "destructive" });
                    return;
                  }
                  const currentSetting = protocolSettings.find(s => s.key === pdParam);
                  createMutation.mutate({
                    title: newTitle.trim(),
                    description: newDesc.trim(),
                    category: newCategory,
                    ...(newCategory === "price_driver_params" ? {
                      executionPayload: { parameter: pdParam, newValue: pdNewValue.trim(), currentValue: currentSetting?.value ?? undefined }
                    } : {}),
                  });
                }}
                disabled={createMutation.isPending || !newTitle.trim() || !newDesc.trim()}
                className="bg-neon-green/20 hover:bg-neon-green/30 text-neon-green border border-neon-green/40 font-heading tracking-wider"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Proposal"}
              </Button>
              <Button variant="outline" onClick={() => setShowNewForm(false)} className="border-border text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <AlertTriangle className="w-3 h-3" />
              Proposals are subject to 48-hour timelock after passing quorum. 100 SKYNT votes required for quorum.
            </div>
          </div>
        )}

        {/* Proposals List */}
        {proposalsLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => <div key={i} className="cosmic-card h-32 animate-pulse bg-white/5" />)}
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="cosmic-card p-12 text-center">
            <Vote className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground font-mono">No proposals in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                myVote={myVoteMap.get(proposal.id) ?? null}
                onVote={(id, choice) => voteMutation.mutate({ proposalId: id, choice })}
                isPending={voteMutation.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* Governance Execution Engine */}
      <section className="space-y-4">
        <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-neon-orange" /> Governance Execution Engine
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Execution Log */}
          <div className="cosmic-card p-5 space-y-3" data-testid="card-execution-log">
            <h3 className="text-sm font-heading font-bold text-neon-orange flex items-center gap-2">
              <Play className="w-4 h-4" /> Execution Log
            </h3>
            {executionLog.length === 0 ? (
              <p className="text-[10px] font-mono text-muted-foreground">No proposals executed yet. Auto-execution runs every 5 minutes.</p>
            ) : (
              <div className="space-y-2">
                {executionLog.slice(0, 5).map((rec, i) => (
                  <div key={i} className="p-3 bg-black/20 border border-border/30 rounded-sm space-y-1.5" data-testid={`row-execution-${rec.proposalId}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-neon-orange font-bold">GIP-{String(rec.proposalId).padStart(3, "0")}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{new Date(rec.executedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] font-mono text-foreground truncate">{rec.title}</p>
                    {rec.parameter && (
                      <div className="flex items-center gap-2 text-[9px] font-mono">
                        <span className="text-muted-foreground truncate max-w-[140px]">{rec.parameter}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="text-neon-green font-bold">{rec.newValue}</span>
                        {rec.oldValue && rec.oldValue !== "(not set)" && (
                          <span className="text-muted-foreground">(was: {rec.oldValue})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Protocol Settings */}
          <div className="cosmic-card p-5 space-y-3" data-testid="card-protocol-settings">
            <h3 className="text-sm font-heading font-bold text-neon-cyan flex items-center gap-2">
              <Database className="w-4 h-4" /> Protocol Settings
            </h3>
            {protocolSettings.length === 0 ? (
              <p className="text-[10px] font-mono text-muted-foreground">No protocol parameters set yet. Parameters are written when proposals execute.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {protocolSettings.map((setting, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px] font-mono p-2 bg-black/20 border border-border/30 rounded-sm" data-testid={`row-setting-${setting.key}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-neon-cyan shrink-0">{setting.key}</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="text-foreground truncate max-w-[100px]">{setting.value}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">{setting.updatedBy?.replace("governance:", "GIP-")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Admin force-execute for passed/active proposals */}
        {user?.isAdmin && proposals.filter(p => p.status === "active" && (p.votesFor ?? 0) > 0).length > 0 && (
          <div className="cosmic-card p-4 space-y-3">
            <h3 className="text-sm font-heading font-bold text-muted-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" /> Admin Override — Force Execute
            </h3>
            <div className="space-y-2">
              {proposals.filter(p => p.status === "active" && (p.votesFor ?? 0) > 0).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-black/20 border border-border/30 rounded-sm">
                  <div className="min-w-0 mr-3">
                    <span className="text-[10px] font-mono text-muted-foreground">GIP-{String(p.id).padStart(3, "0")} — </span>
                    <span className="text-[10px] font-mono text-foreground truncate">{p.title}</span>
                  </div>
                  <button
                    data-testid={`button-force-execute-${p.id}`}
                    onClick={() => executeMutation.mutate(p.id)}
                    disabled={executeMutation.isPending}
                    className="shrink-0 text-[9px] font-heading tracking-wider px-3 py-1.5 rounded-sm border bg-neon-orange/10 hover:bg-neon-orange/20 text-neon-orange border-neon-orange/30 transition-colors disabled:opacity-40"
                  >
                    {executeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin inline-block" /> : "Execute"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Rosetta Endpoint Reference */}
      <section className="cosmic-card p-5 space-y-4">
        <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-neon-green" /> Coinbase Rosetta API — SphinxSkynet Mainnet
        </h2>
        <p className="text-[10px] text-muted-foreground font-mono">
          Full Rosetta v{rosetta?.rosettaVersion || "1.4.13"} implementation for {rosetta?.blockchain || "SphinxSkynet"} — enables Coinbase listing, institutional wallets, and DEX aggregator integration.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[10px] font-heading text-neon-cyan uppercase tracking-wider mb-2">Data API ({rosetta?.dataEndpoints || 9} endpoints)</div>
            {["/rosetta/network/list", "/rosetta/network/status", "/rosetta/network/options", "/rosetta/account/balance", "/rosetta/account/coins", "/rosetta/block", "/rosetta/block/transaction", "/rosetta/mempool", "/rosetta/mempool/transaction"].map(ep => (
              <div key={ep} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0" />
                <span className="text-muted-foreground">{ep}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-heading text-neon-magenta uppercase tracking-wider mb-2">Construction API ({rosetta?.constructionEndpoints || 8} endpoints)</div>
            {["/rosetta/construction/derive", "/rosetta/construction/preprocess", "/rosetta/construction/metadata", "/rosetta/construction/payloads", "/rosetta/construction/combine", "/rosetta/construction/parse", "/rosetta/construction/hash", "/rosetta/construction/submit"].map(ep => (
              <div key={ep} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-magenta shrink-0" />
                <span className="text-muted-foreground">{ep}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 border-t border-border/30 text-[10px] font-mono text-muted-foreground">
          <span>Symbol: <span className="text-white">SKYNT</span></span>
          <span>Decimals: <span className="text-white">{rosetta?.decimals || 8}</span></span>
          <span>Network: <span className="text-neon-green">{rosetta?.network || "mainnet"}</span></span>
          <span>Operations: <span className="text-primary">{rosetta?.supportedOperations?.join(", ") || "TRANSFER, NFT_MINT, COINBASE"}</span></span>
        </div>
      </section>
    </div>
  );
}
