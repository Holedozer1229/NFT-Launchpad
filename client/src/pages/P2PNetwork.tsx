import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Network, Download, Plus, Trash2, Radio, Globe, Server, Activity,
  Cpu, Shield, RefreshCw, ChevronDown, ChevronUp, Copy, Check,
  Zap, Link2, HardDrive, Clock, Hash, ArrowDownToLine, Wifi, WifiOff,
} from "lucide-react";

const NEON = {
  cyan: "#00f0ff",
  green: "#39ff14",
  orange: "#ff6b00",
  magenta: "#ff00ff",
  gold: "#ffd700",
  red: "#ff3333",
};

interface NetworkNode {
  nodeId: string;
  name: string;
  address: string;
  publicKey: string;
  version: string;
  chainHeight: number;
  chainHash: string;
  phiScore: number;
  status: "online" | "syncing" | "offline" | "bootstrapping";
  capabilities: string[];
  registeredAt: number;
  lastHeartbeat: number;
  latency: number;
  blocksValidated: number;
  blocksProposed: number;
  uptime: number;
  region: string;
  isSeedNode: boolean;
}

interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  syncingNodes: number;
  networkHashRate: number;
  consensusHeight: number;
  consensusHash: string;
  chainValid: boolean;
  totalBlocksValidated: number;
  networkPhiScore: number;
  uptimePercent: number;
  regionsActive: string[];
  lastBlockTime: number;
  avgBlockTime: number;
  pendingAnnouncements: number;
  networkVersion: string;
}

interface ChainSnapshot {
  version: number;
  networkId: string;
  genesisHash: string;
  blocks: any[];
  chainInfo: any;
  snapshotHeight: number;
  snapshotHash: string;
  timestamp: number;
  signature: string;
  totalSize: number;
}

