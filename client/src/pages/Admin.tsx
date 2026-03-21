import { LaunchChecklist } from "@/components/LaunchChecklist";
import { MintTimeline } from "@/components/MintTimeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, Download, Rocket, Activity, Gift, Plus, Users, Coins, CheckCircle2, Clock, XCircle, UserCheck, ShieldCheck, ShieldAlert, Loader2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

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
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-[10px]">● LIVE</Badge>;
  if (status === "upcoming") return <Badge className="bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 font-mono text-[10px]">◌ UPCOMING</Badge>;
  return <Badge className="bg-muted/30 text-muted-foreground border-border/40 font-mono text-[10px]">✕ ENDED</Badge>;
}

function CreateAirdropForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    tokenAmount: "100",
    totalSupply: "1000",
    eligibilityType: "all",
    minSkynt: "0",
    minNfts: "0",
    requiredChain: "",
    status: "upcoming",
    startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/airdrops", {
      ...form,
      totalSupply: parseInt(form.totalSupply),
      minNfts: parseInt(form.minNfts),
      requiredChain: form.requiredChain || null,
    }),
    onSuccess: () => {
      toast({ title: "Airdrop created!", description: "The airdrop is now live in the system." });
      onSuccess();
    },
    onError: (e: any) => {
      toast({ title: "Failed to create airdrop", description: e.message, variant: "destructive" });
    },
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="cosmic-card p-6 space-y-5" data-testid="form-create-airdrop">
      <div>
        <h3 className="font-heading font-bold text-base text-primary mb-1">New Airdrop</h3>
        <p className="font-mono text-xs text-muted-foreground">Schedule a SKYNT token distribution event</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Title *</label>
          <Input data-testid="input-airdrop-title" placeholder="Genesis Drop #1" {...field("title")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Status</label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger data-testid="select-airdrop-status" className="bg-black/40 border-border/50 font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="font-mono text-xs text-muted-foreground">Description *</label>
        <Textarea data-testid="input-airdrop-description" placeholder="Describe the airdrop and eligibility requirements…" {...field("description")} className="bg-black/40 border-border/50 font-mono text-sm min-h-[80px]" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">SKYNT per claim</label>
          <Input data-testid="input-airdrop-amount" type="number" min="1" placeholder="100" {...field("tokenAmount")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Total claimable slots</label>
          <Input data-testid="input-airdrop-supply" type="number" min="1" placeholder="1000" {...field("totalSupply")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Eligibility</label>
          <Select value={form.eligibilityType} onValueChange={v => setForm(f => ({ ...f, eligibilityType: v }))}>
            <SelectTrigger data-testid="select-airdrop-eligibility" className="bg-black/40 border-border/50 font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Open to All</SelectItem>
              <SelectItem value="holders">NFT Holders</SelectItem>
              <SelectItem value="miners">Miners</SelectItem>
              <SelectItem value="stakers">Stakers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Min SKYNT required</label>
          <Input data-testid="input-airdrop-minskynt" type="number" min="0" placeholder="0" {...field("minSkynt")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Min NFTs required</label>
          <Input data-testid="input-airdrop-minnfts" type="number" min="0" placeholder="0" {...field("minNfts")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">Start date</label>
          <Input data-testid="input-airdrop-start" type="datetime-local" {...field("startDate")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-muted-foreground">End date</label>
          <Input data-testid="input-airdrop-end" type="datetime-local" {...field("endDate")} className="bg-black/40 border-border/50 font-mono text-sm" />
        </div>
      </div>
      <Button
        className="w-full font-heading font-bold tracking-wider"
        onClick={() => create.mutate()}
        disabled={create.isPending || !form.title || !form.description}
        data-testid="button-create-airdrop"
      >
        <Plus className="w-4 h-4 mr-2" />
        {create.isPending ? "Creating…" : "Create Airdrop"}
      </Button>
    </div>
  );
}

function AirdropManageList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: airdrops = [], isLoading } = useQuery<AirdropEntry[]>({ queryKey: ["/api/airdrops"] });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/airdrops/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/airdrops"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="h-24 animate-pulse bg-muted/20 rounded-lg" />;
  if (!airdrops.length) return (
    <div className="text-center py-10 text-muted-foreground font-mono text-xs">No airdrops yet — create one above.</div>
  );

  return (
    <div className="space-y-3">
      {airdrops.map(a => (
        <div key={a.id} className="cosmic-card p-4 flex items-center gap-4" data-testid={`row-airdrop-${a.id}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={a.status} />
              <span className="font-heading font-bold text-sm text-foreground truncate">{a.title}</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Coins className="w-3 h-3" />{a.tokenAmount} SKYNT</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.claimedCount}/{a.totalSupply}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(a.endDate), "MMM d, yyyy")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {a.status !== "active" && (
              <Button
                size="sm"
                variant="outline"
                className="border-neon-green/40 text-neon-green hover:bg-neon-green/10 font-mono text-xs h-7 px-2"
                onClick={() => updateStatus.mutate({ id: a.id, status: "active" })}
                disabled={updateStatus.isPending}
                data-testid={`button-activate-airdrop-${a.id}`}
              >
                Activate
              </Button>
            )}
            {a.status !== "ended" && (
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 font-mono text-xs h-7 px-2"
                onClick={() => updateStatus.mutate({ id: a.id, status: "ended" })}
                disabled={updateStatus.isPending}
                data-testid={`button-end-airdrop-${a.id}`}
              >
                End
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface KycSub {
  id: number; userId: number; fullName: string; dateOfBirth: string;
  nationality: string; country: string; address: string; idType: string;
  idNumber: string; idFrontUrl: string | null; idBackUrl: string | null;
  selfieUrl: string | null; status: string; reviewNotes: string | null;
  submittedAt: string; reviewedAt: string | null;
}

const KYC_ID_LABELS: Record<string, string> = {
  passport: "Passport", drivers_license: "Driver's License",
  national_id: "National ID", residence_permit: "Residence Permit",
};

function KycReviewPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: subs = [], isLoading } = useQuery<KycSub[]>({ queryKey: ["/api/kyc/submissions"] });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/kyc/${id}/review`, { status, reviewNotes: notes[id] ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/kyc/submissions"] });
      toast({ title: "KYC updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending:      { label: "Pending",      color: "text-neon-cyan",   icon: Clock },
    under_review: { label: "Reviewing",    color: "text-neon-orange", icon: Loader2 },
    approved:     { label: "Approved",     color: "text-neon-green",  icon: ShieldCheck },
    rejected:     { label: "Rejected",     color: "text-plasma-red",  icon: ShieldAlert },
  };

  const filtered = filterStatus === "all" ? subs : subs.filter(s => s.status === filterStatus);
  const counts = { pending: subs.filter(s => s.status === "pending").length, under_review: subs.filter(s => s.status === "under_review").length, approved: subs.filter(s => s.status === "approved").length, rejected: subs.filter(s => s.status === "rejected").length };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(counts).map(([k, v]) => {
          const c = statusConfig[k] ?? statusConfig.pending;
          const Icon = c.icon;
          return (
            <div key={k} className="cosmic-card p-4 flex items-center gap-3 cursor-pointer" onClick={() => setFilterStatus(filterStatus === k ? "all" : k)} data-testid={`card-kyc-count-${k}`}>
              <Icon className={`w-5 h-5 ${c.color}`} />
              <div>
                <p className={`font-mono text-lg font-bold ${c.color}`}>{v}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{c.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-kyc-filter" className="w-40 bg-black/40 border-border/50 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Submissions</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <p className="font-mono text-xs text-muted-foreground">{filtered.length} submission{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading ? (
        <div className="cosmic-card p-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="cosmic-card p-8 text-center font-mono text-xs text-muted-foreground">No KYC submissions yet.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const cfg = statusConfig[s.status] ?? statusConfig.pending;
            const Icon = cfg.icon;
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="cosmic-card overflow-hidden" data-testid={`row-kyc-${s.id}`}>
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                >
                  <div className={`w-8 h-8 rounded-full bg-black/40 flex items-center justify-center ${cfg.color}`}>
                    <Icon className={`w-4 h-4 ${s.status === "under_review" ? "animate-spin" : ""}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-foreground font-bold truncate">{s.fullName}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{s.country} • {KYC_ID_LABELS[s.idType] ?? s.idType} • Submitted {format(new Date(s.submittedAt), "MMM d, yyyy")}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-bold ${cfg.color} hidden sm:block`}>{cfg.label}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>

                {isOpen && (
                  <div className="border-t border-border/30 p-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3 font-mono text-xs">
                      {[
                        ["Full Name", s.fullName], ["Date of Birth", s.dateOfBirth],
                        ["Nationality", s.nationality], ["Country", s.country],
                        ["Address", s.address], ["ID Type", KYC_ID_LABELS[s.idType] ?? s.idType],
                        ["ID Number", s.idNumber], ["Status", cfg.label],
                        ["User ID", String(s.userId)], ["KYC ID", String(s.id)],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between py-1.5 border-b border-border/20">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="text-foreground font-bold">{val}</span>
                        </div>
                      ))}
                    </div>

                    {(s.idFrontUrl || s.idBackUrl || s.selfieUrl) && (
                      <div className="grid grid-cols-3 gap-3">
                        {[["Front", s.idFrontUrl], ["Back", s.idBackUrl], ["Selfie", s.selfieUrl]].map(([label, url]) => url ? (
                          <div key={label} className="space-y-1">
                            <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
                            <img src={url} alt={`${label}`} className="w-full aspect-[4/3] object-cover rounded-lg border border-border/40" />
                          </div>
                        ) : null)}
                      </div>
                    )}

                    {s.reviewNotes && (
                      <div className="p-3 rounded-lg bg-black/40 border border-border/30">
                        <p className="font-mono text-[10px] text-muted-foreground mb-1">Previous Notes</p>
                        <p className="font-mono text-xs text-foreground">{s.reviewNotes}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="font-mono text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="w-3 h-3" />Review Notes</label>
                      <Textarea
                        data-testid={`textarea-kyc-notes-${s.id}`}
                        value={notes[s.id] ?? ""}
                        onChange={e => setNotes(n => ({ ...n, [s.id]: e.target.value }))}
                        placeholder="Optional notes for the user…"
                        className="bg-black/40 border-border/50 font-mono text-xs min-h-[60px]"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm" variant="outline"
                        className="border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
                        onClick={() => reviewMutation.mutate({ id: s.id, status: "under_review" })}
                        disabled={reviewMutation.isPending || s.status === "under_review"}
                        data-testid={`button-kyc-review-${s.id}`}
                      >Mark Under Review</Button>
                      <Button
                        size="sm"
                        className="bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/40 text-neon-green font-mono text-xs"
                        onClick={() => reviewMutation.mutate({ id: s.id, status: "approved" })}
                        disabled={reviewMutation.isPending || s.status === "approved"}
                        data-testid={`button-kyc-approve-${s.id}`}
                      >Approve</Button>
                      <Button
                        size="sm" variant="outline"
                        className="border-plasma-red/40 text-plasma-red hover:bg-plasma-red/10 font-mono text-xs"
                        onClick={() => reviewMutation.mutate({ id: s.id, status: "rejected" })}
                        disabled={reviewMutation.isPending || s.status === "rejected"}
                        data-testid={`button-kyc-reject-${s.id}`}
                      >Reject</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");
  const qc = useQueryClient();

  return (
    <div data-testid="admin-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-3 text-primary neon-glow-cyan">
            <Rocket className="w-6 h-6" /> Mission Control
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">System administration & configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border/50 text-muted-foreground hover:text-foreground" data-testid="button-flight-log">
            <Download className="w-4 h-4 mr-2" />
            Flight Log
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-muted/30 border border-border/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" data-testid="tab-flight-status">Flight Status</TabsTrigger>
          <TabsTrigger value="airdrops" data-testid="tab-airdrops">
            <Gift className="w-3.5 h-3.5 mr-1.5" />Airdrops
          </TabsTrigger>
          <TabsTrigger value="kyc" data-testid="tab-kyc">
            <UserCheck className="w-3.5 h-3.5 mr-1.5" />KYC Review
          </TabsTrigger>
          <TabsTrigger value="mint" data-testid="tab-mission-config">Mission Config</TabsTrigger>
          <TabsTrigger value="metadata" data-testid="tab-payload">Payload (Metadata)</TabsTrigger>
          <TabsTrigger value="cross-chain" data-testid="tab-mining">Mining (StarLord 2)</TabsTrigger>
          <TabsTrigger value="legal" data-testid="tab-legal">Legal Telemetry</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="cosmic-card cosmic-card-cyan p-5" data-testid="stat-revenue">
              <p className="stat-label">Total Fuel (Revenue)</p>
              <p className="stat-value text-neon-cyan mt-1">34.56 ETH</p>
              <p className="stat-change positive mt-2">+12% from last hour</p>
            </div>
            <div className="cosmic-card cosmic-card-green p-5" data-testid="stat-deployed">
              <p className="stat-label">Patches Deployed</p>
              <p className="stat-value text-neon-green mt-1">2,100 / 2,500</p>
              <p className="text-xs text-muted-foreground mt-2">Unified Mainnet Live</p>
            </div>
            <div className="cosmic-card cosmic-card-orange p-5" data-testid="stat-holders">
              <p className="stat-label">Crew Size (Holders)</p>
              <p className="stat-value text-neon-orange mt-1">1,842</p>
              <p className="text-xs text-muted-foreground mt-2">StarLord 2 Distributed</p>
            </div>
            <div className="cosmic-card cosmic-card-magenta p-5" data-testid="stat-zk">
              <p className="stat-label">ZK-Proof Chain</p>
              <p className="stat-value text-neon-green mt-1">VERIFIED</p>
              <p className="text-xs text-neon-green font-mono mt-2">State Root Valid</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 h-[400px]">
            <div className="md:col-span-2 h-full cosmic-card p-0 overflow-hidden">
              <MintTimeline />
            </div>
            <div className="h-full cosmic-card p-0 overflow-hidden">
              <LaunchChecklist />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="airdrops" className="space-y-6">
          <CreateAirdropForm onSuccess={() => { qc.invalidateQueries({ queryKey: ["/api/airdrops"] }); }} />
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground mb-4 uppercase tracking-widest">All Airdrops</h3>
            <AirdropManageList />
          </div>
        </TabsContent>

        <TabsContent value="kyc" className="space-y-6">
          <KycReviewPanel />
        </TabsContent>

        <TabsContent value="mint">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Launch Parameters</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Configure mission details, pricing, and orbital supply.</p>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <div className="text-center space-y-2">
                <Settings className="w-8 h-8 mx-auto text-primary/20" />
                <p className="text-xs">Mission configuration panel — connect to deploy</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="metadata">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Payload Integration</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Verify IPFS pinning status and reveal timestamps.</p>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <div className="text-center space-y-2">
                <Download className="w-8 h-8 mx-auto text-primary/20" />
                <p className="text-xs">IPFS metadata verification — awaiting pin</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="cross-chain">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Unified Mining Analytics</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Cross-chain contribution weight and rewards reconciliation.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 border border-border/50 rounded-lg bg-black/40 font-mono text-xs space-y-1">
                <span className="text-muted-foreground">EMISSION_RATE (Et):</span>
                <span className="text-primary block">a*Gt + b*St</span>
              </div>
              <div className="p-4 border border-border/50 rounded-lg bg-black/40 font-mono text-xs space-y-1">
                <span className="text-muted-foreground">CHAIN_STATE (S_c,t):</span>
                <span className="text-primary block">Sum 1_chain(i)=c * ai(t)</span>
              </div>
            </div>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-primary/5">
              <Activity className="w-8 h-8 animate-pulse text-primary/20" />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="legal">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Compliance Telemetry</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Review disclaimers and royalty enforcement settings.</p>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <div className="text-center space-y-2">
                <Activity className="w-8 h-8 mx-auto text-primary/20" />
                <p className="text-xs">Compliance telemetry — monitoring active</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
