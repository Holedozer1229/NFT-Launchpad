import { useState, useEffect } from "react";
import { haptic } from "@/lib/haptics";
import { 
  Orbit, 
  Zap, 
  Shield, 
  ArrowDownUp, 
  Hash, 
  Activity, 
  CheckCircle, 
  Loader2, 
  X, 
  ChevronDown, 
  Lock, 
  Unlock, 
  Globe, 
  Cpu, 
  ExternalLink,
  ArrowRight,
  TrendingUp,
  History,
  AlertTriangle,
  Wallet
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ZK_WORMHOLE_CHAINS, type ZkWormholeChainId } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface WormholeNetworkStats {
  totalPortals: number;
  volumeTransferred: string;
  activeWormholes: number;
  proofsVerified: number;
}

interface WormholeStatus {
  id: string;
  sourceChain: ZkWormholeChainId;
  destChain: ZkWormholeChainId;
  status: 'open' | 'bridging' | 'sealed' | 'dormant';
  totalTransferred: string;
  capacity: number;
  transferCount: number;
  phiBoost: number;
  zkProofHash: string;
}

interface WormholeTransfer {
  id: string;
  wormholeId: string;
  sourceChain: ZkWormholeChainId;
  destChain: ZkWormholeChainId;
  amount: string;
  token: string;
  status: 'pending' | 'verified' | 'completed' | 'failed';
  proofHash: string;
  createdAt: string;
}