function StatusDot({ status }: { status: string }) {
  const color = status === "online" ? NEON.green : status === "syncing" ? NEON.gold : status === "bootstrapping" ? NEON.cyan : NEON.red;
  return (
    <span
      data-testid={`status-dot-${status}`}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        marginRight: 6,
      }}
    />
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <div
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
      style={{
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${color}33`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
        <Icon size={14} style={{ color }} />
        <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Rajdhani, sans-serif", color: "#aaa" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontFamily: "Orbitron, sans-serif", fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#666", fontFamily: "Space Mono, monospace" }}>{sub}</div>}
    </div>
  );
}

function NodeRow({ node, onRemove }: { node: NetworkNode; onRemove?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(node.nodeId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const statusColor = node.status === "online" ? NEON.green : node.status === "syncing" ? NEON.gold : node.status === "bootstrapping" ? NEON.cyan : NEON.red;

  return (
    <div
      data-testid={`node-row-${node.nodeId}`}
      style={{
        background: "rgba(0,0,0,0.4)",
        border: `1px solid ${statusColor}22`,
        borderRadius: 8,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          cursor: "pointer",
          gap: 12,
        }}
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-${node.nodeId}`}
      >
        <StatusDot status={node.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {node.isSeedNode ? <Shield size={12} style={{ color: NEON.gold }} /> : <Server size={12} style={{ color: NEON.cyan }} />}
            <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>{node.name}</span>
            {node.isSeedNode && (
              <span style={{ fontSize: 9, background: `${NEON.gold}22`, color: NEON.gold, padding: "1px 6px", borderRadius: 4, fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}>SEED</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "Space Mono, monospace", marginTop: 2 }}>{node.address}</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 80 }}>
          <div style={{ fontSize: 11, fontFamily: "Space Mono, monospace", color: NEON.cyan }}>H:{node.chainHeight}</div>
          <div style={{ fontSize: 10, color: "#666" }}>{node.latency}ms</div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: "#666" }} /> : <ChevronDown size={14} style={{ color: "#666" }} />}
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: 11 }}>
            <div>
              <span style={{ color: "#666" }}>Node ID: </span>
              <span style={{ fontFamily: "Space Mono, monospace", color: NEON.cyan, fontSize: 10, cursor: "pointer" }} onClick={copyId} data-testid={`button-copy-${node.nodeId}`}>
                {node.nodeId.slice(0, 20)}... {copied ? <Check size={10} style={{ display: "inline" }} /> : <Copy size={10} style={{ display: "inline" }} />}
              </span>
            </div>
            <div><span style={{ color: "#666" }}>Version: </span><span style={{ color: "#ccc" }}>{node.version}</span></div>
            <div><span style={{ color: "#666" }}>Φ Score: </span><span style={{ color: NEON.magenta }}>{node.phiScore.toFixed(4)}</span></div>
            <div><span style={{ color: "#666" }}>Uptime: </span><span style={{ color: NEON.green }}>{node.uptime.toFixed(1)}%</span></div>
            <div><span style={{ color: "#666" }}>Blocks Validated: </span><span style={{ color: "#ccc" }}>{node.blocksValidated}</span></div>
            <div><span style={{ color: "#666" }}>Blocks Proposed: </span><span style={{ color: "#ccc" }}>{node.blocksProposed}</span></div>
            <div><span style={{ color: "#666" }}>Region: </span><span style={{ color: NEON.gold }}>{node.region}</span></div>
            <div><span style={{ color: "#666" }}>Status: </span><span style={{ color: statusColor, textTransform: "uppercase", fontWeight: 700 }}>{node.status}</span></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ color: "#666", fontSize: 10 }}>Capabilities: </span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {node.capabilities.map(c => (
                <span key={c} style={{ fontSize: 9, background: "rgba(0,240,255,0.1)", color: NEON.cyan, padding: "2px 6px", borderRadius: 4, fontFamily: "Rajdhani, sans-serif" }}>{c}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ color: "#666", fontSize: 10 }}>Public Key: </span>
            <span style={{ fontFamily: "Space Mono, monospace", fontSize: 9, color: "#888", wordBreak: "break-all" }}>{node.publicKey}</span>
          </div>
          {!node.isSeedNode && onRemove && (
            <button
              data-testid={`button-remove-${node.nodeId}`}
              onClick={() => onRemove(node.nodeId)}
              style={{
                marginTop: 10,
                background: `${NEON.red}22`,
                border: `1px solid ${NEON.red}44`,
                color: NEON.red,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Trash2 size={12} /> REMOVE NODE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function P2PNetwork() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [nodeAddress, setNodeAddress] = useState("");
  const [nodeRegion, setNodeRegion] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [chainData, setChainData] = useState<ChainSnapshot | null>(null);
  const [syncNodeId, setSyncNodeId] = useState("");
  const [syncing, setSyncing] = useState(false);

  const { data: stats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 10000,
  });

  const { data: nodes = [] } = useQuery<NetworkNode[]>({
    queryKey: ["/api/network/nodes"],
    refetchInterval: 15000,
  });

  const { data: announcements = [] } = useQuery<any[]>({
    queryKey: ["/api/network/announcements"],
    refetchInterval: 20000,
  });

  const registerMutation = useMutation({
    mutationFn: async (params: { name: string; address: string; region: string }) => {
      const res = await apiRequest("POST", "/api/network/node/register", {
        name: params.name,
        address: params.address,
        region: params.region,
        capabilities: ["full-node", "tx-relay", "block-validate"],
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/network/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/stats"] });
      toast({ title: "Node Registered", description: `${data.name} (${data.nodeId}) is now bootstrapping` });
      setShowRegister(false);
      setNodeName("");
      setNodeAddress("");
      setNodeRegion("");
    },
    onError: () => toast({ title: "Registration Failed", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const res = await apiRequest("DELETE", `/api/network/node/${nodeId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/network/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/stats"] });
      toast({ title: "Node Removed" });
    },
  });

  const downloadChain = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setChainData(null);
    try {
      const res = await fetch("/api/network/chain/download?from=0&limit=200");
      const data = await res.json();
      setChainData(data);
      setDownloadProgress(100);
      toast({ title: "Chain Downloaded", description: `${data.blocks.length} blocks (${(data.totalSize / 1024).toFixed(1)} KB)` });
    } catch {
      toast({ title: "Download Failed", variant: "destructive" });
    }
    setDownloading(false);
  };

  const syncNode = async () => {
    if (!syncNodeId) return;
    setSyncing(true);
    try {
      const res = await apiRequest("POST", "/api/network/chain/sync", {
        nodeId: syncNodeId,
        fromHeight: 0,
        toHeight: 99999,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/network/nodes"] });
      toast({ title: "Sync Complete", description: `${data.blocks.length} blocks synced (${data.fromHeight}-${data.toHeight})` });
    } catch {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
    setSyncing(false);
  };

  const exportChainJson = () => {
    if (!chainData) return;
    const blob = new Blob([JSON.stringify(chainData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skynt-genesis-chain-h${chainData.snapshotHeight}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const seedNodes = useMemo(() => nodes.filter(n => n.isSeedNode), [nodes]);
  const userNodes = useMemo(() => nodes.filter(n => !n.isSeedNode), [nodes]);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Network size={28} style={{ color: NEON.cyan }} />
          <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>
            SKYNT <span style={{ color: NEON.cyan }}>P2P</span> Network
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "#888", fontFamily: "Rajdhani, sans-serif", margin: 0 }}>
          Serverless peer-to-peer network for the SKYNT Genesis BTC hard fork blockchain. Download the chain, create nodes, and sync.
        </p>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Total Nodes" value={stats.totalNodes} icon={Server} color={NEON.cyan} />
          <StatCard label="Active" value={stats.activeNodes} icon={Wifi} color={NEON.green} sub={`${stats.syncingNodes} syncing`} />
          <StatCard label="Chain Height" value={stats.consensusHeight} icon={Hash} color={NEON.gold} />
          <StatCard label="Hash Rate" value={`${stats.networkHashRate.toFixed(1)}`} icon={Cpu} color={NEON.orange} sub="H/s" />
          <StatCard label="Network Φ" value={stats.networkPhiScore.toFixed(4)} icon={Zap} color={NEON.magenta} />
          <StatCard label="Chain Valid" value={stats.chainValid ? "YES" : "NO"} icon={Shield} color={stats.chainValid ? NEON.green : NEON.red} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${NEON.cyan}22`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Download size={16} style={{ color: NEON.cyan }} />
              <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Chain Download</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#888", fontFamily: "Rajdhani, sans-serif", marginBottom: 14, lineHeight: 1.5 }}>
            Download the full SKYNT Genesis blockchain snapshot. Contains all blocks, transactions, merkle roots, and Φ proofs from the BTC hard fork.
          </p>

          <button
            data-testid="button-download-chain"
            onClick={downloadChain}
            disabled={downloading}
            style={{
              width: "100%",
              padding: "12px",
              background: downloading ? "rgba(0,240,255,0.1)" : `linear-gradient(135deg, ${NEON.cyan}22, ${NEON.cyan}11)`,
              border: `1px solid ${NEON.cyan}44`,
              borderRadius: 8,
              color: NEON.cyan,
              fontFamily: "Orbitron, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: downloading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {downloading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
            {downloading ? "DOWNLOADING..." : "DOWNLOAD GENESIS CHAIN"}
          </button>

          {chainData && (
            <div style={{ marginTop: 14, padding: 12, background: "rgba(0,240,255,0.05)", borderRadius: 8, border: `1px solid ${NEON.cyan}22` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                <div><span style={{ color: "#666" }}>Network: </span><span style={{ color: NEON.cyan }}>{chainData.networkId}</span></div>
                <div><span style={{ color: "#666" }}>Height: </span><span style={{ color: NEON.green }}>{chainData.snapshotHeight}</span></div>
                <div><span style={{ color: "#666" }}>Blocks: </span><span style={{ color: "#ccc" }}>{chainData.blocks.length}</span></div>
                <div><span style={{ color: "#666" }}>Size: </span><span style={{ color: "#ccc" }}>{(chainData.totalSize / 1024).toFixed(1)} KB</span></div>
                <div style={{ gridColumn: "1/-1" }}>
                  <span style={{ color: "#666" }}>Genesis: </span>
                  <span style={{ fontFamily: "Space Mono, monospace", fontSize: 9, color: NEON.gold, wordBreak: "break-all" }}>
                    {chainData.genesisHash?.slice(0, 32)}...
                  </span>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <span style={{ color: "#666" }}>Signature: </span>
                  <span style={{ fontFamily: "Space Mono, monospace", fontSize: 9, color: NEON.magenta, wordBreak: "break-all" }}>
                    {chainData.signature?.slice(0, 32)}...
                  </span>
                </div>
              </div>
              <button
                data-testid="button-export-json"
                onClick={exportChainJson}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px",
                  background: `${NEON.green}11`,
                  border: `1px solid ${NEON.green}33`,
                  borderRadius: 6,
                  color: NEON.green,
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Download size={12} /> EXPORT AS JSON FILE
              </button>
            </div>
          )}
        </div>

        <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${NEON.green}22`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Link2 size={16} style={{ color: NEON.green }} />
            <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Node Sync</span>
          </div>
          <p style={{ fontSize: 11, color: "#888", fontFamily: "Rajdhani, sans-serif", marginBottom: 14, lineHeight: 1.5 }}>
            Sync a registered node with the SKYNT Genesis chain. The node will download all blocks and validate them against the three-gate QG mining consensus.
          </p>

          <div style={{ marginBottom: 10 }}>
            <select
              data-testid="select-sync-node"
              value={syncNodeId}
              onChange={e => setSyncNodeId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(0,0,0,0.6)",
                border: `1px solid ${NEON.green}33`,
                borderRadius: 8,
                color: "#fff",
                fontFamily: "Space Mono, monospace",
                fontSize: 11,
              }}
            >
              <option value="">Select a node to sync...</option>
              {userNodes.map(n => (
                <option key={n.nodeId} value={n.nodeId}>{n.name} ({n.nodeId.slice(0, 16)})</option>
              ))}
            </select>
          </div>

          <button
            data-testid="button-sync-node"
            onClick={syncNode}
            disabled={!syncNodeId || syncing}
            style={{
              width: "100%",
              padding: "12px",
              background: syncing ? "rgba(57,255,20,0.1)" : `linear-gradient(135deg, ${NEON.green}22, ${NEON.green}11)`,
              border: `1px solid ${NEON.green}44`,
              borderRadius: 8,
              color: NEON.green,
              fontFamily: "Orbitron, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: !syncNodeId || syncing ? "not-allowed" : "pointer",
              opacity: !syncNodeId ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
            {syncing ? "SYNCING..." : "SYNC CHAIN DATA"}
          </button>

          {userNodes.length === 0 && (
            <div style={{ marginTop: 12, padding: 10, background: "rgba(255,215,0,0.05)", borderRadius: 6, border: `1px solid ${NEON.gold}22`, fontSize: 11, color: NEON.gold, textAlign: "center", fontFamily: "Rajdhani, sans-serif" }}>
              Register a node first to sync blockchain data
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${NEON.gold}22`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} style={{ color: NEON.gold }} />
            <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Create Node</span>
          </div>
          <button
            data-testid="button-toggle-register"
            onClick={() => setShowRegister(!showRegister)}
            style={{
              padding: "6px 16px",
              background: showRegister ? `${NEON.red}22` : `${NEON.gold}22`,
              border: `1px solid ${showRegister ? NEON.red : NEON.gold}44`,
              borderRadius: 6,
              color: showRegister ? NEON.red : NEON.gold,
              fontFamily: "Rajdhani, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {showRegister ? "CANCEL" : "NEW NODE"}
          </button>
        </div>

        {showRegister && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: "#666", fontFamily: "Rajdhani, sans-serif", display: "block", marginBottom: 4 }}>NODE NAME</label>
              <input
                data-testid="input-node-name"
                value={nodeName}
                onChange={e => setNodeName(e.target.value)}
                placeholder="My SKYNT Node"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.6)",
                  border: `1px solid ${NEON.gold}33`,
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: "Space Mono, monospace",
                  fontSize: 11,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#666", fontFamily: "Rajdhani, sans-serif", display: "block", marginBottom: 4 }}>ADDRESS / ENDPOINT</label>
              <input
                data-testid="input-node-address"
                value={nodeAddress}
                onChange={e => setNodeAddress(e.target.value)}
                placeholder="node.example.com:8333"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.6)",
                  border: `1px solid ${NEON.gold}33`,
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: "Space Mono, monospace",
                  fontSize: 11,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#666", fontFamily: "Rajdhani, sans-serif", display: "block", marginBottom: 4 }}>REGION</label>
              <input
                data-testid="input-node-region"
                value={nodeRegion}
                onChange={e => setNodeRegion(e.target.value)}
                placeholder="Andromeda-Sector"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.6)",
                  border: `1px solid ${NEON.gold}33`,
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: "Space Mono, monospace",
                  fontSize: 11,
                }}
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <button
                data-testid="button-register-node"
                onClick={() => {
                  if (!nodeName || !nodeAddress) {
                    toast({ title: "Name and address are required", variant: "destructive" });
                    return;
                  }
                  registerMutation.mutate({ name: nodeName, address: nodeAddress, region: nodeRegion || "Unknown" });
                }}
                disabled={registerMutation.isPending}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: `linear-gradient(135deg, ${NEON.gold}22, ${NEON.gold}11)`,
                  border: `1px solid ${NEON.gold}44`,
                  borderRadius: 8,
                  color: NEON.gold,
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: registerMutation.isPending ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {registerMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                {registerMutation.isPending ? "REGISTERING..." : "REGISTER NODE ON NETWORK"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${NEON.gold}22`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Shield size={16} style={{ color: NEON.gold }} />
            <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Seed Nodes</span>
            <span style={{ fontSize: 10, color: NEON.gold, fontFamily: "Space Mono, monospace" }}>({seedNodes.length})</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {seedNodes.map(n => <NodeRow key={n.nodeId} node={n} />)}
          </div>
        </div>

        <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${NEON.cyan}22`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Server size={16} style={{ color: NEON.cyan }} />
            <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Registered Nodes</span>
            <span style={{ fontSize: 10, color: NEON.cyan, fontFamily: "Space Mono, monospace" }}>({userNodes.length})</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {userNodes.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#555", fontFamily: "Rajdhani, sans-serif", fontSize: 13 }}>
                <WifiOff size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <div>No nodes registered yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Create a node above to join the SKYNT Genesis network</div>
              </div>
            ) : (
              userNodes.map(n => <NodeRow key={n.nodeId} node={n} onRemove={(id) => removeMutation.mutate(id)} />)
            )}
          </div>
        </div>
      </div>

      {announcements.length > 0 && (
        <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${NEON.magenta}22`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Radio size={16} style={{ color: NEON.magenta }} />
            <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Block Announcements</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {announcements.slice(0, 10).map((a: any, i: number) => (
              <div
                key={i}
                data-testid={`announcement-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 6,
                  marginBottom: 6,
                  border: "1px solid rgba(255,0,255,0.08)",
                }}
              >
                <Activity size={12} style={{ color: NEON.magenta, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#ccc" }}>
                    Block <span style={{ color: NEON.cyan, fontFamily: "Space Mono, monospace" }}>#{a.block?.index}</span> by{" "}
                    <span style={{ color: NEON.gold }}>{a.proposer?.slice(0, 20)}</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#666", fontFamily: "Space Mono, monospace", marginTop: 2 }}>
                    {a.signature?.slice(0, 40)}...
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "Space Mono, monospace", flexShrink: 0 }}>
                  {new Date(a.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div style={{ marginTop: 20, padding: 14, background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Globe size={12} style={{ color: "#666" }} />
            <span style={{ fontSize: 10, color: "#666", fontFamily: "Rajdhani, sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>Network Info</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 10, color: "#888", fontFamily: "Space Mono, monospace", flexWrap: "wrap" }}>
            <span>Version: <span style={{ color: NEON.cyan }}>{stats.networkVersion}</span></span>
            <span>Regions: <span style={{ color: NEON.gold }}>{stats.regionsActive?.length || 0}</span></span>
            <span>Validated: <span style={{ color: NEON.green }}>{stats.totalBlocksValidated}</span></span>
            <span>Uptime: <span style={{ color: NEON.green }}>{stats.uptimePercent?.toFixed(1)}%</span></span>
            <span data-testid="text-consensus-hash">Consensus: <span style={{ color: NEON.magenta }}>{stats.consensusHash?.slice(0, 16)}...</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
