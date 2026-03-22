import { createHash, randomBytes } from "crypto";
import { wsHub } from "./ws-hub";
import { calculatePhi } from "./iit-engine";
import { qgMiner } from "./qg-miner-v8";
import {
  getChainInfo,
  getRecentBlocks as getSkyntBlocks,
  getBlock,
  isChainValid,
  type SkyntBlock,
  type SkyntChainInfo,
} from "./skynt-blockchain";

export interface NetworkNode {
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

export interface ChainSnapshot {
  version: number;
  networkId: string;
  genesisHash: string;
  blocks: SkyntBlock[];
  chainInfo: SkyntChainInfo;
  snapshotHeight: number;
  snapshotHash: string;
  timestamp: number;
  signature: string;
  totalSize: number;
}

export interface BlockAnnouncement {
  block: SkyntBlock;
  proposer: string;
  timestamp: number;
  signature: string;
  propagationPath: string[];
}

export interface SyncRequest {
  nodeId: string;
  fromHeight: number;
  toHeight: number;
  requestedAt: number;
}

export interface SyncResponse {
  blocks: SkyntBlock[];
  fromHeight: number;
  toHeight: number;
  totalAvailable: number;
  chainValid: boolean;
  servedBy: string;
}

export interface NetworkStats {
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

const NETWORK_ID = "skynt-genesis-mainnet";
const NETWORK_VERSION = "1.0.0";
const HEARTBEAT_INTERVAL_MS = 30_000;
const NODE_TIMEOUT_MS = 120_000;
const MAX_SYNC_BATCH = 50;
const SEED_NODE_REGIONS = [
  "Alpha-Centauri", "Sirius-Prime", "Vega-Nexus",
  "Polaris-Gateway", "Rigel-Core", "Betelgeuse-Hub",
];

class P2PNetwork {
  private nodes: Map<string, NetworkNode> = new Map();
  private announcements: BlockAnnouncement[] = [];
  private syncLog: Map<string, number> = new Map();
  private blockTimeHistory: number[] = [];
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.bootstrapSeedNodes();
  }

  private bootstrapSeedNodes() {
    SEED_NODE_REGIONS.forEach((region, i) => {
      const nodeId = `seed-${createHash("sha256").update(region).digest("hex").slice(0, 12)}`;
      const chainInfo = getChainInfo();
      this.nodes.set(nodeId, {
        nodeId,
        name: `${region} Seed`,
        address: `seed-${i}.skynt.network`,
        publicKey: `0x${createHash("sha256").update(`seed-key-${region}`).digest("hex")}`,
        version: NETWORK_VERSION,
        chainHeight: chainInfo.latestBlockHeight,
        chainHash: chainInfo.latestBlockHash,
        phiScore: 0.7 + Math.random() * 0.3,
        status: "online",
        capabilities: ["full-node", "chain-serve", "block-validate", "tx-relay", "snapshot-serve"],
        registeredAt: Date.now() - 86400000 * (30 + Math.floor(Math.random() * 60)),
        lastHeartbeat: Date.now(),
        latency: 10 + Math.floor(Math.random() * 40),
        blocksValidated: 100 + Math.floor(Math.random() * 500),
        blocksProposed: 10 + Math.floor(Math.random() * 50),
        uptime: 95 + Math.random() * 5,
        region,
        isSeedNode: true,
      });
    });
  }

