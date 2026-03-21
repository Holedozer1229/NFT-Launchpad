import { useState } from "react";
import {
  Orbit, Zap, Shield, ArrowDownUp, Hash, Activity, CheckCircle, Loader2,
  ChevronDown, Lock, Unlock, Globe, ExternalLink, ArrowRight, History,
  AlertTriangle, Coins, Users, Clock, Pickaxe, Fingerprint, DollarSign,
  Wallet, Cpu, Share2, Server, TrendingUp, RefreshCw
} from "lucide-react";
import { useAccount, useConnect } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePrices } from "@/hooks/use-prices";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ZK_WORMHOLE_CHAINS, type ZkWormholeChainId, SKYNT_CONTRACT_ADDRESS } from "@shared/schema";
import { haptic } from "@/lib/haptics";
import { isMobileDevice, openWalletApp } from "@/lib/wallet-utils";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

const BRIDGE_CHAINS = [
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "⟠", color: "hsl(210 100% 55%)" },
  { id: "skynt", name: "SphinxSkynet", symbol: "SKYNT", icon: "🦁", color: "hsl(40 100% 50%)" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎", color: "hsl(280 100% 60%)" },
  { id: "polygon", name: "Polygon", symbol: "MATIC", icon: "⬡", color: "hsl(300 100% 60%)" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", icon: "🔷", color: "hsl(210 100% 55%)" },
  { id: "base", name: "Base", symbol: "BASE", icon: "🔵", color: "hsl(210 100% 55%)" },
  { id: "zksync", name: "zkSync Era", symbol: "ETH", icon: "◆", color: "hsl(245 98% 77%)" },
  { id: "dogecoin", name: "Dogecoin", symbol: "DOGE", icon: "🐕", color: "hsl(43 60% 48%)" },
  { id: "monero", name: "Monero", symbol: "XMR", icon: "ⓜ", color: "hsl(24 100% 50%)" },
  { id: "stacks", name: "Stacks", symbol: "STX", icon: "⟐", color: "hsl(16 97% 59%)" },
];

type Tab = "bridge" | "wormhole" | "mining";

interface BridgeTx {
  id: number; fromChain: string; toChain: string; amount: string;
  token: string; status: string; signatures: string; mechanism: string;
  txHash: string | null; createdAt: string | null;
}
interface GuardianData {
  id: number; guardianIndex: number; status: string;
  lastSignature: string | null; publicKey: string | null;
}
interface BridgeMiningStatus {
  chain: string; phiTotal: number; qgScore: number; holoScore: number;
  fanoScore: number; spectralHash: string; gatesPassed: string[];
  rewardMultiplier: number; level: number;
}
interface P2PStatus {
  status: string; peerCount: number; activePeers: number; blockHeight: number;
  networkHashRate: string; consensusStatus: string; lastBlockTime: number;
}
interface WormholeNetworkStats {
  totalPortals: number; volumeTransferred: string;
  activeWormholes: number; proofsVerified: number;
}
interface WormholeStatus {
  id: string; sourceChain: ZkWormholeChainId; destChain: ZkWormholeChainId;
  status: "open" | "bridging" | "sealed" | "dormant";
  totalTransferred: string; capacity: number; transferCount: number;
  phiBoost: number; zkProofHash: string;
}
interface WormholeTransfer {
  id: string; wormholeId: string; sourceChain: ZkWormholeChainId;
  destChain: ZkWormholeChainId; amount: string; token: string;
  status: "pending" | "verified" | "completed" | "failed";
  proofHash: string; createdAt: string;
  externalRecipient?: string | null;
  onChainTxHash?: string | null;
  explorerUrl?: string | null;
  transmitStatus?: string | null;
}
interface RosettaStatus {
  blockchain: string; network: string; symbol: string; decimals: number;
  rosettaVersion: string; blockHeight: number; syncStatus: string;
  totalEndpoints: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CrossChain() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { connectors, connect: wagmiConnect, isPending: isConnecting } = useConnect();
  const { data: prices } = usePrices();

  const [activeTab, setActiveTab] = useState<Tab>("bridge");

  // Bridge state
  const [sourceChain, setSourceChain] = useState("ethereum");
  const [destChain, setDestChain] = useState("skynt");
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [showSourceDD, setShowSourceDD] = useState(false);
  const [showDestDD, setShowDestDD] = useState(false);
  const [bridgeSuccess, setBridgeSuccess] = useState(false);
  const [amountError, setAmountError] = useState("");

  // Wormhole state
  const [whSource, setWhSource] = useState<ZkWormholeChainId>("ethereum");
  const [whDest, setWhDest] = useState<ZkWormholeChainId>("skynt");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferToken, setTransferToken] = useState("SKYNT");
  const [selectedWormholeId, setSelectedWormholeId] = useState("");
  const [transferStep, setTransferStep] = useState(0);
  const [externalRecipient, setExternalRecipient] = useState("");
  const [lastTransferResult, setLastTransferResult] = useState<{ onChainTxHash?: string | null; explorerUrl?: string | null; transmitStatus?: string | null } | null>(null);

  // Queries — Bridge
  const { data: bridgeTxs = [], isLoading: txLoading } = useQuery<BridgeTx[]>({ queryKey: ["/api/bridge/transactions"], refetchInterval: 15000 });
  const { data: guardians = [], isLoading: guardiansLoading } = useQuery<GuardianData[]>({ queryKey: ["/api/bridge/guardians"], refetchInterval: 30000 });
  const { data: miningStatus = [] } = useQuery<BridgeMiningStatus[]>({ queryKey: ["/api/bridge/mining-status"], refetchInterval: 10000 });
  const { data: p2pStatus } = useQuery<P2PStatus>({ queryKey: ["/api/p2p/status"], refetchInterval: 15000 });

  // Queries — Wormhole
  const { data: networkStats } = useQuery<WormholeNetworkStats>({ queryKey: ["/api/wormhole/network"] });
  const { data: wormholes = [], isLoading: statusLoading } = useQuery<WormholeStatus[]>({ queryKey: ["/api/wormhole/status"] });
  const { data: transfers = [], isLoading: transfersLoading } = useQuery<WormholeTransfer[]>({ queryKey: ["/api/wormhole/all-transfers"] });

  // Queries — Rosetta
  const { data: rosetta } = useQuery<RosettaStatus>({ queryKey: ["/api/rosetta/status"], refetchInterval: 60000 });

  // Bridge mutations
  const bridgeMutation = useMutation({
    mutationFn: async (data: { fromChain: string; toChain: string; amount: string; mechanism: string }) => {
      const res = await apiRequest("POST", "/api/bridge/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bridge/transactions"] });
      setBridgeSuccess(true);
      setBridgeAmount("");
      setTimeout(() => setBridgeSuccess(false), 5000);
    },
  });

  // Wormhole mutations
  const openWormholeMutation = useMutation({
    mutationFn: async (body: { sourceChain: string; destChain: string }) => {
      const res = await apiRequest("POST", "/api/wormhole/open", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wormhole/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wormhole/network"] });
      haptic("success");
      toast({ title: "Wormhole Opened", description: "Cross-chain tunnel is now active." });
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
      queryClient.invalidateQueries({ queryKey: ["/api/wormhole/status"] });
      toast({ title: "Wormhole Sealed", description: "The cross-chain tunnel has been closed." });
    },
    onError: (error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  });

  const initiateTransferMutation = useMutation({
    mutationFn: async (body: { wormholeId: string; amount: string; token: string; externalRecipient?: string }) => {
      const res = await apiRequest("POST", "/api/wormhole/transfer", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wormhole/all-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wormhole/status"] });
      setLastTransferResult(null);
      setTransferStep(1);
      let step = 1;
      const interval = setInterval(() => {
        step += 1;
        setTransferStep(step);
        if (step >= 4) {
          clearInterval(interval);
          haptic("transaction");
          const hasExternal = data?.externalRecipient;
          toast({
            title: hasExternal ? "Transfer + On-Chain Transmit Queued" : "Transfer Initiated",
            description: hasExternal
              ? `ZK proof verified. Live transmit to ${data.externalRecipient.slice(0, 10)}... is processing.`
              : "Assets successfully wormholed.",
          });
          if (hasExternal) {
            const pollInterval = setInterval(async () => {
              await queryClient.invalidateQueries({ queryKey: ["/api/wormhole/all-transfers"] });
            }, 4000);
            setTimeout(() => clearInterval(pollInterval), 30000);
          }
          setTimeout(() => setTransferStep(0), 5000);
        }
      }, 2000);
    },
    onError: (error) => {
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
    }
  });

  // Bridge helpers
  const source = BRIDGE_CHAINS.find(c => c.id === sourceChain)!;
  const dest = BRIDGE_CHAINS.find(c => c.id === destChain)!;
  const isLockMint = sourceChain !== "skynt";
  const mechanism = isLockMint ? "Lock → Mint" : "Burn → Release";
  const bridgeFee = bridgeAmount ? (parseFloat(bridgeAmount) * 0.001).toFixed(4) : "0.0000";
  const netReceive = bridgeAmount ? (parseFloat(bridgeAmount) * 0.999).toFixed(4) : "0.0000";
  const estimatedTime = sourceChain === "ethereum" ? "~15 min" : "~5 min";
  const onlineGuardians = guardians.filter(g => g.status === "online").length;

  const validateAmount = (val: string) => {
    if (!val) { setAmountError(""); return; }
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) { setAmountError("Enter a valid positive amount"); return; }
    if (n < 0.001) { setAmountError("Minimum 0.001 SKYNT"); return; }
    if (n > 1000000) { setAmountError("Maximum 1,000,000 SKYNT"); return; }
    setAmountError("");
  };

  const swapChains = () => { setSourceChain(destChain); setDestChain(sourceChain); };

  // Wormhole helpers
  const getComplexityLabel = (s: ZkWormholeChainId, d: ZkWormholeChainId) => {
    const sum = ZK_WORMHOLE_CHAINS[s].proofComplexity + ZK_WORMHOLE_CHAINS[d].proofComplexity;
    if (sum <= 3) return { label: "Low Complexity", color: "text-neon-green" };
    if (sum <= 6) return { label: "Medium Complexity", color: "text-neon-orange" };
    return { label: "High Complexity", color: "text-neon-magenta" };
  };
  const selectedWormhole = wormholes.find(w => w.id === selectedWormholeId);
  const transferFeeBps = selectedWormhole ? ZK_WORMHOLE_CHAINS[selectedWormhole.sourceChain].transferFeeBps : 0;
  const estimatedFee = transferAmount ? (parseFloat(transferAmount) * transferFeeBps / 10000).toFixed(4) : "0.0000";

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "bridge", label: "SphinxBridge", icon: Coins },
    { id: "wormhole", label: "ZK-Wormhole", icon: Orbit },
    { id: "mining", label: "ZK-EVM Mining", icon: Pickaxe },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl" data-testid="crosschain-page">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Share2 className="w-8 h-8 text-neon-cyan animate-pulse" />
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-white tracking-tighter" data-testid="text-crosschain-title">
            Cross-Chain Portal
          </h1>
          <Orbit className="w-8 h-8 text-neon-magenta animate-pulse" />
        </div>
        <p className="text-muted-foreground font-mono text-sm max-w-2xl mx-auto">
          Unified SphinxBridge + ZK-Wormhole swap protocol — IIT consciousness-gated, Berry Phase verified, Rosetta-compatible
        </p>
      </div>

      {/* Rosetta Mainnet Status Strip */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-green/10 text-neon-green rounded-full border border-neon-green/20">
          <Server className="w-3 h-3" /> Rosetta API v{rosetta?.rosettaVersion || "1.4.13"} — Mainnet
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-cyan/10 text-neon-cyan rounded-full border border-neon-cyan/20">
          <Globe className="w-3 h-3" /> Block #{rosetta?.blockHeight?.toLocaleString() || "—"}
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
          <Cpu className="w-3 h-3" /> {rosetta?.totalEndpoints || 17} Rosetta Endpoints
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-green/10 text-neon-green rounded-full border border-neon-green/20">
          <CheckCircle className="w-3 h-3" /> {rosetta?.syncStatus || "synced"}
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-orange/10 text-neon-orange rounded-full border border-neon-orange/20">
          <Users className="w-3 h-3" /> {onlineGuardians}/9 Guardians
        </span>
      </div>

      {/* Wormhole Network Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="cosmic-card p-3 space-y-0.5" data-testid="stat-total-portals">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Total Portals</p>
          <p className="text-xl font-mono text-white">{networkStats?.totalPortals || 0}</p>
        </div>
        <div className="cosmic-card p-3 space-y-0.5" data-testid="stat-volume">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Volume Bridged</p>
          <p className="text-xl font-mono text-neon-cyan truncate">{networkStats?.volumeTransferred || "0 SKYNT"}</p>
        </div>
        <div className="cosmic-card p-3 space-y-0.5" data-testid="stat-active-wormholes">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">Active Portals</p>
          <p className="text-xl font-mono text-neon-green">{networkStats?.activeWormholes || 0}</p>
        </div>
        <div className="cosmic-card p-3 space-y-0.5" data-testid="stat-proofs">
          <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-wider">ZK Proofs Verified</p>
          <p className="text-xl font-mono text-neon-magenta">{networkStats?.proofsVerified || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-black/30 border border-border rounded-sm w-fit mx-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-heading tracking-wider transition-all ${
              activeTab === tab.id
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== BRIDGE TAB ========== */}
      {activeTab === "bridge" && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full">
              {isLockMint ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} {mechanism}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-cyan/10 text-neon-cyan rounded-full">
              <Shield className="w-3 h-3" /> 5-of-9 Multi-Sig
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-orange/10 text-neon-orange rounded-full">
              <Clock className="w-3 h-3" /> Est. {estimatedTime}
            </span>
          </div>

          {!isConnected && (
            <div className="cosmic-card cosmic-card-magenta p-5 text-center space-y-4">
              <Lock className="w-8 h-8 text-neon-orange mx-auto" />
              <p className="text-sm font-heading">External Wallet Required for Bridging</p>
              <p className="text-xs text-muted-foreground">Connect MetaMask or Phantom to sign bridge transactions.</p>
              <div className="flex gap-3 justify-center">
                <button
                  data-testid="button-bridge-connect-metamask"
                  onClick={() => {
                    if (isMobileDevice()) { openWalletApp("metamask"); return; }
                    const mm = connectors.find(c => c.name.toLowerCase().includes("metamask"));
                    if (mm) wagmiConnect({ connector: mm });
                  }}
                  disabled={isConnecting}
                  className="px-5 py-2.5 rounded-sm font-heading text-xs tracking-wider flex items-center gap-2 border border-[#E2761B]/40 bg-[#E2761B]/10 text-[#E2761B] hover:bg-[#E2761B]/20 transition-colors"
                >
                  🦊 MetaMask
                </button>
                <button
                  data-testid="button-bridge-connect-phantom"
                  onClick={() => {
                    if (isMobileDevice()) { openWalletApp("phantom"); return; }
                    const ph = connectors.find(c => c.name.toLowerCase().includes("phantom"));
                    if (ph) wagmiConnect({ connector: ph });
                  }}
                  disabled={isConnecting}
                  className="px-5 py-2.5 rounded-sm font-heading text-xs tracking-wider flex items-center gap-2 border border-[#AB9FF2]/40 bg-[#AB9FF2]/10 text-[#AB9FF2] hover:bg-[#AB9FF2]/20 transition-colors"
                >
                  👻 Phantom
                </button>
              </div>
            </div>
          )}

          {isConnected && (
            <div className="cosmic-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="font-mono text-[11px]">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}</span>
              </div>
            </div>
          )}

          {bridgeSuccess && (
            <div className="cosmic-card cosmic-card-green p-4 text-center space-y-2 animate-in fade-in">
              <CheckCircle className="w-5 h-5 text-neon-green mx-auto" />
              <p className="text-sm font-heading text-neon-green">Bridge Transaction Submitted</p>
              <p className="text-xs text-muted-foreground">Awaiting guardian multi-sig validation.</p>
            </div>
          )}

          <div className={`cosmic-card cosmic-card-cyan p-6 space-y-5 ${!isConnected ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="stat-label">Bridge SKYNT ERC-20</span>
              <span className="font-mono text-[10px] text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">{mechanism}</span>
            </div>

            {/* Source chain */}
            <div className="space-y-2">
              <label className="stat-label">From Network</label>
              <div className="relative">
                <button data-testid="button-source-chain" onClick={() => { setShowSourceDD(!showSourceDD); setShowDestDD(false); }}
                  className="w-full flex items-center justify-between p-3 bg-black/40 border border-border rounded-sm hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{source.icon}</span>
                    <div className="text-left">
                      <div className="text-sm font-heading">{source.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{source.symbol}</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {showSourceDD && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-sm shadow-lg max-h-56 overflow-y-auto">
                    {BRIDGE_CHAINS.filter(c => c.id !== destChain).map(chain => (
                      <button key={chain.id} data-testid={`option-source-${chain.id}`}
                        onClick={() => { setSourceChain(chain.id); setShowSourceDD(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
                        <span className="text-lg">{chain.icon}</span><span className="text-sm">{chain.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button data-testid="button-swap-chains" onClick={swapChains}
                className="p-2 rounded-full border border-border bg-black/40 hover:bg-primary/10 hover:border-primary/40 transition-all">
                <ArrowDownUp className="w-5 h-5 text-primary" />
              </button>
            </div>

            {/* Dest chain */}
            <div className="space-y-2">
              <label className="stat-label">To Network</label>
              <div className="relative">
                <button data-testid="button-dest-chain" onClick={() => { setShowDestDD(!showDestDD); setShowSourceDD(false); }}
                  className="w-full flex items-center justify-between p-3 bg-black/40 border border-border rounded-sm hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{dest.icon}</span>
                    <div className="text-left">
                      <div className="text-sm font-heading">{dest.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{dest.symbol}</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {showDestDD && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-sm shadow-lg max-h-56 overflow-y-auto">
                    {BRIDGE_CHAINS.filter(c => c.id !== sourceChain).map(chain => (
                      <button key={chain.id} data-testid={`option-dest-${chain.id}`}
                        onClick={() => { setDestChain(chain.id); setShowDestDD(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
                        <span className="text-lg">{chain.icon}</span><span className="text-sm">{chain.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="stat-label">Amount (SKYNT)</label>
              <div className="relative">
                <input data-testid="input-bridge-amount" type="number" placeholder="0.00" value={bridgeAmount}
                  onChange={e => { setBridgeAmount(e.target.value); validateAmount(e.target.value); }}
                  className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">SKYNT</span>
              </div>
              {amountError && <p className="text-[10px] font-mono text-red-400" data-testid="error-bridge-amount">{amountError}</p>}
            </div>

            {/* Fee breakdown */}
            <div className="space-y-2 p-3 bg-black/20 border border-border/50 rounded-sm">
              {[
                { icon: Zap, label: "Bridge Fee (0.1%)", val: `${bridgeFee} SKYNT` },
                { icon: Coins, label: "You Receive", val: `${netReceive} SKYNT`, color: "text-neon-green" },
                { icon: Clock, label: "Est. Time", val: estimatedTime },
                { icon: Users, label: "Required Sigs", val: "5 of 9 guardians" },
                { icon: Shield, label: "Mechanism", val: mechanism, color: "text-neon-cyan" },
              ].map(({ icon: Icon, label, val, color }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</span>
                  <span className={`font-mono ${color || ""}`}>{val}</span>
                </div>
              ))}
              {prices && bridgeAmount && parseFloat(bridgeAmount) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> USD Value</span>
                  <span className="font-mono text-primary">${(parseFloat(netReceive) * prices.SKYNT.usd).toFixed(2)}</span>
                </div>
              )}
            </div>

            <button data-testid="button-bridge-transfer"
              disabled={!bridgeAmount || parseFloat(bridgeAmount) <= 0 || !!amountError || bridgeMutation.isPending}
              onClick={() => bridgeMutation.mutate({ fromChain: source.name, toChain: dest.name, amount: bridgeAmount, mechanism })}
              className="connect-wallet-btn w-full py-3 rounded-sm font-heading text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
              {bridgeMutation.isPending ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {isLockMint ? "Locking..." : "Burning..."}</span>
              ) : (
                <span className="flex items-center justify-center gap-2"><Wallet className="w-4 h-4" /> {bridgeAmount ? `${isLockMint ? "Lock" : "Burn"} ${bridgeAmount} SKYNT` : "Enter Amount"}</span>
              )}
            </button>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 justify-center">
              <AlertTriangle className="w-3 h-3" /><span>Bridge transfers are irreversible. Guardians must validate before release.</span>
            </div>
          </div>

          {/* Guardian Network */}
          <div className="cosmic-card p-4">
            <h3 className="font-heading text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Guardian Network (9 Validators)
            </h3>
            {guardiansLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                {guardians.map(g => (
                  <div key={g.guardianIndex} className="text-center" data-testid={`guardian-${g.guardianIndex}`}>
                    <div className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center mx-auto text-[10px] font-heading ${
                      g.status === "online" ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-red-400/40 bg-red-400/5 text-red-400/60"
                    }`}>{g.guardianIndex}</div>
                    <p className={`text-[9px] mt-1 font-mono ${g.status === "online" ? "text-neon-green" : "text-red-400/60"}`}>{timeAgo(g.lastSignature)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="cosmic-card cosmic-card-orange p-4">
            <h3 className="font-heading text-sm uppercase tracking-wider mb-4 flex items-center gap-2" data-testid="text-recent-bridges">
              <Clock className="w-4 h-4 text-neon-orange" /> Recent Bridge Transactions
            </h3>
            {txLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-neon-orange" /></div>
            ) : bridgeTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No bridge transactions yet</p>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="data-table min-w-[480px]">
                  <thead><tr><th>Route</th><th>Amount</th><th>Status</th><th>Sigs</th><th>Time</th></tr></thead>
                  <tbody>
                    {bridgeTxs.map(tx => (
                      <tr key={tx.id} data-testid={`row-bridge-${tx.id}`}>
                        <td><span className="text-primary">{tx.fromChain}</span><span className="text-muted-foreground mx-1">→</span><span className="text-neon-green">{tx.toChain}</span></td>
                        <td>{tx.amount} {tx.token}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-heading uppercase ${
                            tx.status === "Released" || tx.status === "Minted" ? "bg-neon-green/10 text-neon-green" :
                            tx.status === "Locked" || tx.status === "Burned" ? "bg-neon-orange/10 text-neon-orange" : "bg-neon-cyan/10 text-neon-cyan"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tx.status === "Released" || tx.status === "Minted" ? "bg-neon-green" : "bg-neon-orange animate-pulse"}`} />
                            {tx.status}
                          </span>
                        </td>
                        <td className="font-mono">{tx.signatures}</td>
                        <td className="text-muted-foreground">{timeAgo(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Contract Info */}
          <div className="cosmic-card p-4">
            <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <Fingerprint className="w-3.5 h-3.5 text-primary" /> Contract Details
            </h3>
            <div className="space-y-2 text-xs font-mono">
              {[
                ["SKYNT ERC-20", SKYNT_CONTRACT_ADDRESS],
                ["Bridge Contract", "SkynetZkBridge.sol"],
                ["Network", "zkSync Era (Chain 324)"],
                ["Solidity", "^0.8.20"],
                ["Proof System", "Groth16 zk-SNARK"],
                ["Guardians", "9 (5 required)"],
                ["Fee", "0.1% (10 BPS)"],
                ["Rosetta API", "v1.4.13 / 17 endpoints"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="truncate max-w-[200px] text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========== WORMHOLE TAB ========== */}
      {activeTab === "wormhole" && (
        <div className="space-y-8">
          {/* Open Portal Panel */}
          <section className="cosmic-card cosmic-card-cyan p-6 md:p-8 space-y-8 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-neon-cyan" /> Open New ZK Portal
              </h2>
              {whSource !== whDest && (
                <Badge variant="outline" className={`font-mono ${getComplexityLabel(whSource, whDest).color}`}>
                  {getComplexityLabel(whSource, whDest).label}
                </Badge>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
              <div className="w-full md:w-1/3 space-y-2">
                <label className="text-xs font-heading text-muted-foreground uppercase px-1">Source Chain</label>
                <div className="relative">
                  <select value={whSource} onChange={e => setWhSource(e.target.value as ZkWormholeChainId)}
                    className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-cyan transition-colors"
                    data-testid="select-source-chain">
                    {Object.values(ZK_WORMHOLE_CHAINS).map(chain => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[whSource].tunnelColor }} />
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center py-4 relative min-h-[60px] w-full">
                <div className="absolute w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-transparent via-neon-cyan to-transparent w-1/2" style={{ animation: "wh-flow 2s infinite linear" }} />
                </div>
                <style>{`@keyframes wh-flow { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
                <div className="mt-4 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-neon-green" />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">zk-SNARK + IIT Gated</span>
                  </div>
                  <div className="text-[10px] font-mono text-neon-cyan opacity-50">BERRY PHASE VERIFIED</div>
                </div>
              </div>

              <div className="w-full md:w-1/3 space-y-2">
                <label className="text-xs font-heading text-muted-foreground uppercase px-1">Destination Chain</label>
                <div className="relative">
                  <select value={whDest} onChange={e => setWhDest(e.target.value as ZkWormholeChainId)}
                    className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-cyan transition-colors"
                    data-testid="select-dest-chain">
                    {Object.values(ZK_WORMHOLE_CHAINS).map(chain => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[whDest].tunnelColor }} />
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            <Button data-testid="button-open-wormhole"
              onClick={() => {
                if (whSource === whDest) { toast({ title: "Invalid Route", description: "Source and destination must differ.", variant: "destructive" }); return; }
                openWormholeMutation.mutate({ sourceChain: whSource, destChain: whDest });
              }}
              disabled={openWormholeMutation.isPending || whSource === whDest}
              className="w-full bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/40 font-heading tracking-widest h-12 relative group">
              {openWormholeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><Orbit className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" /> OPEN WORMHOLE PORTAL</>
              )}
            </Button>
          </section>

          {/* Active Wormholes */}
          <section className="space-y-4">
            <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-neon-green" /> Active Portals
            </h2>
            {statusLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(3).fill(0).map((_, i) => <div key={i} className="cosmic-card h-48 animate-pulse bg-white/5" />)}
              </div>
            ) : wormholes.length === 0 ? (
              <div className="cosmic-card p-12 text-center space-y-4">
                <Orbit className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                <p className="text-muted-foreground font-mono">No active portals. Open one above to start bridging.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wormholes.map(wh => (
                  <div key={wh.id} className="cosmic-card p-5 space-y-4 hover-elevate" data-testid={`card-wormhole-${wh.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[wh.sourceChain].tunnelColor }} />
                        <span className="font-heading text-xs text-white">{ZK_WORMHOLE_CHAINS[wh.sourceChain].name}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ZK_WORMHOLE_CHAINS[wh.destChain].tunnelColor }} />
                        <span className="font-heading text-xs text-white">{ZK_WORMHOLE_CHAINS[wh.destChain].name}</span>
                      </div>
                      <Badge className={`uppercase text-[9px] font-mono ${
                        wh.status === "open" ? "bg-neon-green/10 text-neon-green border-neon-green/20" :
                        wh.status === "bridging" ? "bg-neon-orange/10 text-neon-orange border-neon-orange/20" :
                        wh.status === "sealed" ? "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20" :
                        "bg-white/5 text-muted-foreground border-white/10"
                      }`}>{wh.status}</Badge>
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
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-muted-foreground">PORTAL ID</span>
                        <span className="opacity-60">{wh.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-muted-foreground">ZK PROOF</span>
                        <span className="text-neon-magenta opacity-60">{wh.zkProofHash.slice(0, 8)}...</span>
                      </div>
                    </div>
                    {(wh.status === "open" || wh.status === "bridging") && (
                      <Button size="sm" variant="destructive"
                        onClick={() => closeWormholeMutation.mutate(wh.id)}
                        disabled={closeWormholeMutation.isPending}
                        className="w-full h-8 text-[10px] font-heading tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                        data-testid={`button-close-wormhole-${wh.id}`}>
                        {closeWormholeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "CLOSE PORTAL"}
                      </Button>
                    )}
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
                    <select value={selectedWormholeId} onChange={e => setSelectedWormholeId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-magenta transition-colors"
                      data-testid="select-active-wormhole">
                      <option value="">Select an active portal...</option>
                      {wormholes.filter(w => w.status === "open").map(wh => (
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
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00"
                      className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-mono text-sm focus:outline-none focus:border-neon-magenta transition-colors"
                      data-testid="input-transfer-amount" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-heading text-muted-foreground uppercase px-1">Token</label>
                    <div className="relative">
                      <select value={transferToken} onChange={e => setTransferToken(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-sm p-3 font-heading text-sm appearance-none focus:outline-none focus:border-neon-magenta transition-colors"
                        data-testid="select-token">
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
                    <span>{estimatedFee} {transferToken}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Berry Phase Boost</span>
                    <span className="text-neon-cyan">+{selectedWormhole ? selectedWormhole.phiBoost.toFixed(2) : "0.00"}x</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">ZK Latency</span>
                    <span className="text-neon-cyan">~2.4s</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono border-t border-white/5 pt-2 mt-2">
                    <span className="text-muted-foreground">Total Deducted</span>
                    <span className="text-neon-magenta font-bold">
                      {transferAmount ? (parseFloat(transferAmount) + parseFloat(estimatedFee)).toFixed(4) : "0.0000"} {transferToken}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-heading text-muted-foreground uppercase px-1 flex items-center gap-2">
                    <ExternalLink className="w-3 h-3 text-neon-cyan" />
                    External Wallet Address
                    <span className="text-[10px] text-neon-cyan/60 normal-case font-mono">(optional — receive on dest chain)</span>
                  </label>
                  <input
                    type="text"
                    value={externalRecipient}
                    onChange={e => setExternalRecipient(e.target.value)}
                    placeholder="0x... or native address (e.g. SOL, DOGE)"
                    className="w-full bg-black/40 border border-neon-cyan/20 rounded-sm p-3 font-mono text-xs focus:outline-none focus:border-neon-cyan transition-colors placeholder:text-white/20"
                    data-testid="input-external-recipient"
                  />
                  {externalRecipient && (
                    <p className="text-[10px] font-mono text-neon-cyan/70 px-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse inline-block" />
                      Live on-chain transmit will fire on ZK proof completion
                    </p>
                  )}
                </div>
                <Button data-testid="button-initiate-transfer"
                  onClick={() => {
                    if (!selectedWormholeId || !transferAmount || parseFloat(transferAmount) <= 0) {
                      toast({ title: "Invalid Input", description: "Select a portal and enter a valid amount.", variant: "destructive" });
                      return;
                    }
                    initiateTransferMutation.mutate({
                      wormholeId: selectedWormholeId,
                      amount: transferAmount,
                      token: transferToken,
                      externalRecipient: externalRecipient.trim() || undefined,
                    });
                  }}
                  disabled={initiateTransferMutation.isPending || !selectedWormholeId || !transferAmount}
                  className="w-full bg-neon-magenta/20 hover:bg-neon-magenta/30 text-neon-magenta border border-neon-magenta/40 font-heading tracking-widest h-12">
                  {initiateTransferMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : externalRecipient ? "INITIATE + LIVE TRANSFER" : "INITIATE TRANSFER"}
                </Button>
              </div>

              <div className="flex flex-col justify-center space-y-6">
                <h3 className="text-sm font-heading text-muted-foreground uppercase tracking-wider text-center">Proof Pipeline</h3>
                <div className="space-y-4">
                  {[
                    { label: "IIT Consciousness Gate", icon: Cpu },
                    { label: "Berry Phase Verification", icon: Activity },
                    { label: "ZK Proof Generation", icon: Hash },
                    { label: "Guardian Validation", icon: Shield },
                  ].map((step, idx) => {
                    const stepNum = idx + 1;
                    const isActive = transferStep === stepNum;
                    const isCompleted = transferStep > stepNum;
                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                          isCompleted ? "bg-neon-green/20 border-neon-green text-neon-green" :
                          isActive ? "bg-neon-magenta/20 border-neon-magenta text-neon-magenta animate-pulse" :
                          "bg-white/5 border-white/10 text-muted-foreground opacity-40"
                        }`}>
                          {isCompleted ? <CheckCircle className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-heading ${isActive ? "text-white" : "text-muted-foreground"}`}>{step.label}</span>
                            {isActive && <Loader2 className="w-3 h-3 animate-spin text-neon-magenta" />}
                          </div>
                          <Progress value={isCompleted ? 100 : isActive ? 50 : 0} className="h-1 bg-white/5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Transfer History */}
          <section className="space-y-4">
            <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-neon-cyan" /> Portal History
            </h2>
            <div className="cosmic-card overflow-hidden">
              {transfersLoading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-neon-cyan mx-auto" /></div>
              ) : transfers.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-mono">No transfers recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-white/5 text-muted-foreground uppercase text-[10px] font-heading">
                        <th className="p-4">Route</th><th className="p-4">Amount</th><th className="p-4">Status</th>
                        <th className="p-4">On-Chain Tx</th><th className="p-4">Date</th>
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
                            {tx.externalRecipient && (
                              <div className="text-[10px] text-neon-cyan/60 mt-1 font-mono">
                                → {tx.externalRecipient.slice(0, 14)}...
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-neon-cyan">{tx.amount} {tx.token}</td>
                          <td className="p-4 space-y-1">
                            <Badge className={`uppercase text-[9px] ${
                              tx.status === "completed" ? "bg-neon-green/10 text-neon-green" :
                              tx.status === "verified" ? "bg-neon-cyan/10 text-neon-cyan" :
                              tx.status === "pending" ? "bg-neon-orange/10 text-neon-orange" : "bg-red-500/10 text-red-400"
                            }`}>{tx.status}</Badge>
                            {tx.transmitStatus && (
                              <div>
                                <Badge className={`uppercase text-[9px] ${
                                  tx.transmitStatus === "confirmed" ? "bg-neon-green/10 text-neon-green" :
                                  tx.transmitStatus === "simulated" ? "bg-neon-cyan/10 text-neon-cyan" :
                                  tx.transmitStatus === "queued" ? "bg-neon-orange/10 text-neon-orange" :
                                  tx.transmitStatus === "broadcast" ? "bg-blue-400/10 text-blue-400" :
                                  "bg-white/5 text-muted-foreground"
                                }`}>⛓ {tx.transmitStatus}</Badge>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {tx.onChainTxHash ? (
                              <div className="space-y-1">
                                <div className="text-muted-foreground opacity-70 font-mono text-[10px]">
                                  {tx.onChainTxHash.slice(0, 14)}...
                                </div>
                                {tx.explorerUrl ? (
                                  <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-neon-cyan text-[10px] flex items-center gap-1 hover:opacity-80 transition-opacity"
                                    data-testid={`link-explorer-${tx.id}`}>
                                    <ExternalLink className="w-3 h-3" /> View on Explorer
                                  </a>
                                ) : (
                                  <span className="text-neon-cyan/50 text-[10px]">Simulated</span>
                                )}
                              </div>
                            ) : tx.externalRecipient && tx.status !== "failed" ? (
                              <span className="text-neon-orange/60 text-[10px] font-mono flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> pending...
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-[10px] font-mono">{tx.proofHash?.slice(0, 12)}...</span>
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========== ZK-EVM MINING TAB ========== */}
      {activeTab === "mining" && (
        <div className="space-y-6">
          {/* P2P Network Status */}
          <div className="cosmic-card cosmic-card-cyan p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-neon-cyan" /> P2P Network Status
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${p2pStatus?.status === "online" ? "bg-neon-green animate-pulse" : "bg-red-500"}`} />
                <span className="text-[10px] font-mono uppercase text-muted-foreground">{p2pStatus?.status || "Offline"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Active Peers", val: `${p2pStatus?.activePeers ?? 0} / ${p2pStatus?.peerCount ?? 0}`, color: "text-neon-cyan" },
                { label: "Block Height", val: p2pStatus?.blockHeight?.toLocaleString() ?? "—", color: "text-primary" },
                { label: "Consensus", val: p2pStatus?.consensusStatus ?? "—", color: "text-neon-green" },
                { label: "Hash Rate", val: p2pStatus?.networkHashRate ?? "—", color: "text-neon-magenta" },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-2.5 bg-black/20 border border-border/50 rounded-sm">
                  <div className="text-[9px] text-muted-foreground font-heading uppercase tracking-tighter mb-1">{label}</div>
                  <div className={`text-sm font-mono truncate ${color}`}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bridge Mining Status */}
          <div className="cosmic-card cosmic-card-magenta p-4" data-testid="zk-bridge-mining-panel">
            <h3 className="font-heading text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Pickaxe className="w-4 h-4 text-neon-magenta" /> ZK-EVM Cross-Chain Mining
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4 font-mono">
              IIT consciousness-gated mining via QG Miner v8 three-gate validity pipeline. Berry Phase holonomy class determines reward multiplier.
            </p>
            {miningStatus.length === 0 ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-neon-magenta" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {miningStatus.map(ms => {
                  const chainInfo = BRIDGE_CHAINS.find(c => c.id === ms.chain);
                  return (
                    <div key={ms.chain} className="p-3 bg-black/30 border border-border/50 rounded-sm space-y-3" data-testid={`zk-mining-${ms.chain}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{chainInfo?.icon || "⛓️"}</span>
                          <span className="font-heading text-xs uppercase tracking-wider" style={{ color: chainInfo?.color }}>{chainInfo?.name || ms.chain}</span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20">GATE PASSED</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Φ_TOTAL", val: ms.phiTotal.toFixed(4), color: "text-neon-cyan" },
                          { label: "Φ_QG", val: ms.qgScore.toFixed(4), color: "text-neon-magenta" },
                          { label: "Φ_HOLO", val: ms.holoScore.toFixed(4), color: "text-primary" },
                          { label: "Φ_FANO", val: ms.fanoScore.toFixed(4), color: "text-neon-orange" },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="flex items-center justify-between text-[9px]">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`font-mono ${color}`}>{val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                        <div className="flex gap-1">
                          {["spectral", "consciousness", "qg_curvature"].map(gate => (
                            <div key={gate} title={gate.replace("_", " ")} className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                              ms.gatesPassed.includes(gate) ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-red-500/30 bg-red-500/5 text-red-500/40"
                            }`}>
                              <CheckCircle className="w-2.5 h-2.5" />
                            </div>
                          ))}
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] text-muted-foreground font-mono uppercase tracking-tighter">Reward Multiplier</div>
                          <div className="text-xs font-mono text-neon-green">{ms.rewardMultiplier.toFixed(2)}x</div>
                        </div>
                      </div>
                      <div className="text-[8px] font-mono text-muted-foreground/60 truncate">SPECTRAL: {ms.spectralHash}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Three-Gate Pipeline */}
            <div className="p-3 bg-black/20 border border-neon-magenta/20 rounded-sm space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-[10px] font-heading uppercase tracking-wider text-neon-cyan">Four-Stage ZK-EVM Pipeline</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                {[
                  { label: "1. IIT Spectral", color: miningStatus[0]?.gatesPassed.includes("spectral") ? "bg-neon-green/10 text-neon-green border-neon-green/20" : "bg-muted/10 text-muted-foreground border-border/20" },
                  { label: "2. Consciousness Gate", color: miningStatus[0]?.gatesPassed.includes("consciousness") ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20" : "bg-muted/10 text-muted-foreground border-border/20" },
                  { label: "3. QG Curvature", color: miningStatus[0]?.gatesPassed.includes("qg_curvature") ? "bg-neon-orange/10 text-neon-orange border-neon-orange/20" : "bg-muted/10 text-muted-foreground border-border/20" },
                  { label: "4. Berry ZK-Proof", color: "bg-primary/10 text-primary border-primary/20" },
                ].map(({ label, color }) => (
                  <span key={label} className={`px-2 py-1 rounded-sm border ${color}`}>{label}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border/20">
                {[
                  { label: "IIT Φ Engine", desc: "Consciousness gate via density matrix eigenvalues" },
                  { label: "Berry Phase Engine", desc: "Geometric holonomy class verification" },
                  { label: "ZK-Wormhole", desc: "Per-user zk-SNARK tunnel transfer proofs" },
                  { label: "Rosetta API", desc: "Coinbase-compatible mainnet data layer" },
                ].map(({ label, desc }) => (
                  <div key={label} className="p-2 bg-black/20 rounded-sm border border-border/20">
                    <div className="text-[9px] font-heading text-primary mb-0.5">{label}</div>
                    <div className="text-[8px] font-mono text-muted-foreground leading-relaxed">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
