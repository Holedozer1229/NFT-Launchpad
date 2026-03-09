import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { useAccount } from "wagmi";
import {
  Rocket, CheckCircle2, Loader2, AlertTriangle, Zap,
  FileCode2, Shield, TrendingUp, Orbit, Image, Eye,
  ChevronDown, ChevronUp, Copy, ExternalLink, Layers
} from "lucide-react";

const NEON = {
  cyan: "#00e5ff",
  green: "#39ff14",
  orange: "#ff6d00",
  purple: "#b388ff",
  pink: "#ff4081",
  gold: "#ffd740",
};

const CHAIN_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ethereum: { label: "Ethereum", color: NEON.cyan, icon: "ETH" },
  zksync: { label: "zkSync Era", color: NEON.purple, icon: "ZK" },
  polygon: { label: "Polygon", color: NEON.pink, icon: "MATIC" },
  arbitrum: { label: "Arbitrum", color: NEON.orange, icon: "ARB" },
  stacks: { label: "Stacks", color: NEON.gold, icon: "STX" },
};

const CONTRACT_ICONS: Record<string, any> = {
  SpaceFlightNFT: Image,
  SphinxBridge: Shield,
  SphinxYieldAggregator: TrendingUp,
  SkynetZkBridge: Zap,
  ZkWormhole: Orbit,
  RocketBabesNFT: Rocket,
  ECDSAVerifier: Shield,
  SpectralEntropyVerifier: Eye,
  SkynetBridge: Layers,
};

interface DeployResult {
  message: string;
  totalContracts: number;
  totalNew: number;
  totalExisting: number;
  chains: Record<string, {
    status: string;
    newCount?: number;
    existingCount?: number;
    count?: number;
    deployments: Array<{
      id: number;
      contractId: string;
      contractName: string;
      chain: string;
      deployedAddress: string;
      txHash: string;
      gasUsed: string;
      status: string;
      blockNumber: number;
    }>;
  }>;
  contractDefinitions: Array<{ id: string; name: string; description: string }>;
}

interface ContractInfo {
  id: string;
  name: string;
  description: string;
  estimatedGas: { min: number; max: number };
}

