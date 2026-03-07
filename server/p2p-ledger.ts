import { qgMiner } from "./qg-miner-v8";
import { calculatePhi, type PhiMetrics, generateAdjacencyMatrix } from "./iit-engine";
import { createHash } from "crypto";

export interface PeerNode {
  id: string;
  address: string;
  port: number;
  lastSeen: number;
  latency: number;
  blockHeight: number;
  phiScore: number;
  status: "online" | "offline" | "syncing";
}

export interface P2PMessage {
  type: "BLOCK_ANNOUNCE" | "TX_ANNOUNCE" | "PEER_DISCOVERY" | "CHAIN_REQUEST" | "CHAIN_RESPONSE" | "PING" | "PONG";
  payload: any;
  sender: string;
  timestamp: number;
  signature: string;
}

export interface LedgerState {
  peers: PeerNode[];
  blockHeight: number;
  networkHashRate: number;
  consensusStatus: string;
  lastBlockTime: number;
}

class P2PLedger {
  private peerRegistry: Map<string, PeerNode> = new Map();
  private messageCache: Set<string> = new Set();
  private maxCacheSize = 1000;
  private currentHeight = 0;
  private lastBlockTimestamp = Date.now();

  constructor() {
    this.initializeGuardianPeers();
  }

  private initializeGuardianPeers() {
    const guardianNames = [
      "Alpha-Centauri", "Beta-Giedi", "Gamma-Ray", "Delta-Force",
      "Epsilon-Eridani", "Zeta-Reticuli", "Eta-Carinae", "Theta-Orion", "Iota-Horologii"
    ];

    guardianNames.forEach((name, index) => {
      const id = `node-${index + 1}-${name.toLowerCase()}`;
      this.peerRegistry.set(id, {
        id,
        address: `127.0.0.1`,
        port: 8000 + index,
        lastSeen: Date.now(),
        latency: Math.floor(Math.random() * 50) + 10,
        blockHeight: 0,
        phiScore: 0.5 + Math.random() * 0.5,
        status: "online"
      });
    });
  }

  addPeer(peer: PeerNode) {
    this.peerRegistry.set(peer.id, peer);
  }

  removePeer(id: string) {
    this.peerRegistry.delete(id);
  }

  getPeers(): PeerNode[] {
    return Array.from(this.peerRegistry.values());
  }

  getActivePeers(): PeerNode[] {
    return this.getPeers().filter(p => p.status === "online");
  }

  broadcastBlock(block: any) {
    this.gossip("BLOCK_ANNOUNCE", block);
  }

  broadcastTransaction(tx: any) {
    this.gossip("TX_ANNOUNCE", tx);
  }

  private gossip(type: P2PMessage["type"], payload: any) {
    const message: P2PMessage = {
      type,
      payload,
      sender: "LOCAL_NODE",
      timestamp: Date.now(),
      signature: createHash("sha256").update(JSON.stringify(payload)).digest("hex")
    };

    const msgHash = createHash("md5").update(JSON.stringify(message)).digest("hex");
    if (this.messageCache.has(msgHash)) return;

    this.messageCache.add(msgHash);
    if (this.messageCache.size > this.maxCacheSize) {
      const first = this.messageCache.values().next().value;
      if (first) this.messageCache.delete(first);
    }

    // Simulate propagation delay
    this.getActivePeers().forEach(peer => {
      const delay = peer.latency + Math.random() * 50;
      setTimeout(() => {
        // In a real system, we'd send via WebSocket here
      }, delay);
    });
  }

  requestChain(peerId: string) {
    console.log(`[P2P] Requesting chain from ${peerId}`);
  }

  syncWithPeer(peerId: string) {
    console.log(`[P2P] Syncing with peer ${peerId}`);
  }

  validateReceivedBlock(block: any): boolean {
    const difficulty = block.difficulty || 2;
    // blockData format expected by qgMiner.mine() or isValidBlock()
    const blockData = JSON.stringify({
      index: block.index,
      previousHash: block.previousHash,
      timestamp: block.timestamp,
      merkleRoot: block.merkleRoot,
      miner: block.miner
    }) + block.nonce;
    
    const result = qgMiner.isValidBlock(blockData, difficulty, this.getActivePeers().length);
    return result.valid;
  }

  getLedgerState(): LedgerState {
    const peers = this.getPeers();
    const activePeers = this.getActivePeers();
    const avgLatency = activePeers.reduce((sum, p) => sum + p.latency, 0) / (activePeers.length || 1);
    
    return {
      peers,
      blockHeight: this.currentHeight,
      networkHashRate: activePeers.length * 10.5, // Simulated
      consensusStatus: activePeers.length >= 5 ? "Synced" : "Degraded",
      lastBlockTime: this.lastBlockTimestamp
    };
  }

  getNetworkTopology() {
    const peers = this.getPeers();
    const n = peers.length;
    const matrix = generateAdjacencyMatrix(n, `topology-${this.currentHeight}`);
    return {
      nodes: peers.map(p => ({ id: p.id, label: p.id.split('-')[2] })),
      adjacencyMatrix: matrix
    };
  }

  async simulateTick() {
    const activePeers = this.getActivePeers();
    
    // Simulate mining activity from peers
    activePeers.forEach(peer => {
      // Each peer has a chance to mine based on their phi score
      if (Math.random() < peer.phiScore * 0.1) {
        const newHeight = Math.max(this.currentHeight, peer.blockHeight) + 1;
        peer.blockHeight = newHeight;
        
        if (newHeight > this.currentHeight) {
          this.currentHeight = newHeight;
          this.lastBlockTimestamp = Date.now();
          // Simulate broadcasting a block
          this.broadcastBlock({
            index: newHeight,
            miner: peer.id,
            timestamp: Date.now(),
            previousHash: "SIMULATED_PREV_HASH"
          });
        }
      }
      
      // Update latency randomly
      peer.latency = Math.max(5, peer.latency + (Math.random() * 10 - 5));
      peer.lastSeen = Date.now();
    });
  }
}

let ledger: P2PLedger | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;

export function startP2PLedger() {
  if (ledger) return;
  console.log("[P2P Ledger] Starting P2P serverless ledger simulation");
  ledger = new P2PLedger();
  
  tickInterval = setInterval(() => {
    ledger?.simulateTick();
  }, 15000); // 15s tick as requested
}

export function stopP2PLedger() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  ledger = null;
  console.log("[P2P Ledger] Stopped");
}

export function getLedgerState() {
  return ledger?.getLedgerState() || null;
}

export function broadcastTransaction(tx: any) {
  ledger?.broadcastTransaction(tx);
}

export function getP2PPeers() {
  return ledger?.getPeers() || [];
}

export function getNetworkTopology() {
  return ledger?.getNetworkTopology() || null;
}
