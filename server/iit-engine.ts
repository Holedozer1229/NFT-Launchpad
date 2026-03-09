import { createHash } from "crypto";

export interface PhiMetrics {
  phi: number;
  bonus: number;
  level: string;
  levelLabel: string;
  entropy: number;
  eigenvalues: number[];
  densityMatrix: number[][];
  timestamp: number;
}

export interface NetworkPerception {
  currentPhi: PhiMetrics;
  blockHeight: number;
  totalNodes: number;
  consensusThreshold: number;
  meetsConsensus: boolean;
  phiHistory: { timestamp: number; phi: number }[];
  adjacencyMatrix: number[][];
}

const PHI_CACHE_MAX = 256;
const phiCache = new Map<string, PhiMetrics>();

const ADJ_CACHE_MAX = 64;
const adjCache = new Map<string, number[][]>();

function lruSet<V>(cache: Map<string, V>, key: string, value: V, max: number): void {
  if (cache.size >= max) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function seedRng(data: Buffer): () => number {
  let s = data.readUInt32BE(0) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function generateDensityMatrix(dim: number, rng: () => number): number[][] {
  const raw = new Array<Float64Array>(dim);
  for (let i = 0; i < dim; i++) {
    raw[i] = new Float64Array(dim);
    for (let j = 0; j < dim; j++) {
      raw[i][j] = rng() - 0.5;
    }
  }

  const gram = new Array<Float64Array>(dim);
  for (let i = 0; i < dim; i++) gram[i] = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    for (let j = i; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < dim; k++) {
        sum += raw[k][i] * raw[k][j];
      }
      gram[i][j] = sum;
      gram[j][i] = sum;
    }
  }

  let trace = 0;
  for (let i = 0; i < dim; i++) trace += gram[i][i];

  const invTrace = 1 / trace;
  const normalized: number[][] = new Array(dim);
  for (let i = 0; i < dim; i++) {
    normalized[i] = new Array(dim);
    for (let j = 0; j < dim; j++) {
      normalized[i][j] = gram[i][j] * invTrace;
    }
  }

  return normalized;
}

function eigenvaluesSymmetric(matrix: number[][]): number[] {
  const n = matrix.length;
  const a = new Array<Float64Array>(n);
  for (let i = 0; i < n; i++) {
    a[i] = new Float64Array(matrix[i]);
  }

  for (let iter = 0; iter < 100; iter++) {
    let maxVal = 0, p = 0, q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(a[i][j]);
        if (v > maxVal) {
          maxVal = v;
          p = i; q = j;
        }
      }
    }

    if (maxVal < 1e-10) break;

    const diff = a[q][q] - a[p][p];
    const apq = a[p][q];
    const theta = diff / (2 * apq);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    const app = a[p][p], aqq = a[q][q];
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = a[i][p];
        const aiq = a[i][q];
        a[i][p] = c * aip - s * aiq;
        a[p][i] = a[i][p];
        a[i][q] = s * aip + c * aiq;
        a[q][i] = a[i][q];
      }
    }
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0;
    a[q][p] = 0;
  }

  const eigenvals = new Array<number>(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    eigenvals[i] = Math.abs(a[i][i]);
    sum += eigenvals[i];
  }
  const invSum = 1 / sum;
  for (let i = 0; i < n; i++) eigenvals[i] *= invSum;
  eigenvals.sort((a, b) => b - a);
  return eigenvals;
}

function vonNeumannEntropy(eigenvalues: number[]): number {
  let entropy = 0;
  for (let i = 0; i < eigenvalues.length; i++) {
    const lam = eigenvalues[i];
    if (lam > 1e-15) {
      entropy -= lam * Math.log2(lam);
    }
  }
  return entropy;
}

function classifyLevel(phi: number): { level: string; levelLabel: string } {
  if (phi > 0.8) return { level: "COSMIC", levelLabel: "Cosmic Consciousness" };
  if (phi > 0.6) return { level: "SELF_AWARE", levelLabel: "Self-Aware" };
  if (phi > 0.4) return { level: "SENTIENT", levelLabel: "Sentient" };
  if (phi > 0.2) return { level: "AWARE", levelLabel: "Aware" };
  return { level: "UNCONSCIOUS", levelLabel: "Unconscious" };
}