export default function ContractDeployment() {
  const { address } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [deployPhase, setDeployPhase] = useState<string>("");

  const { data: contractsInfo } = useQuery<{
    contracts: ContractInfo[];
    totalContracts: number;
    supportedChains: string[];
  }>({
    queryKey: ["/api/deployments/contracts"],
  });

  const { data: existingDeployments } = useQuery<any[]>({
    queryKey: ["/api/deployments/address", address],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/deployments/address/${address}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const parseApiError = (err: Error): string => {
    const raw = err.message.replace(/^\d+:\s*/, "");
    try {
      const parsed = JSON.parse(raw);
      return parsed.message || raw;
    } catch {
      return raw;
    }
  };

  const deployAllMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect wallet first");
      setDeployPhase("Initializing cross-chain deployment sequence...");
      const res = await apiRequest("POST", "/api/deployments/deploy-all", { walletAddress: address });
      return res.json();
    },
    onSuccess: (data: DeployResult) => {
      setDeployResult(data);
      setDeployPhase("");
      queryClient.invalidateQueries({ queryKey: ["/api/deployments/address", address] });
      haptic("heavy");
      toast({
        title: "All Contracts Deployed",
        description: `${data.totalNew} new contracts deployed across ${Object.keys(data.chains).length} chains`,
      });
    },
    onError: (err: Error) => {
      setDeployPhase("");
      toast({ title: "Deployment Failed", description: parseApiError(err), variant: "destructive" });
    },
  });

  const deploySingleChainMutation = useMutation({
    mutationFn: async (chain: string) => {
      if (!address) throw new Error("Connect wallet first");
      const res = await apiRequest("POST", "/api/deployments/deploy", { walletAddress: address, chain });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments/address", address] });
      toast({ title: "Contracts Deployed", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Deployment Failed", description: parseApiError(err), variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Address copied to clipboard" });
  };

  const existingByChain = (existingDeployments || []).reduce((acc: Record<string, any[]>, d: any) => {
    if (!acc[d.chain]) acc[d.chain] = [];
    acc[d.chain].push(d);
    return acc;
  }, {});

  const totalExisting = existingDeployments?.length || 0;
  const totalPossible = (contractsInfo?.totalContracts || 9) * 5;
  const deployProgress = totalPossible > 0 ? (totalExisting / totalPossible) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2" data-testid="deploy-header">
        <div className="flex items-center justify-center gap-3">
          <FileCode2 className="w-8 h-8" style={{ color: NEON.cyan, filter: `drop-shadow(0 0 8px ${NEON.cyan})` }} />
          <h1 className="font-heading text-3xl font-bold tracking-widest text-foreground">CONTRACT DEPLOYMENT</h1>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          Deploy {contractsInfo?.totalContracts || 9} smart contracts across {contractsInfo?.supportedChains?.length || 5} chains
        </p>
      </div>

      <div
        className="rounded-lg border p-6 space-y-4"
        style={{
          background: "linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(179,136,255,0.05) 50%, rgba(255,64,129,0.05) 100%)",
          borderColor: `${NEON.cyan}33`,
        }}
        data-testid="deploy-overview"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="font-heading text-lg tracking-wider text-foreground">DEPLOYMENT STATUS</div>
            <div className="font-mono text-xs text-muted-foreground mt-1">
              {totalExisting} / {totalPossible} contracts deployed ({deployProgress.toFixed(0)}%)
            </div>
          </div>
          <div className="flex flex-1 gap-3">
            {address ? (
              <button
                data-testid="button-deploy-all"
                onClick={() => deployAllMutation.mutate()}
                disabled={deployAllMutation.isPending}
                className="w-full sm:w-auto px-6 py-3 rounded-lg font-heading text-sm tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${NEON.cyan}22, ${NEON.purple}22)`,
                  border: `1px solid ${NEON.cyan}66`,
                  color: NEON.cyan,
                  boxShadow: `0 0 20px ${NEON.cyan}22`,
                }}
              >
                {deployAllMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> DEPLOYING...</>
                ) : (
                  <><Rocket className="w-4 h-4" /> DEPLOY ALL CONTRACTS</>
                )}
              </button>
            ) : (
              <div className="px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-mono text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Connect wallet to deploy
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${deployProgress}%`,
              background: `linear-gradient(90deg, ${NEON.cyan}, ${NEON.green})`,
              boxShadow: `0 0 10px ${NEON.cyan}`,
            }}
          />
        </div>

        {deployPhase && (
          <div className="font-mono text-xs animate-pulse" style={{ color: NEON.cyan }}>
            {deployPhase}
          </div>
        )}
      </div>

      {deployResult && (
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: `${NEON.green}44`, background: `${NEON.green}08` }}
          data-testid="deploy-result"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" style={{ color: NEON.green }} />
            <span className="font-heading text-sm tracking-wider" style={{ color: NEON.green }}>
              DEPLOYMENT COMPLETE
            </span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">{deployResult.message}</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded border border-white/10 bg-white/5">
              <div className="font-heading text-lg" style={{ color: NEON.cyan }}>{deployResult.totalContracts}</div>
              <div className="text-[9px] font-mono text-muted-foreground">TOTAL</div>
            </div>
            <div className="text-center p-2 rounded border border-white/10 bg-white/5">
              <div className="font-heading text-lg" style={{ color: NEON.green }}>{deployResult.totalNew}</div>
              <div className="text-[9px] font-mono text-muted-foreground">NEW</div>
            </div>
            <div className="text-center p-2 rounded border border-white/10 bg-white/5">
              <div className="font-heading text-lg" style={{ color: NEON.orange }}>{deployResult.totalExisting}</div>
              <div className="text-[9px] font-mono text-muted-foreground">EXISTING</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="contract-list">
        {(contractsInfo?.contracts || []).map((contract) => {
          const Icon = CONTRACT_ICONS[contract.id] || FileCode2;
          const deployedChains = Object.keys(existingByChain).filter(chain =>
            existingByChain[chain]?.some((d: any) => d.contractId === contract.id)
          );
          return (
            <div
              key={contract.id}
              className="rounded-lg border p-4 space-y-2 transition-all hover:border-[var(--hover-color)]"
              style={{
                borderColor: deployedChains.length > 0 ? `${NEON.green}33` : "rgba(255,255,255,0.1)",
                background: deployedChains.length > 0 ? `${NEON.green}05` : "rgba(255,255,255,0.02)",
                "--hover-color": `${NEON.cyan}55`,
              } as any}
              data-testid={`contract-card-${contract.id}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: deployedChains.length > 0 ? NEON.green : NEON.cyan }} />
                <span className="font-heading text-xs tracking-wider text-foreground">{contract.name}</span>
                {deployedChains.length > 0 && (
                  <CheckCircle2 className="w-3 h-3 ml-auto" style={{ color: NEON.green }} />
                )}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">{contract.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-muted-foreground">
                  Gas: {(contract.estimatedGas.min / 1000).toFixed(0)}k - {(contract.estimatedGas.max / 1000).toFixed(0)}k
                </span>
                <div className="flex gap-1">
                  {deployedChains.map(chain => (
                    <span
                      key={chain}
                      className="text-[8px] font-mono px-1 rounded"
                      style={{
                        background: `${CHAIN_CONFIG[chain]?.color || NEON.cyan}22`,
                        color: CHAIN_CONFIG[chain]?.color || NEON.cyan,
                      }}
                    >
                      {CHAIN_CONFIG[chain]?.icon || chain}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3" data-testid="chain-deployments">
        <h2 className="font-heading text-lg tracking-wider text-foreground">CHAIN DEPLOYMENTS</h2>
        {Object.entries(CHAIN_CONFIG).map(([chainId, config]) => {
          const chainDeployments = existingByChain[chainId] || [];
          const isExpanded = expandedChain === chainId;
          const deployedCount = chainDeployments.length;
          const totalContracts = contractsInfo?.totalContracts || 9;

          return (
            <div
              key={chainId}
              className="rounded-lg border overflow-hidden transition-all"
              style={{ borderColor: deployedCount > 0 ? `${config.color}33` : "rgba(255,255,255,0.1)" }}
              data-testid={`chain-panel-${chainId}`}
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left transition-all hover:bg-white/5"
                onClick={() => setExpandedChain(isExpanded ? null : chainId)}
                data-testid={`button-expand-chain-${chainId}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-xs font-bold"
                    style={{ background: `${config.color}22`, color: config.color, border: `1px solid ${config.color}44` }}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <div className="font-heading text-sm tracking-wider text-foreground">{config.label}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {deployedCount} / {totalContracts} contracts
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {deployedCount === 0 && address && (
                    <button
                      data-testid={`button-deploy-chain-${chainId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deploySingleChainMutation.mutate(chainId);
                      }}
                      disabled={deploySingleChainMutation.isPending}
                      className="px-3 py-1.5 rounded text-[10px] font-heading tracking-wider transition-all"
                      style={{
                        background: `${config.color}15`,
                        border: `1px solid ${config.color}44`,
                        color: config.color,
                      }}
                    >
                      DEPLOY
                    </button>
                  )}
                  <div
                    className="w-16 h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(deployedCount / totalContracts) * 100}%`,
                        background: config.color,
                      }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && chainDeployments.length > 0 && (
                <div className="border-t border-white/5 divide-y divide-white/5">
                  {chainDeployments.map((dep: any) => {
                    const Icon = CONTRACT_ICONS[dep.contractId] || FileCode2;
                    return (
              <div key={dep.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-testid={`deployment-row-${dep.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" style={{ color: config.color }} />
                          <div className="min-w-0">
                            <div className="font-heading text-xs tracking-wider text-foreground">{dep.contractName}</div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              {dep.deployedAddress}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${NEON.green}15`, color: NEON.green }}>
                            {dep.status}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            {parseInt(dep.gasUsed).toLocaleString()} gas
                          </span>
                          <button
                            onClick={() => copyToClipboard(dep.deployedAddress)}
                            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy address"
                            data-testid={`button-copy-address-${dep.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && chainDeployments.length === 0 && (
                <div className="border-t border-white/5 p-6 text-center">
                  <p className="font-mono text-xs text-muted-foreground">No contracts deployed on {config.label} yet</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}
        data-testid="deploy-info"
      >
        <div className="font-heading text-xs tracking-wider text-muted-foreground mb-2">DEPLOYMENT INFO</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[10px]">
          <div>
            <span className="text-muted-foreground">Compiler: </span>
            <span className="text-foreground">Solidity 0.8.20</span>
          </div>
          <div>
            <span className="text-muted-foreground">Optimizer: </span>
            <span className="text-foreground">200 runs</span>
          </div>
          <div>
            <span className="text-muted-foreground">License: </span>
            <span className="text-foreground">MIT</span>
          </div>
          <div>
            <span className="text-muted-foreground">Treasury: </span>
            <span style={{ color: NEON.cyan }}>0x7Fbe...4895</span>
          </div>
        </div>
      </div>
    </div>
  );
}