  start() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), HEARTBEAT_INTERVAL_MS);
    console.log(`[P2P Network] Started SKYNT Genesis P2P network (${NETWORK_ID})`);
  }

  stop() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    console.log("[P2P Network] Stopped");
  }

  private tick() {
    const now = Date.now();
    const chainInfo = getChainInfo();

    for (const [id, node] of this.nodes) {
      if (node.isSeedNode) {
        node.lastHeartbeat = now;
        node.chainHeight = chainInfo.latestBlockHeight;
        node.chainHash = chainInfo.latestBlockHash;
        node.latency = Math.max(5, node.latency + (Math.random() * 6 - 3));

        if (Math.random() < node.phiScore * 0.15) {
          node.blocksValidated++;
        }
        if (Math.random() < 0.05) {
          node.blocksProposed++;
        }
        continue;
      }

      if (now - node.lastHeartbeat > NODE_TIMEOUT_MS) {
        node.status = "offline";
      } else if (node.chainHeight < chainInfo.latestBlockHeight) {
        node.status = "syncing";
      } else {
        node.status = "online";
      }
    }

    if (this.announcements.length > 200) {
      this.announcements = this.announcements.slice(-100);
    }
  }

  registerNode(params: {
    name: string;
    address: string;
    publicKey?: string;
    capabilities?: string[];
    region?: string;
  }): NetworkNode {
    const nodeId = `node-${createHash("sha256").update(`${params.name}-${params.address}-${Date.now()}`).digest("hex").slice(0, 12)}`;
    const pubKey = params.publicKey || `0x${randomBytes(32).toString("hex")}`;

    const node: NetworkNode = {
      nodeId,
      name: params.name,
      address: params.address,
      publicKey: pubKey,
      version: NETWORK_VERSION,
      chainHeight: 0,
      chainHash: "",
      phiScore: 0,
      status: "bootstrapping",
      capabilities: params.capabilities || ["light-node", "tx-relay"],
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      latency: 50 + Math.floor(Math.random() * 100),
      blocksValidated: 0,
      blocksProposed: 0,
      uptime: 100,
      region: params.region || "Unknown",
      isSeedNode: false,
    };

    this.nodes.set(nodeId, node);
    console.log(`[P2P Network] Node registered: ${node.name} (${nodeId})`);
    wsHub.broadcast("p2p:peer_joined", {
      nodeId, name: node.name, address: node.address,
      region: node.region, totalNodes: this.nodes.size,
    });
    return node;
  }

  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || node.isSeedNode) return false;
    this.nodes.delete(nodeId);
    return true;
  }

  heartbeat(nodeId: string, data?: { chainHeight?: number; chainHash?: string; phiScore?: number }): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.lastHeartbeat = Date.now();
    if (data?.chainHeight !== undefined) node.chainHeight = data.chainHeight;
    if (data?.chainHash) node.chainHash = data.chainHash;
    if (data?.phiScore !== undefined) node.phiScore = data.phiScore;

    const chainInfo = getChainInfo();
    if (node.chainHeight >= chainInfo.latestBlockHeight) {
      node.status = "online";
    } else {
      node.status = "syncing";
    }

    return true;
  }

  getChainSnapshot(fromHeight: number = 0, maxBlocks: number = MAX_SYNC_BATCH): ChainSnapshot {
    const chainInfo = getChainInfo();
    const allBlocks = getSkyntBlocks(chainInfo.latestBlockHeight + 1).reverse();
    const blocks = allBlocks.slice(fromHeight, fromHeight + maxBlocks);

    const genesisBlock = getBlock(0);
    const snapshotData = JSON.stringify({ blocks: blocks.map(b => b.hash), height: chainInfo.latestBlockHeight });
    const signature = createHash("sha256").update(snapshotData).digest("hex");

    return {
      version: 1,
      networkId: NETWORK_ID,
      genesisHash: genesisBlock?.hash || "",
      blocks,
      chainInfo,
      snapshotHeight: chainInfo.latestBlockHeight,
      snapshotHash: chainInfo.latestBlockHash,
      timestamp: Date.now(),
      signature,
      totalSize: JSON.stringify(blocks).length,
    };
  }

  syncBlocks(request: SyncRequest): SyncResponse {
    const chainInfo = getChainInfo();
    const allBlocks = getSkyntBlocks(chainInfo.latestBlockHeight + 1).reverse();

    const from = Math.max(0, request.fromHeight);
    const to = Math.min(request.toHeight, chainInfo.latestBlockHeight);
    const batchEnd = Math.min(to + 1, from + MAX_SYNC_BATCH);
    const blocks = allBlocks.slice(from, batchEnd);

    this.syncLog.set(request.nodeId, Date.now());

    const node = this.nodes.get(request.nodeId);
    if (node && blocks.length > 0) {
      const lastBlock = blocks[blocks.length - 1];
      node.chainHeight = lastBlock.index;
      node.chainHash = lastBlock.hash;
      node.blocksValidated += blocks.length;
    }

    return {
      blocks,
      fromHeight: from,
      toHeight: batchEnd - 1,
      totalAvailable: chainInfo.latestBlockHeight + 1,
      chainValid: isChainValid(),
      servedBy: "genesis-origin",
    };
  }

  announceBlock(block: SkyntBlock, proposerNodeId: string): BlockAnnouncement {
    const announcement: BlockAnnouncement = {
      block,
      proposer: proposerNodeId,
      timestamp: Date.now(),
      signature: createHash("sha256").update(block.hash + proposerNodeId).digest("hex"),
      propagationPath: [proposerNodeId],
    };

    this.announcements.push(announcement);

    const proposer = this.nodes.get(proposerNodeId);
    if (proposer) {
      proposer.blocksProposed++;
      proposer.chainHeight = block.index;
      proposer.chainHash = block.hash;
    }

    for (const [, node] of this.nodes) {
      if (node.nodeId !== proposerNodeId && node.status === "online") {
        node.blocksValidated++;
        if (node.chainHeight < block.index) {
          node.chainHeight = block.index;
          node.chainHash = block.hash;
        }
      }
    }

    this.blockTimeHistory.push(Date.now());
    if (this.blockTimeHistory.length > 100) this.blockTimeHistory.shift();

    return announcement;
  }

  validateBlock(block: SkyntBlock): { valid: boolean; gates: string[]; phiScore: number } {
    const blockData = JSON.stringify({
      index: block.index,
      previousHash: block.previousHash,
      timestamp: block.timestamp,
      merkleRoot: block.merkleRoot,
      miner: block.miner,
    }) + block.nonce;

    const result = qgMiner.isValidBlock(blockData, block.difficulty, this.getActiveNodes().length);
    const phiResult = calculatePhi(`validate-${block.hash}`);

    return {
      valid: result.valid,
      gates: block.gatesPassed,
      phiScore: phiResult.phi,
    };
  }

  getNode(nodeId: string): NetworkNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): NetworkNode[] {
    return Array.from(this.nodes.values());
  }

  getActiveNodes(): NetworkNode[] {
    return this.getAllNodes().filter(n => n.status === "online" || n.status === "syncing");
  }

  getSeedNodes(): NetworkNode[] {
    return this.getAllNodes().filter(n => n.isSeedNode);
  }

  getRecentAnnouncements(limit: number = 20): BlockAnnouncement[] {
    return this.announcements.slice(-limit).reverse();
  }

  getNetworkStats(): NetworkStats {
    const nodes = this.getAllNodes();
    const active = nodes.filter(n => n.status === "online");
    const syncing = nodes.filter(n => n.status === "syncing");
    const chainInfo = getChainInfo();

    let avgBlockTime = 0;
    if (this.blockTimeHistory.length > 1) {
      const diffs = [];
      for (let i = 1; i < this.blockTimeHistory.length; i++) {
        diffs.push(this.blockTimeHistory[i] - this.blockTimeHistory[i - 1]);
      }
      avgBlockTime = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }

    const totalValidated = nodes.reduce((s, n) => s + n.blocksValidated, 0);
    const avgPhi = active.length > 0 ? active.reduce((s, n) => s + n.phiScore, 0) / active.length : 0;
    const avgUptime = nodes.length > 0 ? nodes.reduce((s, n) => s + n.uptime, 0) / nodes.length : 0;
    const regions = [...new Set(active.map(n => n.region))];

    return {
      totalNodes: nodes.length,
      activeNodes: active.length,
      syncingNodes: syncing.length,
      networkHashRate: active.length * 12.5 + Math.random() * 5,
      consensusHeight: chainInfo.latestBlockHeight,
      consensusHash: chainInfo.latestBlockHash,
      chainValid: chainInfo.isValid,
      totalBlocksValidated: totalValidated,
      networkPhiScore: avgPhi,
      uptimePercent: avgUptime,
      regionsActive: regions,
      lastBlockTime: this.blockTimeHistory.length > 0 ? this.blockTimeHistory[this.blockTimeHistory.length - 1] : 0,
      avgBlockTime,
      pendingAnnouncements: this.announcements.length,
      networkVersion: NETWORK_VERSION,
    };
  }

  getTopology() {
    const nodes = this.getAllNodes();
    const n = nodes.length;
    const edges: Array<{ from: string; to: string; weight: number }> = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (nodes[i].status !== "offline" && nodes[j].status !== "offline") {
          const phiAvg = (nodes[i].phiScore + nodes[j].phiScore) / 2;
          if (Math.random() < 0.3 + phiAvg * 0.4) {
            edges.push({
              from: nodes[i].nodeId,
              to: nodes[j].nodeId,
              weight: phiAvg,
            });
          }
        }
      }
    }

    return {
      nodes: nodes.map(n => ({
        id: n.nodeId,
        name: n.name,
        status: n.status,
        region: n.region,
        isSeedNode: n.isSeedNode,
        chainHeight: n.chainHeight,
      })),
      edges,
      networkId: NETWORK_ID,
    };
  }
}