export default function ZkWormhole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form State
  const [sourceChain, setSourceChain] = useState<ZkWormholeChainId>("ethereum");
  const [destChain, setDestChain] = useState<ZkWormholeChainId>("skynt");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("SKYNT");
  const [selectedWormholeId, setSelectedWormholeId] = useState<string>("");
  const [transferStep, setTransferStep] = useState<number>(0);
  const [pendingTransferId, setPendingTransferId] = useState<string | null>(null);

  // ─── Gasless Test Console state ───────────────────────────────────────────────
  const [gaslessAmount, setGaslessAmount] = useState("0.001");
  const [gaslessToken, setGaslessToken] = useState("ETH");
  const [gaslessRecipient, setGaslessRecipient] = useState("");
  const [gaslessStep, setGaslessStep] = useState(0);
  const [gaslessResult, setGaslessResult] = useState<any>(null);
  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [koraStep, setKoraStep] = useState(0);
  const [koraResult, setKoraResult] = useState<any>(null);

  // Queries
  const { data: networkStats, isLoading: statsLoading } = useQuery<WormholeNetworkStats>({
    queryKey: ['/api/wormhole/network'],
  });

  const { data: wormholes = [], isLoading: statusLoading } = useQuery<WormholeStatus[]>({
    queryKey: ['/api/wormhole/status'],
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery<WormholeTransfer[]>({
    queryKey: ['/api/wormhole/all-transfers'],
    refetchInterval: pendingTransferId ? 3000 : false,
  });

  useEffect(() => {
    if (!pendingTransferId) return;
    const tx = transfers.find((t) => t.id === pendingTransferId);
    if (!tx) return;
    if (tx.status === "pending") setTransferStep(1);
    else if (tx.status === "verified") setTransferStep(2);
    else if (tx.status === "completed") {
      setTransferStep(3);
      haptic("transaction");
      toast({ title: "Transfer Complete", description: "Assets have been successfully wormholed." });
      setPendingTransferId(null);
      setTimeout(() => setTransferStep(0), 5000);
    } else if (tx.status === "failed") {
      setTransferStep(0);
      toast({ title: "Transfer Failed", description: "The wormhole transfer could not be completed.", variant: "destructive" });
      setPendingTransferId(null);
    }
  }, [transfers, pendingTransferId]);

  // Mutations
  const openWormholeMutation = useMutation({
    mutationFn: async (body: { sourceChain: string; destChain: string }) => {
      const res = await apiRequest("POST", "/api/wormhole/open", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wormhole/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wormhole/network'] });
      haptic("success");
      toast({ title: "Wormhole Opened", description: "Your per-user cross-chain tunnel is now active." });
    },
    onError: (error) => {
      toast({ title: "Failed to Open Wormhole", description: error.message, variant: "destructive" });
    }
  });

  const closeWormholeMutation = useMutation({
    mutationFn: async (wormholeId: string) => {
      const res = await apiRequest("POST", "/api/wormhole/close", { wormholeId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wormhole/status'] });
      toast({ title: "Wormhole Sealed", description: "The cross-chain tunnel has been safely closed." });
    },
    onError: (error) => {
      toast({ title: "Failed to Close Wormhole", description: error.message, variant: "destructive" });
    }
  });

  const initiateTransferMutation = useMutation({
    mutationFn: async (body: { wormholeId: string; amount: string; token: string }) => {
      const res = await apiRequest("POST", "/api/wormhole/transfer", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wormhole/all-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wormhole/status'] });
      setTransferStep(1);
      if (data?.transfer?.id) {
        setPendingTransferId(data.transfer.id);
      }
    },
    onError: (error) => {
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
    }
  });

  // ─── Gasless ETH→SOL mutation ─────────────────────────────────────────────────
  const gaslessWhMutation = useMutation({
    mutationFn: async (body: { sourceChain: string; destChain: string; token: string; amount: string; recipientAddress: string }) => {
      const res = await apiRequest("POST", "/api/oiye/wh-transfer", body);
      return res.json();
    },
    onMutate: () => {
      setGaslessStep(1);
      setGaslessResult(null);
    },
    onSuccess: (data) => {
      setGaslessStep(5);
      setGaslessResult(data);
      haptic("transaction");
      toast({ title: "Gasless Transfer Initiated", description: `TX: ${data.txHash ?? data.status}` });
    },
    onError: (e: any) => {
      setGaslessStep(0);
      toast({ title: "Gasless Transfer Error", description: e.message, variant: "destructive" });
    },
  });

  // ─── Wormhole quote mutation ──────────────────────────────────────────────────
  const quoteMutation = useMutation({
    mutationFn: async (body: { sourceChain: string; destChain: string; token: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/wormhole/quote", body);
      return res.json();
    },
    onSuccess: (data) => {
      setQuoteResult(data);
      setGaslessStep(1);
      toast({ title: "Quote Fetched", description: `Delivery cost: ${data.deliveryCostUsd ?? data.deliveryCost ?? "fetching..."}` });
    },
    onError: (e: any) => {
      toast({ title: "Quote Error", description: e.message, variant: "destructive" });
    },
  });

  // ─── Kora relay mutation ──────────────────────────────────────────────────────
  const koraMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/oiye/kora-relay", {
        serializedTx: btoa("test-gasless-tx-" + Date.now()),
        featureName: "zk-wormhole-gasless-test",
      });
      return res.json();
    },
    onMutate: () => {
      setKoraStep(1);
      setKoraResult(null);
    },
    onSuccess: (data) => {
      setKoraStep(3);
      setKoraResult(data);
      haptic("success");
      toast({ title: "Kora Relay Executed", description: data.message ?? data.status });
    },
    onError: (e: any) => {
      setKoraStep(0);
      toast({ title: "Kora Relay Error", description: e.message, variant: "destructive" });
    },
  });

  const gaslessStages = [
    { label: "Fetch Quote", icon: TrendingUp },
    { label: "ZK Proof Gate", icon: Shield },
    { label: "SDK Sign & Relay", icon: Cpu },
    { label: "On-chain Confirm", icon: Hash },
    { label: "Wormhole Complete", icon: CheckCircle },
  ];

  const koraStages = [
    { label: "Build Transaction", icon: Cpu },
    { label: "Treasury Fee-Pay", icon: Zap },
    { label: "Broadcast to Solana", icon: Globe },
  ];

  const handleOpenWormhole = () => {
    if (sourceChain === destChain) {
      toast({ title: "Invalid Route", description: "Source and destination chains must be different.", variant: "destructive" });
      return;
    }
    openWormholeMutation.mutate({ sourceChain, destChain });
  };

  const handleInitiateTransfer = () => {
    if (!selectedWormholeId || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid Input", description: "Please select a wormhole and enter a valid amount.", variant: "destructive" });
      return;
    }
    initiateTransferMutation.mutate({ wormholeId: selectedWormholeId, amount, token });
  };

  const getComplexityLabel = (source: ZkWormholeChainId, dest: ZkWormholeChainId) => {
    const sum = ZK_WORMHOLE_CHAINS[source].proofComplexity + ZK_WORMHOLE_CHAINS[dest].proofComplexity;
    if (sum <= 3) return { label: "Low Complexity", color: "text-neon-green" };
    if (sum <= 6) return { label: "Medium Complexity", color: "text-neon-orange" };
    return { label: "High Complexity", color: "text-neon-magenta" };
  };

  const selectedWormhole = wormholes.find(w => w.id === selectedWormholeId);
  const transferFeeBps = selectedWormhole ? ZK_WORMHOLE_CHAINS[selectedWormhole.sourceChain].transferFeeBps : 0;
  const estimatedFee = amount ? (parseFloat(amount) * transferFeeBps / 10000).toFixed(4) : "0.0000";

  return (
    <div className="container mx-auto px-4 py-8 space-y-12 max-w-6xl">
      {/* Header */}
      <section className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Orbit className="w-10 h-10 text-neon-cyan animate-pulse" />
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-white tracking-tighter" data-testid="text-wormhole-title">
            ZK-Wormhole Portal
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto font-mono text-sm">
          Secure per-user cross-chain tunnels leveraging zk-SNARK proofs for instant, trustless asset migration across 11 sovereign networks.
        </p>
      </section>

      {/* Network Stats Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="cosmic-card h-24 animate-pulse bg-white/5" />
          ))
        ) : (
          <>
            <div className="cosmic-card p-4 space-y-1" data-testid="stat-total-portals">
              <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Total Portals</p>
              <p className="text-2xl font-mono text-white">{networkStats?.totalPortals || 0}</p>
            </div>
            <div className="cosmic-card p-4 space-y-1" data-testid="stat-volume">
              <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Volume Transferred</p>
              <p className="text-2xl font-mono text-neon-cyan">{networkStats?.volumeTransferred || "0 SKYNT"}</p>
            </div>
            <div className="cosmic-card p-4 space-y-1" data-testid="stat-active-wormholes">
              <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Active Wormholes</p>
              <p className="text-2xl font-mono text-neon-green">{networkStats?.activeWormholes || 0}</p>
            </div>
            <div className="cosmic-card p-4 space-y-1" data-testid="stat-proofs">
              <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Proofs Verified</p>
              <p className="text-2xl font-mono text-neon-magenta">{networkStats?.proofsVerified || 0}</p>
            </div>
          </>
        )}
      </section>

      {/* Open Wormhole Panel */}
      <section className="cosmic-card cosmic-card-cyan p-6 md:p-8 space-y-8 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-neon-cyan" /> Open New Portal
          </h2>
          {sourceChain !== destChain && (
            <Badge variant="outline" className={`font-mono ${getComplexityLabel(sourceChain, destChain).color}`}>
              {getComplexityLabel(sourceChain, destChain).label}
            </Badge>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 relative">
          <div className="w-full md:w-1/3 space-y-2">
            <label className="text-xs font-heading text-muted-foreground uppercase px-1">Source Chain</label>
            <div className="relative">
              <select 
                value={sourceChain} 
                onChange={(e) => setSourceChain(e.target.value as ZkWormholeChainId)}
                className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-cyan transition-colors"
                data-testid="select-source-chain"
              >
                {Object.values(ZK_WORMHOLE_CHAINS).map(chain => (
                  <option key={chain.id} value={chain.id}>{chain.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[sourceChain].tunnelColor }} />
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Animated Wormhole Tunnel */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 relative min-h-[60px] w-full">
            <div className="absolute w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-wormhole-flow w-1/2" />
            </div>
            <style>{`
              @keyframes wormhole-flow {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
              .animate-wormhole-flow {
                animation: wormhole-flow 2s infinite linear;
              }
            `}</style>
            <div className="mt-4 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-neon-green" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase">zk-SNARK Secured</span>
              </div>
              <div className="text-[10px] font-mono text-neon-cyan opacity-50">
                TRANS-SPACIAL LINK ACTIVE
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/3 space-y-2">
            <label className="text-xs font-heading text-muted-foreground uppercase px-1">Destination Chain</label>
            <div className="relative">
              <select 
                value={destChain} 
                onChange={(e) => setDestChain(e.target.value as ZkWormholeChainId)}
                className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-cyan transition-colors"
                data-testid="select-dest-chain"
              >
                {Object.values(ZK_WORMHOLE_CHAINS).map(chain => (
                  <option key={chain.id} value={chain.id}>{chain.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[destChain].tunnelColor }} />
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        <Button 
          data-testid="button-open-wormhole"
          onClick={handleOpenWormhole}
          disabled={openWormholeMutation.isPending || sourceChain === destChain}
          className="w-full bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/40 font-heading tracking-widest h-12 relative group"
        >
          {openWormholeMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Orbit className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              OPEN WORMHOLE PORTAL
            </>
          )}
        </Button>
      </section>

      {/* Active Wormholes Grid */}
      <section className="space-y-6">
        <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-green" /> Active User Wormholes
        </h2>
        
        {statusLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="cosmic-card h-48 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : wormholes.length === 0 ? (
          <div className="cosmic-card p-12 text-center space-y-4">
            <Orbit className="w-12 h-12 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground font-mono">No active wormholes detected. Open a portal to start bridging.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wormholes.map(wh => (
              <div key={wh.id} className="cosmic-card p-5 space-y-4 relative group hover-elevate" data-testid={`card-wormhole-${wh.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[wh.sourceChain].tunnelColor }} />
                    <span className="font-heading text-xs text-white">{ZK_WORMHOLE_CHAINS[wh.sourceChain].name}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[wh.destChain].tunnelColor }} />
                    <span className="font-heading text-xs text-white">{ZK_WORMHOLE_CHAINS[wh.destChain].name}</span>
                  </div>
                  <Badge className={`uppercase text-[9px] font-mono ${
                    wh.status === 'open' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
                    wh.status === 'bridging' ? 'bg-neon-orange/10 text-neon-orange border-neon-orange/20' :
                    wh.status === 'sealed' ? 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20' :
                    'bg-white/5 text-muted-foreground border-white/10'
                  }`}>
                    {wh.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">CAPACITY</span>
                    <span className="text-white">{wh.totalTransferred} / {wh.capacity} SKYNT</span>
                  </div>
                  <Progress value={(parseFloat(wh.totalTransferred) / wh.capacity) * 100} className="h-1 bg-white/5" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-heading text-muted-foreground uppercase">Transfers</p>
                    <p className="font-mono text-sm text-white">{wh.transferCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-heading text-muted-foreground uppercase">Φ Boost</p>
                    <p className="font-mono text-sm text-neon-cyan">+{wh.phiBoost.toFixed(2)}x</p>
                  </div>
                </div>

                <div className="pt-2 space-y-2 border-t border-white/5">
                  <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-muted-foreground">PORTAL ID</span>
                    <span className="text-white opacity-60">{wh.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-muted-foreground">ZK PROOF</span>
                    <span className="text-neon-magenta opacity-60">{wh.zkProofHash.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {(wh.status === 'open' || wh.status === 'bridging') && (
                    <Button 
                      size="sm"
                      variant="destructive"
                      onClick={() => closeWormholeMutation.mutate(wh.id)}
                      disabled={closeWormholeMutation.isPending}
                      className="w-full h-8 text-[10px] font-heading tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                      data-testid={`button-close-wormhole-${wh.id}`}
                    >
                      {closeWormholeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "CLOSE PORTAL"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transfer Panel */}
      <section className="cosmic-card cosmic-card-magenta p-6 md:p-8 space-y-6">
        <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5 text-neon-magenta" /> Initiate Cross-Chain Transfer
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-heading text-muted-foreground uppercase px-1">Select Portal</label>
              <div className="relative">
                <select 
                  value={selectedWormholeId} 
                  onChange={(e) => setSelectedWormholeId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-magenta transition-colors"
                  data-testid="select-active-wormhole"
                >
                  <option value="">Select an active wormhole...</option>
                  {wormholes.filter(w => w.status === 'open').map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {ZK_WORMHOLE_CHAINS[wh.sourceChain].name} → {ZK_WORMHOLE_CHAINS[wh.destChain].name} ({wh.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-heading text-muted-foreground uppercase px-1">Amount</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-mono text-sm focus:outline-none focus:border-neon-magenta transition-colors"
                  data-testid="input-transfer-amount"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-heading text-muted-foreground uppercase px-1">Token</label>
                <div className="relative">
                  <select 
                    value={token} 
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-magenta transition-colors"
                    data-testid="select-token"
                  >
                    <option value="SKYNT">SKYNT</option>
                    <option value="ETH">ETH</option>
                    <option value="STX">STX</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/20 border border-white/5 rounded-sm space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Estimated Fee</span>
                <span className="text-white">{estimatedFee} {token}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Trans-Spacial Latency</span>
                <span className="text-neon-cyan">~2.4s (zk-Proof)</span>
              </div>
              <div className="flex justify-between text-xs font-mono border-t border-white/5 pt-2 mt-2">
                <span className="text-muted-foreground">Total to Deduct</span>
                <span className="text-neon-magenta font-bold">
                  {amount ? (parseFloat(amount) + parseFloat(estimatedFee)).toFixed(4) : "0.0000"} {token}
                </span>
              </div>
            </div>

            <Button 
              data-testid="button-initiate-transfer"
              onClick={handleInitiateTransfer}
              disabled={initiateTransferMutation.isPending || !selectedWormholeId || !amount}
              className="w-full bg-neon-magenta/20 hover:bg-neon-magenta/30 text-neon-magenta border border-neon-magenta/40 font-heading tracking-widest h-12"
            >
              {initiateTransferMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "INITIATE TRANSFER"}
            </Button>
          </div>

          <div className="flex flex-col justify-center space-y-6">
            <h3 className="text-sm font-heading text-muted-foreground uppercase tracking-wider text-center">Proof Pipeline Status</h3>
            
            <div className="space-y-4">
              {[
                { label: "ZK Proof Generation", icon: Hash },
                { label: "Guardian Verification", icon: Shield },
                { label: "Bridge Execution", icon: ArrowDownUp },
                { label: "Wormhole Completion", icon: CheckCircle }
              ].map((step, idx) => {
                const stepNum = idx + 1;
                const isActive = transferStep === stepNum;
                const isCompleted = transferStep > stepNum;
                const isPending = transferStep > 0 && transferStep < stepNum;

                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                      isCompleted ? 'bg-neon-green/20 border-neon-green text-neon-green' :
                      isActive ? 'bg-neon-magenta/20 border-neon-magenta text-neon-magenta animate-pulse' :
                      'bg-white/5 border-white/10 text-muted-foreground opacity-40'
                    }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-heading ${isActive ? 'text-white' : 'text-muted-foreground'}`}>{step.label}</span>
                        {isActive && <Loader2 className="w-3 h-3 animate-spin text-neon-magenta" />}
                      </div>
                      <Progress value={isCompleted ? 100 : isActive ? 50 : 0} className="h-1 bg-white/5" />
                    </div>
                  </div>
                );
              })}
            </div>

            {transferStep === 0 && !initiateTransferMutation.isPending && (
              <div className="p-4 border border-dashed border-white/10 rounded-sm text-center">
                <p className="text-[10px] font-mono text-muted-foreground/40 italic uppercase">Awaiting Transfer Initiation...</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gasless Transfer Engine */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-neon-green" />
          <h2 className="text-xl font-heading font-bold text-white">Gasless Transfer Engine</h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            <span className="text-[10px] font-mono text-neon-green uppercase tracking-widest">Relayer Active</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ETH → Solana Gasless Panel */}
          <div className="cosmic-card cosmic-card-green p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-neon-green/10 border-l border-b border-neon-green/20 rounded-bl-lg">
              <span className="text-[9px] font-mono text-neon-green uppercase tracking-widest">Wormhole SDK v2</span>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading text-sm text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-neon-green" />
                ETH → Solana Gasless Bridge
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground">
                Wormhole automatic relayer covers Solana redemption. Recipient needs zero SOL.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-heading text-muted-foreground uppercase">Amount</label>
                  <input
                    type="number"
                    value={gaslessAmount}
                    onChange={e => setGaslessAmount(e.target.value)}
                    placeholder="0.001"
                    className="w-full bg-black/40 border border-white/10 rounded-sm p-2.5 font-mono text-sm focus:outline-none focus:border-neon-green transition-colors"
                    data-testid="input-gasless-amount"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-heading text-muted-foreground uppercase">Token</label>
                  <select
                    value={gaslessToken}
                    onChange={e => setGaslessToken(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-sm p-2.5 font-heading text-sm appearance-none focus:outline-none focus:border-neon-green transition-colors"
                    data-testid="select-gasless-token"
                  >
                    <option value="ETH">ETH</option>
                    <option value="SKYNT">SKYNT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-heading text-muted-foreground uppercase">Solana Recipient Address</label>
                <input
                  type="text"
                  value={gaslessRecipient}
                  onChange={e => setGaslessRecipient(e.target.value)}
                  placeholder="So1ana...pubkey"
                  className="w-full bg-black/40 border border-white/10 rounded-sm p-2.5 font-mono text-xs focus:outline-none focus:border-neon-green transition-colors"
                  data-testid="input-gasless-recipient"
                />
              </div>
            </div>

            {quoteResult && (
              <div className="bg-neon-green/5 border border-neon-green/20 rounded-lg p-3 space-y-1.5 text-[10px] font-mono">
                <div className="text-neon-green font-bold uppercase mb-1">SDK Quote</div>
                {quoteResult.deliveryCost && <div className="flex justify-between"><span className="text-muted-foreground">Delivery Cost</span><span className="text-white">{quoteResult.deliveryCost} ETH</span></div>}
                {quoteResult.deliveryCostUsd && <div className="flex justify-between"><span className="text-muted-foreground">USD Est.</span><span className="text-neon-green">${quoteResult.deliveryCostUsd}</span></div>}
                {quoteResult.estimatedTime && <div className="flex justify-between"><span className="text-muted-foreground">Est. Time</span><span className="text-white">{quoteResult.estimatedTime}</span></div>}
                {quoteResult.relayerFee && <div className="flex justify-between"><span className="text-muted-foreground">Relayer Fee</span><span className="text-neon-green">{quoteResult.relayerFee} ETH</span></div>}
                {quoteResult.route && <div className="flex justify-between"><span className="text-muted-foreground">Route</span><span className="text-white">{quoteResult.route}</span></div>}
              </div>
            )}

            <div className="space-y-2">
              {gaslessStages.map((stage, idx) => {
                const stageNum = idx + 1;
                const done = gaslessStep > stageNum;
                const active = gaslessStep === stageNum;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] transition-all ${
                      done ? "bg-neon-green/20 border-neon-green text-neon-green" :
                      active ? "bg-neon-green/10 border-neon-green/60 text-neon-green animate-pulse" :
                      "bg-white/5 border-white/10 text-muted-foreground/30"
                    }`}>
                      {done ? <CheckCircle className="w-3 h-3" /> : <stage.icon className="w-3 h-3" />}
                    </div>
                    <span className={`text-[10px] font-mono ${active ? "text-white" : done ? "text-neon-green" : "text-muted-foreground/40"}`}>
                      {stage.label}
                    </span>
                    {active && <Loader2 className="w-3 h-3 animate-spin text-neon-green ml-auto" />}
                  </div>
                );
              })}
            </div>

            {gaslessResult && (
              <div className="bg-black/30 border border-neon-green/20 rounded-lg p-3 text-[10px] font-mono space-y-1">
                <div className="text-neon-green font-bold">Transfer Result</div>
                {gaslessResult.txHash && <div className="flex justify-between"><span className="text-muted-foreground">TX Hash</span><span className="text-white">{gaslessResult.txHash.slice(0,14)}…</span></div>}
                {gaslessResult.status && <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-neon-green">{gaslessResult.status}</span></div>}
                {gaslessResult.message && <div className="text-muted-foreground mt-1">{gaslessResult.message}</div>}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => quoteMutation.mutate({ sourceChain: "ethereum", destChain: "solana", token: gaslessToken, amount: gaslessAmount })}
                disabled={quoteMutation.isPending}
                className="flex-1 bg-white/5 hover:bg-neon-green/10 text-white border border-white/10 hover:border-neon-green/40 font-heading text-[10px] tracking-widest h-9"
                data-testid="button-get-quote"
              >
                {quoteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "GET QUOTE"}
              </Button>
              <Button
                size="sm"
                onClick={() => gaslessWhMutation.mutate({
                  sourceChain: "ethereum", destChain: "solana",
                  token: gaslessToken, amount: gaslessAmount,
                  recipientAddress: gaslessRecipient || "11111111111111111111111111111112",
                })}
                disabled={gaslessWhMutation.isPending || !gaslessAmount}
                className="flex-1 bg-neon-green/20 hover:bg-neon-green/30 text-neon-green border border-neon-green/40 font-heading text-[10px] tracking-widest h-9"
                data-testid="button-gasless-transfer"
              >
                {gaslessWhMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "GASLESS SEND"}
              </Button>
            </div>
          </div>

          {/* Kora Gasless Relay Panel */}
          <div className="cosmic-card cosmic-card-cyan p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-neon-cyan/10 border-l border-b border-neon-cyan/20 rounded-bl-lg">
              <span className="text-[9px] font-mono text-neon-cyan uppercase tracking-widest">Kora Protocol</span>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading text-sm text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-neon-cyan" />
                Kora SOL Gasless Relay
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground">
                Treasury SOL keypair acts as fee-payer. Users broadcast Solana txns with zero SOL balance.
              </p>
            </div>

            <div className="bg-black/20 border border-white/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
                  <Wallet className="w-4 h-4 text-neon-cyan" />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Fee Payer</div>
                  <div className="text-xs font-mono text-neon-cyan">Treasury SOL Keypair (SOLANA_TREASURY_KEY)</div>
                </div>
              </div>
              <Separator className="bg-white/5" />
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                <div>
                  <div className="text-muted-foreground uppercase mb-0.5">Network</div>
                  <div className="text-white">Solana Mainnet</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase mb-0.5">Gas Cost User</div>
                  <div className="text-neon-green font-bold">0 SOL</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase mb-0.5">Relay Method</div>
                  <div className="text-white">tx.feePayer inject</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase mb-0.5">Blockhash</div>
                  <div className="text-white">Auto-refresh</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {koraStages.map((stage, idx) => {
                const stageNum = idx + 1;
                const done = koraStep > stageNum;
                const active = koraStep === stageNum;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] transition-all ${
                      done ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan" :
                      active ? "bg-neon-cyan/10 border-neon-cyan/60 text-neon-cyan animate-pulse" :
                      "bg-white/5 border-white/10 text-muted-foreground/30"
                    }`}>
                      {done ? <CheckCircle className="w-3 h-3" /> : <stage.icon className="w-3 h-3" />}
                    </div>
                    <span className={`text-[10px] font-mono ${active ? "text-white" : done ? "text-neon-cyan" : "text-muted-foreground/40"}`}>
                      {stage.label}
                    </span>
                    {active && <Loader2 className="w-3 h-3 animate-spin text-neon-cyan ml-auto" />}
                  </div>
                );
              })}
            </div>

            {koraResult && (
              <div className="bg-black/30 border border-neon-cyan/20 rounded-lg p-3 text-[10px] font-mono space-y-1">
                <div className="text-neon-cyan font-bold">Relay Result</div>
                {koraResult.signature && <div className="flex justify-between"><span className="text-muted-foreground">Signature</span><span className="text-white">{koraResult.signature.slice(0,14)}…</span></div>}
                {koraResult.status && <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-neon-cyan">{koraResult.status}</span></div>}
                {koraResult.feePaidBy && <div className="flex justify-between"><span className="text-muted-foreground">Fee Paid By</span><span className="text-neon-green">{koraResult.feePaidBy}</span></div>}
                {koraResult.message && <div className="text-muted-foreground mt-1">{koraResult.message}</div>}
              </div>
            )}

            {koraStep === 0 && !koraResult && (
              <div className="p-4 border border-dashed border-white/10 rounded-sm text-center">
                <p className="text-[9px] font-mono text-muted-foreground/40 uppercase">Configure SOLANA_TREASURY_KEY secret to enable live relay</p>
              </div>
            )}

            <Button
              onClick={() => koraMutation.mutate()}
              disabled={koraMutation.isPending}
              className="w-full bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/40 font-heading tracking-widest h-10 text-[10px]"
              data-testid="button-kora-relay"
            >
              {koraMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "TEST KORA GASLESS RELAY"}
            </Button>
          </div>
        </div>

        {/* Architecture banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { color: "text-neon-green", label: "ETH Gasless", desc: "Wormhole relayer network pays Solana redemption fees. User signs only on Ethereum." },
            { color: "text-neon-cyan", label: "SOL Gasless (Kora)", desc: "Treasury SOL key injected as tx.feePayer. User needs zero SOL to transact." },
            { color: "text-neon-magenta", label: "ZK Proof Gate", desc: "IZKVerifier.verifyProof() called on-chain before every bridge initiation." },
          ].map(({ color, label, desc }) => (
            <div key={label} className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-1">
              <div className={`text-[10px] font-heading font-bold uppercase ${color}`}>{label}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Transfer History */}
      <section className="space-y-6 pb-12">
        <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-neon-cyan" /> Portal History
        </h2>

        <div className="cosmic-card overflow-hidden">
          {transfersLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-neon-cyan mx-auto" /></div>
          ) : transfers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono">No transfers recorded in the protocol logs.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-white/5 text-muted-foreground uppercase text-[10px] font-heading">
                    <th className="p-4">Route</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Proof Hash</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transfers.map(tx => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{ZK_WORMHOLE_CHAINS[tx.sourceChain].name}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-white">{ZK_WORMHOLE_CHAINS[tx.destChain].name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-neon-cyan">{tx.amount} {tx.token}</span>
                      </td>
                      <td className="p-4">
                        <Badge className={`uppercase text-[9px] ${
                          tx.status === 'completed' ? 'bg-neon-green/10 text-neon-green' :
                          tx.status === 'verified' ? 'bg-neon-cyan/10 text-neon-cyan' :
                          tx.status === 'pending' ? 'bg-neon-orange/10 text-neon-orange' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-muted-foreground opacity-60">{tx.proofHash.slice(0, 12)}...</span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