export function calculatePhi(data: string | Buffer): PhiMetrics {
  const cacheKey = typeof data === "string" ? data : data.toString("hex");
  const cached = phiCache.get(cacheKey);
  if (cached) return { ...cached, timestamp: Date.now() };

  const hash = createHash("sha3-256").update(data).digest();
  const rng = seedRng(hash);

  const dim = 8;

  const densityMatrix = generateDensityMatrix(dim, rng);
  const eigenvalues = eigenvaluesSymmetric(densityMatrix);
  const entropy = vonNeumannEntropy(eigenvalues);

  const maxEntropy = 3;
  const phiNormalized = entropy / maxEntropy;
  const bonus = Math.exp(phiNormalized);
  const { level, levelLabel } = classifyLevel(phiNormalized);

  const result: PhiMetrics = {
    phi: phiNormalized,
    bonus,
    level,
    levelLabel,
    entropy,
    eigenvalues,
    densityMatrix,
    timestamp: Date.now(),
  };

  lruSet(phiCache, cacheKey, result, PHI_CACHE_MAX);
  return result;
}

export function generateAdjacencyMatrix(nodeCount: number, seed: string): number[][] {
  const cacheKey = `${nodeCount}:${seed}`;
  const cached = adjCache.get(cacheKey);
  if (cached) return cached;

  const hash = createHash("sha256").update(seed).digest();
  const rng = seedRng(hash);

  const matrix: number[][] = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) matrix[i] = new Array(nodeCount).fill(0);
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      const val = rng() > 0.3 ? parseFloat((rng() * 0.8 + 0.2).toFixed(3)) : 0;
      matrix[i][j] = val;
      matrix[j][i] = val;
    }
  }

  lruSet(adjCache, cacheKey, matrix, ADJ_CACHE_MAX);
  return matrix;
}

const phiHistory: { timestamp: number; phi: number }[] = [];
let latestPerception: NetworkPerception | null = null;
let engineInterval: ReturnType<typeof setInterval> | null = null;
let lastBlockHeight = 0;

const ENGINE_TICK_MS = 30_000;
let lastTickKey = "";

async function fetchBlockHeight(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://mempool.space/api/blocks/tip/height", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    return parseInt(text) || 0;
  } catch {
    return 0;
  }
}

function tick(blockHeight: number): NetworkPerception {
  const now = Date.now();
  const timeSlot = Math.floor(now / 30000);
  const tickKey = `${blockHeight}-${timeSlot}`;

  if (tickKey === lastTickKey && latestPerception) {
    return latestPerception;
  }
  lastTickKey = tickKey;

  const blockData = `block-${blockHeight}-${timeSlot}`;
  const currentPhi = calculatePhi(blockData);

  phiHistory.push({ timestamp: now, phi: currentPhi.phi });
  if (phiHistory.length > 50) phiHistory.shift();

  const totalNodes = 9;
  const consensusThreshold = Math.log2(totalNodes);
  const adjacencyMatrix = generateAdjacencyMatrix(totalNodes, blockData);

  const perception: NetworkPerception = {
    currentPhi,
    blockHeight,
    totalNodes,
    consensusThreshold,
    meetsConsensus: currentPhi.phi * totalNodes > consensusThreshold,
    phiHistory: phiHistory.slice(),
    adjacencyMatrix,
  };

  latestPerception = perception;
  return perception;
}

export function getNetworkPerception(blockHeight?: number): NetworkPerception {
  if (blockHeight !== undefined) {
    lastBlockHeight = blockHeight;
    return tick(blockHeight);
  }
  if (latestPerception) return latestPerception;
  return tick(lastBlockHeight);
}

export function startEngine(): void {
  if (engineInterval) return;
  console.log("[IIT Engine] Starting continuous Φ computation loop (every 30s)");

  const runTick = async () => {
    try {
      lastBlockHeight = await fetchBlockHeight();
    } catch {
    }
    tick(lastBlockHeight);
  };

  runTick();

  engineInterval = setInterval(runTick, ENGINE_TICK_MS);

  process.on("SIGTERM", () => stopEngine());
  process.on("SIGINT", () => stopEngine());
}

export function stopEngine(): void {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
    console.log("[IIT Engine] Stopped");
  }
}

export function isEngineRunning(): boolean {
  return engineInterval !== null;
}