let network: P2PNetwork | null = null;

export function startP2PNetwork() {
  if (network) return;
  network = new P2PNetwork();
  network.start();
}

export function stopP2PNetwork() {
  network?.stop();
  network = null;
}

export function getNetwork(): P2PNetwork | null {
  return network;
}

export function registerNode(params: { name: string; address: string; publicKey?: string; capabilities?: string[]; region?: string }) {
  if (!network) throw new Error("P2P network not started");
  return network.registerNode(params);
}

export function removeNode(nodeId: string) {
  if (!network) return false;
  return network.removeNode(nodeId);
}

export function nodeHeartbeat(nodeId: string, data?: { chainHeight?: number; chainHash?: string; phiScore?: number }) {
  if (!network) return false;
  return network.heartbeat(nodeId, data);
}

export function getChainDownload(fromHeight?: number, maxBlocks?: number) {
  if (!network) throw new Error("P2P network not started");
  return network.getChainSnapshot(fromHeight, maxBlocks);
}

export function syncNodeBlocks(request: SyncRequest) {
  if (!network) throw new Error("P2P network not started");
  return network.syncBlocks(request);
}

export function announceNewBlock(block: SkyntBlock, proposerNodeId: string) {
  if (!network) throw new Error("P2P network not started");
  return network.announceBlock(block, proposerNodeId);
}

export function validateNetworkBlock(block: SkyntBlock) {
  if (!network) throw new Error("P2P network not started");
  return network.validateBlock(block);
}

export function getNetworkNodes() {
  return network?.getAllNodes() || [];
}

export function getNetworkNode(nodeId: string) {
  return network?.getNode(nodeId);
}

export function getNetworkSeedNodes() {
  return network?.getSeedNodes() || [];
}

export function getP2PNetworkStats() {
  return network?.getNetworkStats() || null;
}

export function getP2PTopology() {
  return network?.getTopology() || null;
}

export function getBlockAnnouncements(limit?: number) {
  return network?.getRecentAnnouncements(limit) || [];
}
