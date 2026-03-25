/**
 * MoneroOcean Stratum Client with Real RandomX Hashing
 * Connects to gulf.moneroocean.stream via Stratum JSON-RPC over TCP.
 * Uses randomx.js (WASM) for actual Monero proof-of-work computation.
 */

import * as net from "net";
import { EventEmitter } from "events";
import { createHash } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StratumJob {
  job_id: string;
  blob: string;
  target: string;
  seed_hash: string;
  height: number;
  algo: string;
}

export interface XmrMinerStatus {
  connected: boolean;
  pool: string;
  wallet: string;
  hashrate: number;       // H/s
  sharesSubmitted: number;
  sharesAccepted: number;
  sharesRejected: number;
  currentDifficulty: number;
  currentHeight: number;
  currentJobId: string;
  seedHash: string;
  uptime: number;         // seconds
  estimatedXmrPerDay: number;
  lastShareTime: number | null;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POOL_HOST = "gulf.moneroocean.stream";
const POOL_PORT = 10128;
const XMR_WALLET  = "4AneteRiAaiS6MiKbic85Cd23dpfSmjfAWVj9WVn1mNZLVrw9FfqvpiWAtVAXf98MS6oKChyWWQ4jRgaMiEsA9hYLmonMKA";
const WORKER_NAME = "SKYNT";
const AGENT       = "SKYNT-Miner/1.0 (randomx.js WASM)";

// Nonce offset in the 76-byte blob (bytes 39-42, hex chars 78-85)
const NONCE_BYTE_OFFSET = 39;

// ─── RandomX VM singleton ─────────────────────────────────────────────────────

let rxVm: any = null;
let rxCache: any = null;
let rxSeedHash: string | null = null;
let rxReady = false;
let rxInitializing = false;

async function ensureRxVm(seedHashHex: string): Promise<boolean> {
  if (rxSeedHash === seedHashHex && rxReady && rxVm) return true;

  if (rxInitializing) return false;
  rxInitializing = true;

  try {
    // Dynamically import randomx.js (ESM/CJS hybrid)
    const rx = await import("randomx.js");
    const initFn   = (rx as any).randomx_init_cache   ?? (rx as any).default?.randomx_init_cache;
    const createFn = (rx as any).randomx_create_vm    ?? (rx as any).default?.randomx_create_vm;

    if (!initFn || !createFn) throw new Error("randomx.js exports not found");

    const seedKey = Buffer.from(seedHashHex.padEnd(64, "0").slice(0, 64), "hex");
    console.log(`[XMR Stratum] Initialising RandomX cache for seed ${seedHashHex.slice(0, 16)}…`);
    rxCache = await initFn(seedKey);
    rxVm    = createFn(rxCache);
    rxSeedHash = seedHashHex;
    rxReady    = true;
    rxInitializing = false;
    console.log("[XMR Stratum] RandomX VM ready ✓");
    return true;
  } catch (err) {
    console.error("[XMR Stratum] RandomX init failed:", err);
    rxInitializing = false;
    rxReady = false;
    return false;
  }
}

function computeRxHash(blobHex: string, nonce: number): { hash: Buffer; nonce: number } | null {
  if (!rxVm || !rxReady) return null;

  try {
    const blobBuf = Buffer.from(blobHex, "hex");
    // Insert 4-byte little-endian nonce at byte offset 39
    blobBuf.writeUInt32LE(nonce >>> 0, NONCE_BYTE_OFFSET);
    const result = rxVm.calculate_hash(blobBuf);
    return { hash: Buffer.from(result), nonce };
  } catch {
    return null;
  }
}

function hashMeetsTarget(hash: Buffer, targetHex: string): boolean {
  // XMR stratum: target is a LE hex string (4 bytes = 8 hex chars, or 8 bytes = 16 chars)
  // Share check: hash[28..31] as LE uint32 < target as LE uint32
  // (Equivalent to: last 4 bytes of hash as LE < target as LE)
  if (targetHex.length <= 8) {
    const tbuf     = Buffer.from(targetHex.padStart(8, "0"), "hex");
    const targetU32 = tbuf.readUInt32LE(0); // target as LE uint32
    const hashLast4 = hash.readUInt32LE(28); // hash bytes 28-31 as LE uint32
    return hashLast4 < targetU32;
  }
  // 8-byte (16 hex char) target — compare hash[24..31] as LE uint64 < target as LE uint64
  const tbuf64  = Buffer.from(targetHex.padStart(16, "0"), "hex");
  const targetLo = BigInt(tbuf64.readUInt32LE(0));
  const targetHi = BigInt(tbuf64.readUInt32LE(4));
  const targetN  = targetHi * 0x100000000n + targetLo;
  const hashLo   = BigInt(hash.readUInt32LE(24));
  const hashHi   = BigInt(hash.readUInt32LE(28));
  const hashN    = hashHi * 0x100000000n + hashLo;
  return hashN < targetN;
}

function targetToDifficulty(targetHex: string): number {
  // Target is LE hex, convert correctly
  if (targetHex.length <= 8) {
    const buf = Buffer.from(targetHex.padStart(8, "0"), "hex");
    const t   = buf.readUInt32LE(0);
    if (t === 0) return 1;
    return Math.round(0xffffffff / t);
  }
  const buf = Buffer.from(targetHex.padStart(16, "0"), "hex");
  const lo  = BigInt(buf.readUInt32LE(0));
  const hi  = BigInt(buf.readUInt32LE(4));
  const t   = hi * 0x100000000n + lo;
  if (t === 0n) return 1;
  const max = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  return Number(max / t);
}

// ─── Stratum Client ───────────────────────────────────────────────────────────

class MoneroOceanStratumClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = "";
  private msgId  = 1;
  private minerId: string | null = null;
  private currentJob: StratumJob | null = null;
  private running  = false;
  private mineLoop: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime: number | null = null;

  // Stats
  private hashrate      = 0;
  private sharesSubmitted = 0;
  private sharesAccepted  = 0;
  private sharesRejected  = 0;
  private lastShareTime: number | null = null;
  private hashCount     = 0;
  private hashWindow    = Date.now();
  private lastError: string | null = null;
  private nonce = Math.floor(Math.random() * 0xffffffff);

  // ─── Public API ────────────────────────────────────────────────────────────

  start() {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();
    this.connect();
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.mineLoop) clearInterval(this.mineLoop);
    this.mineLoop = null;
    if (this.socket) { try { this.socket.destroy(); } catch {} this.socket = null; }
    console.log("[XMR Stratum] Stopped.");
  }

  getStatus(): XmrMinerStatus {
    const uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    const diff   = this.currentJob ? targetToDifficulty(this.currentJob.target) : 0;
    // Rough estimate: hashrate * 86400 / difficulty * block_reward(0.6 XMR)
    const estimatedPerDay = this.hashrate > 0 && diff > 0
      ? (this.hashrate * 86400 / diff) * 0.6
      : 0;

    return {
      connected:          !!(this.socket && !this.socket.destroyed && this.minerId),
      pool:               `${POOL_HOST}:${POOL_PORT}`,
      wallet:             XMR_WALLET,
      hashrate:           this.hashrate,
      sharesSubmitted:    this.sharesSubmitted,
      sharesAccepted:     this.sharesAccepted,
      sharesRejected:     this.sharesRejected,
      currentDifficulty:  diff,
      currentHeight:      this.currentJob?.height ?? 0,
      currentJobId:       this.currentJob?.job_id ?? "",
      seedHash:           this.currentJob?.seed_hash ?? "",
      uptime,
      estimatedXmrPerDay: estimatedPerDay,
      lastShareTime:      this.lastShareTime,
      error:              this.lastError,
    };
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private connect() {
    if (!this.running) return;

    console.log(`[XMR Stratum] Connecting to ${POOL_HOST}:${POOL_PORT}…`);
    this.lastError = null;

    const sock = net.createConnection({ host: POOL_HOST, port: POOL_PORT });
    this.socket = sock;

    sock.setEncoding("utf8");
    sock.setTimeout(60_000);

    sock.on("connect", () => {
      console.log("[XMR Stratum] TCP connected, logging in…");
      this.buffer = "";
      this.send({
        id:      this.msgId++,
        jsonrpc: "2.0",
        method:  "login",
        params:  {
          login:  `${XMR_WALLET}.${WORKER_NAME}`,
          pass:   "x",
          agent:  AGENT,
          algo:   ["rx/0"],
        },
      });
    });

    sock.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.handleMessage(trimmed);
      }
    });

    sock.on("timeout", () => {
      console.warn("[XMR Stratum] Socket timeout");
      sock.destroy();
    });

    sock.on("error", (err: Error) => {
      this.lastError = err.message;
      console.error("[XMR Stratum] Socket error:", err.message);
    });

    sock.on("close", () => {
      console.warn("[XMR Stratum] Connection closed");
      if (this.mineLoop) { clearInterval(this.mineLoop); this.mineLoop = null; }
      this.minerId = null;
      if (this.running) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(delayMs = 15_000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.running) this.connect();
    }, delayMs);
  }

  // ─── Message handling ──────────────────────────────────────────────────────

  private handleMessage(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    // Login response
    if (msg.id === 1 && msg.result?.id) {
      this.minerId = msg.result.id;
      console.log(`[XMR Stratum] Logged in, miner id: ${this.minerId}`);
      if (msg.result.job) this.handleJob(msg.result.job);
      return;
    }

    // Submit response
    if (msg.id && msg.result?.status) {
      if (msg.result.status === "OK") {
        this.sharesAccepted++;
        this.lastShareTime = Date.now();
        console.log(`[XMR Stratum] Share accepted! (${this.sharesAccepted} total)`);
      } else {
        this.sharesRejected++;
        console.warn("[XMR Stratum] Share rejected:", msg.result.status);
      }
      this.emit("share", { accepted: msg.result.status === "OK" });
      return;
    }

    // Error response
    if (msg.error) {
      this.lastError = msg.error.message ?? String(msg.error);
      console.error("[XMR Stratum] Pool error:", this.lastError);
      if (this.lastError?.includes("Unauthenticated")) this.scheduleReconnect(5_000);
      return;
    }

    // New job notification
    if (msg.method === "job" && msg.params) {
      this.handleJob(msg.params);
    }
  }

  private handleJob(job: StratumJob) {
    this.currentJob = job;
    console.log(`[XMR Stratum] New job ${job.job_id} height=${job.height} algo=${job.algo ?? "rx/0"}`);

    // Initialise RandomX cache for new seed (async, mining loop checks rxReady)
    ensureRxVm(job.seed_hash).then(ok => {
      if (ok && !this.mineLoop) this.startMineLoop();
    });

    // Reset nonce per job
    this.nonce = Math.floor(Math.random() * 0xffffffff);

    if (!this.mineLoop) this.startMineLoop();
    this.emit("job", job);
  }

  // ─── Mining loop ────────────────────────────────────────────────────────────

  private startMineLoop() {
    if (this.mineLoop) clearInterval(this.mineLoop);

    // Run hashing in tight 50ms batches to avoid blocking the event loop
    this.mineLoop = setInterval(() => {
      if (!this.currentJob || !rxReady || !rxVm) return;

      const job    = this.currentJob;
      const target = job.target;
      const t0     = Date.now();

      // Compute hashes for up to 40ms per tick
      while (Date.now() - t0 < 40) {
        this.nonce = (this.nonce + 1) >>> 0;
        const result = computeRxHash(job.blob, this.nonce);
        if (!result) break;

        this.hashCount++;

        if (hashMeetsTarget(result.hash, target)) {
          const nonceHex = result.nonce.toString(16).padStart(8, "0");
          const resultHex = result.hash.toString("hex");
          console.log(`[XMR Stratum] Share found! nonce=${nonceHex} hash=${resultHex.slice(0, 16)}…`);
          this.submitShare(job.job_id, nonceHex, resultHex);
        }

        // Wrap nonce
        if (this.nonce >= 0xffffffff) {
          this.nonce = 0;
        }
      }

      // Update hashrate every 5 seconds
      const elapsed = (Date.now() - this.hashWindow) / 1000;
      if (elapsed >= 5) {
        this.hashrate = Math.round(this.hashCount / elapsed);
        this.hashCount = 0;
        this.hashWindow = Date.now();
      }
    }, 50);
  }

  // ─── Share submission ──────────────────────────────────────────────────────

  private submitShare(jobId: string, nonceHex: string, resultHex: string) {
    if (!this.minerId) return;
    this.sharesSubmitted++;
    this.send({
      id:      this.msgId++,
      jsonrpc: "2.0",
      method:  "submit",
      params:  {
        id:     this.minerId,
        job_id: jobId,
        nonce:  nonceHex,
        result: resultHex,
        algo:   this.currentJob?.algo ?? "rx/0",
      },
    });
  }

  private send(obj: object) {
    if (!this.socket || this.socket.destroyed) return;
    try {
      this.socket.write(JSON.stringify(obj) + "\n");
    } catch (err) {
      console.error("[XMR Stratum] Write error:", err);
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

const stratumClient = new MoneroOceanStratumClient();

export function startXmrMining() {
  stratumClient.start();
}

export function stopXmrMining() {
  stratumClient.stop();
}

export function getXmrMinerStatus(): XmrMinerStatus {
  return stratumClient.getStatus();
}

export function onXmrShare(cb: (data: { accepted: boolean }) => void) {
  stratumClient.on("share", cb);
}

export function onXmrJob(cb: (job: StratumJob) => void) {
  stratumClient.on("job", cb);
}

export const XMR_ADDRESS = XMR_WALLET;
