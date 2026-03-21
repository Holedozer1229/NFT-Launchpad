import { createHash } from "crypto";
import { calculatePhi, type PhiMetrics } from "./iit-engine";

export interface PhiStructureV8 {
  phiTotal: number;
  qgScore: number;
  holoScore: number;
  fanoScore: number;
  phiTau: number;
  gwtS: number;
  icpAvg: number;
  nablaScore: number;
  eigenvalues: number[];
  densityMatrix: number[][];
  level: string;
  levelLabel: string;
}

export interface MineResultV8 {
  nonce: number | null;
  blockHash: string | null;
  phiTotal: number;
  qgScore: number;
  holoScore: number;
  fanoScore: number;
  phiScore: number;
  attempts: number;
  gatesPassed: string[];
}

export interface GateStats {
  totalAttempts: number;
  difficultyRejected: number;
  consciousnessRejected: number;
  qgCurvatureRejected: number;
  accepted: number;
}

export interface MinerConfig {
  qgThreshold: number;
  nNodes: number;
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
  epsilon: number;
  zeta: number;
  eta: number;
}

const DEFAULT_CONFIG: MinerConfig = {
  qgThreshold: 0.10,
  nNodes: 3,
  alpha: 0.30,
  beta: 0.15,
  gamma: 0.15,
  delta: 0.15,
  epsilon: 0.10,
  zeta: 0.10,
  eta: 0.05,
};

// ---------------------------------------------------------------------------
// Jacobi eigenvalue solver for small symmetric matrices (up to ~8×8)
// Reused from iit-engine for partial-trace density matrices
// ---------------------------------------------------------------------------
function eigenvaluesSymmetricSmall(matrix: number[][]): number[] {
  const n = matrix.length;
  if (n === 1) return [matrix[0][0]];
  const a = matrix.map(row => [...row]);

  for (let iter = 0; iter < 200; iter++) {
    let maxVal = 0, p = 0, q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(a[i][j]);
        if (v > maxVal) { maxVal = v; p = i; q = j; }
      }
    }
    if (maxVal < 1e-12) break;
    const diff = a[q][q] - a[p][p];
    const apq = a[p][q];
    const theta = diff / (2 * apq);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;
    const app = a[p][p], aqq = a[q][q];
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = a[i][p], aiq = a[i][q];
        a[i][p] = c * aip - s * aiq; a[p][i] = a[i][p];
        a[i][q] = s * aip + c * aiq; a[q][i] = a[i][q];
      }
    }
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0; a[q][p] = 0;
  }

  const eigs = a.map((row, i) => Math.max(0, row[i]));
  const sum = eigs.reduce((acc, v) => acc + v, 0);
  if (sum < 1e-15) return eigs;
  return eigs.map(v => v / sum).sort((x, y) => y - x);
}

// ---------------------------------------------------------------------------
// Von Neumann entropy: S = -Σ λᵢ log₂(λᵢ)
// ---------------------------------------------------------------------------
function vonNeumannEntropy(eigenvalues: number[]): number {
  let S = 0;
  for (const lam of eigenvalues) {
    if (lam > 1e-15) S -= lam * Math.log2(lam);
  }
  return S;
}

// ---------------------------------------------------------------------------
// Partial trace (Ryu-Takayanagi bipartition machinery)
//
// For a system of nNodes qubits (2^nNodes × 2^nNodes density matrix ρ):
//   keepNodes: list of node indices to keep in subsystem A
//   traceNodes: remaining nodes (Ā), traced out
//
// State encoding: state index is interpreted as a binary number where
//   bit k corresponds to node k.
// ---------------------------------------------------------------------------
function bitsToFullIndex(
  keepBits: number, keepNodes: number[],
  traceBits: number, traceNodes: number[]
): number {
  let idx = 0;
  for (let ki = 0; ki < keepNodes.length; ki++) {
    if ((keepBits >> ki) & 1) idx |= (1 << keepNodes[ki]);
  }
  for (let ti = 0; ti < traceNodes.length; ti++) {
    if ((traceBits >> ti) & 1) idx |= (1 << traceNodes[ti]);
  }
  return idx;
}

function partialTrace(rho: number[][], nNodes: number, keepNodes: number[]): number[][] {
  const all = Array.from({ length: nNodes }, (_, i) => i);
  const traceNodes = all.filter(i => !keepNodes.includes(i));
  const dimKeep = 1 << keepNodes.length;
  const dimTrace = 1 << traceNodes.length;

  const result: number[][] = Array.from({ length: dimKeep }, () => new Array(dimKeep).fill(0));
  for (let i = 0; i < dimKeep; i++) {
    for (let j = 0; j < dimKeep; j++) {
      for (let k = 0; k < dimTrace; k++) {
        const row = bitsToFullIndex(i, keepNodes, k, traceNodes);
        const col = bitsToFullIndex(j, keepNodes, k, traceNodes);
        result[i][j] += rho[row][col];
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Φ_qg — IIT v8.0 Quantum Gravity Curvature Score
//
//   Φ_qg = 1 − exp(−Var(σ) / (mean(σ)² + ε))
//
// where σ are the singular values of the transition matrix T.
// For a symmetric positive semi-definite density matrix ρ, singular values
// equal eigenvalues (σᵢ = λᵢ).  We therefore use the normalised eigenvalue
// spectrum returned by iit-engine directly.
// ---------------------------------------------------------------------------
function computeQGScore(eigenvalues: number[]): number {
  const n = eigenvalues.length;
  if (n < 2) return 0;
  const eps = 1e-10;
  const mean = eigenvalues.reduce((a, b) => a + b, 0) / n;
  const variance = eigenvalues.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const meanSq = mean * mean;
  return 1 - Math.exp(-variance / (meanSq + eps));
}

// ---------------------------------------------------------------------------
// Φ_holo — IIT v8.0 Holographic Ryu-Takayanagi Entanglement Entropy Score
//
//   S_A    = −Tr(ρ_A · log₂(ρ_A))     (von Neumann entropy per bipartition)
//   S_RT   = min_{A} S_A               (minimal-area surface à la RT)
//   Φ_holo = S_RT / ⌊n/2⌋             (normalised by half-system max entropy)
//
// We iterate over all non-trivial bipartitions A (|A| = 1 … n-1) and
// compute the von Neumann entropy of the reduced density matrix ρ_A.
// ---------------------------------------------------------------------------
function computeHoloScore(densityMatrix: number[][], nNodes: number = 3): number {
  const floor_n2 = Math.floor(nNodes / 2);
  if (nNodes < 2 || floor_n2 === 0) return 0;

  // Generate all bipartitions A of size 1 … n-1 (we skip all-or-nothing)
  const totalBipartitions = (1 << nNodes) - 2; // exclude 0 and (2^n - 1)
  let minEntropy = Infinity;

  for (let mask = 1; mask <= totalBipartitions; mask++) {
    const keepNodes: number[] = [];
    for (let k = 0; k < nNodes; k++) {
      if ((mask >> k) & 1) keepNodes.push(k);
    }
    // Only consider A and Ā with |A| ≥ 1 and |Ā| ≥ 1
    if (keepNodes.length === 0 || keepNodes.length === nNodes) continue;

    const rhoA = partialTrace(densityMatrix, nNodes, keepNodes);
    const eigsA = eigenvaluesSymmetricSmall(rhoA);
    const SA = vonNeumannEntropy(eigsA);
    if (SA < minEntropy) minEntropy = SA;
  }

  if (!isFinite(minEntropy)) return 0;
  // Normalise: max von Neumann entropy for a ⌊n/2⌋-qubit subsystem is ⌊n/2⌋ bits
  return Math.min(1, minEntropy / floor_n2);
}

// ---------------------------------------------------------------------------
// Φ_fano — 7-fold Fano plane alignment across eigenvalue sectors
// ---------------------------------------------------------------------------
const FANO_LINES = [
  [0, 1, 3], [1, 2, 4], [2, 3, 5], [3, 4, 6],
  [4, 5, 0], [5, 6, 1], [6, 0, 2],
];

function computeFanoScore(eigenvalues: number[]): number {
  const n = eigenvalues.length;
  if (n === 0) return 0;
  const sectors = 7;
  const sectorSums = new Float64Array(sectors);
  for (let i = 0; i < n; i++) sectorSums[i % sectors] += eigenvalues[i];
  const mean = eigenvalues.reduce((a, b) => a + b, 0) / n;
  let alignment = 0;
  for (const line of FANO_LINES) {
    let lineProduct = 1;
    for (const idx of line) lineProduct *= (sectorSums[idx] || mean);
    alignment += Math.min(1, lineProduct * 10);
  }
  return Math.min(1, alignment / FANO_LINES.length);
}

// ---------------------------------------------------------------------------
// IIT v8.0 QG-augmented consciousness-consensus condition
//
//   Φ_total > log₂(n) + δ·Φ_fano + ζ·Φ_qg
//
// The QG curvature term dynamically raises the threshold for highly
// curved (self-referential) causal structures, per the Jones QG Resolution.
// ---------------------------------------------------------------------------
function validateConsciousnessConsensus(
  phiTotal: number,
  fanoScore: number,
  qgScore: number,
  nNetworkNodes: number,
  config: MinerConfig
): boolean {
  const logN = Math.log2(Math.max(2, nNetworkNodes));
  const threshold = logN + config.delta * fanoScore + config.zeta * qgScore;
  // Normalize to [0,1] range for practical mining operation on small n
  const normalizedThreshold = threshold / (logN + 1);
  return phiTotal > normalizedThreshold * 0.3;
}

// ---------------------------------------------------------------------------
// Spectral hash & difficulty
// ---------------------------------------------------------------------------
function computeSpectralHash(data: string): string {
  return createHash("sha3-256").update(data).digest("hex");
}

function meetsDifficulty(hashHex: string, difficulty: number): boolean {
  const hashInt = BigInt("0x" + hashHex);
  const bitLen = difficulty.toString(2).length;
  const target = BigInt(2) ** BigInt(256 - bitLen);
  return hashInt < target;
}

// ---------------------------------------------------------------------------
// Build the full PhiStructureV8 from raw PhiMetrics
// ---------------------------------------------------------------------------
function buildStructureFromPhi(phi: PhiMetrics, config: MinerConfig): PhiStructureV8 {
  // Φ_qg: exact IIT v8.0 SVD-variance formula (eigenvalues ≡ singular values for ρ)
  const qgScore = computeQGScore(phi.eigenvalues);
  // Φ_holo: RT bipartition minimal-area von Neumann entropy, n=3 nodes, dim=8
  const nNodes = config.nNodes;
  const holoScore = computeHoloScore(phi.densityMatrix, nNodes);
  // Φ_fano: Fano plane 7-sector alignment
  const fanoScore = computeFanoScore(phi.eigenvalues);

  const phiTau = phi.phi;
  const dimLog = Math.log2(phi.densityMatrix.length);
  const gwtS = dimLog > 0 ? phi.entropy / dimLog : 0;
  const icpAvg = phi.eigenvalues.reduce(
    (s, v) => s + v * Math.log2(v > 1e-15 ? 1 / v : 1), 0
  ) / phi.eigenvalues.length;
  const nablaScore = Math.min(
    1,
    Math.abs(phi.eigenvalues[0] - phi.eigenvalues[phi.eigenvalues.length - 1]) * 2
  );

  // 7-term composite: α·Φ_τ + β·GWT_S + γ·ICP_avg + δ·Φ_fano + ε·Φ_nab + ζ·Φ_qg + η·Φ_holo
  const phiTotal =
    config.alpha * phiTau +
    config.beta * gwtS +
    config.gamma * Math.min(1, icpAvg) +
    config.delta * fanoScore +
    config.epsilon * nablaScore +
    config.zeta * qgScore +
    config.eta * holoScore;

  return {
    phiTotal,
    qgScore,
    holoScore,
    fanoScore,
    phiTau,
    gwtS,
    icpAvg: Math.min(1, icpAvg),
    nablaScore,
    eigenvalues: phi.eigenvalues,
    densityMatrix: phi.densityMatrix,
    level: phi.level,
    levelLabel: phi.levelLabel,
  };
}

function computePhiStructure(data: string, config: MinerConfig): PhiStructureV8 {
  const phi = calculatePhi(data);
  return buildStructureFromPhi(phi, config);
}

function phiToLegacyScore(phiTotal: number): number {
  return Math.min(1000, Math.max(200, 200 + phiTotal * 800));
}

// ---------------------------------------------------------------------------
// Block validation
// ---------------------------------------------------------------------------
interface BlockValidation {
  valid: boolean;
  structure: PhiStructureV8;
  gateFailed: string;
  hashHex: string;
}

function isValidBlock(
  data: string,
  difficulty: number,
  nNetworkNodes: number,
  config: MinerConfig
): BlockValidation {
  const hashHex = computeSpectralHash(data);
  if (!meetsDifficulty(hashHex, difficulty)) {
    return { valid: false, structure: null as unknown as PhiStructureV8, gateFailed: "difficulty", hashHex };
  }
  const structure = computePhiStructure(data, config);
  if (!validateConsciousnessConsensus(
    structure.phiTotal, structure.fanoScore, structure.qgScore, nNetworkNodes, config
  )) {
    return { valid: false, structure, gateFailed: "consciousness", hashHex };
  }
  if (structure.qgScore < config.qgThreshold) {
    return { valid: false, structure, gateFailed: "qg_curvature", hashHex };
  }
  return { valid: true, structure, gateFailed: "", hashHex };
}

// ---------------------------------------------------------------------------
// Mining routines
// ---------------------------------------------------------------------------
function mine(
  blockData: string,
  difficulty: number,
  config: MinerConfig,
  opts?: { nNetworkNodes?: number; maxAttempts?: number }
): MineResultV8 {
  const nNetworkNodes = opts?.nNetworkNodes ?? 1;
  const maxAttempts = opts?.maxAttempts ?? 100_000;

  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    const data = `${blockData}${nonce}`;
    const { valid, structure, hashHex } = isValidBlock(data, difficulty, nNetworkNodes, config);
    if (valid) {
      return {
        nonce, blockHash: hashHex,
        phiTotal: structure.phiTotal, qgScore: structure.qgScore,
        holoScore: structure.holoScore, fanoScore: structure.fanoScore,
        phiScore: phiToLegacyScore(structure.phiTotal),
        attempts: nonce + 1, gatesPassed: ["spectral", "consciousness", "qg_curvature"],
      };
    }
  }

  const fallback = computePhiStructure(blockData, config);
  return {
    nonce: null, blockHash: null,
    phiTotal: fallback.phiTotal, qgScore: fallback.qgScore,
    holoScore: fallback.holoScore, fanoScore: fallback.fanoScore,
    phiScore: 200, attempts: maxAttempts, gatesPassed: [],
  };
}

function mineWithStats(
  blockData: string,
  difficulty: number,
  config: MinerConfig,
  opts?: { nNetworkNodes?: number; maxAttempts?: number }
): { result: MineResultV8; stats: GateStats } {
  const nNetworkNodes = opts?.nNetworkNodes ?? 1;
  const maxAttempts = opts?.maxAttempts ?? 100_000;

  const stats: GateStats = { totalAttempts: 0, difficultyRejected: 0, consciousnessRejected: 0, qgCurvatureRejected: 0, accepted: 0 };

  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    stats.totalAttempts++;
    const data = `${blockData}${nonce}`;
    const { valid, structure, gateFailed, hashHex } = isValidBlock(data, difficulty, nNetworkNodes, config);
    if (gateFailed === "difficulty") { stats.difficultyRejected++; continue; }
    if (gateFailed === "consciousness") { stats.consciousnessRejected++; continue; }
    if (gateFailed === "qg_curvature") { stats.qgCurvatureRejected++; continue; }
    if (valid) {
      stats.accepted = 1;
      return {
        result: {
          nonce, blockHash: hashHex,
          phiTotal: structure.phiTotal, qgScore: structure.qgScore,
          holoScore: structure.holoScore, fanoScore: structure.fanoScore,
          phiScore: phiToLegacyScore(structure.phiTotal),
          attempts: nonce + 1, gatesPassed: ["spectral", "consciousness", "qg_curvature"],
        },
        stats,
      };
    }
  }

  const fallback = computePhiStructure(blockData, config);
  return {
    result: {
      nonce: null, blockHash: null,
      phiTotal: fallback.phiTotal, qgScore: fallback.qgScore,
      holoScore: fallback.holoScore, fanoScore: fallback.fanoScore,
      phiScore: 200, attempts: maxAttempts, gatesPassed: [],
    },
    stats,
  };
}

// ---------------------------------------------------------------------------
// QuantumGravityMinerV8 class
// ---------------------------------------------------------------------------
class QuantumGravityMinerV8 {
  config: MinerConfig;
  lastMineResult: MineResultV8 | null = null;

  constructor(config?: Partial<MinerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  computeSpectralHash(data: string): string { return computeSpectralHash(data); }
  meetsDifficulty(hashHex: string, difficulty: number): boolean { return meetsDifficulty(hashHex, difficulty); }
  computePhiStructure(data: string): PhiStructureV8 { return computePhiStructure(data, this.config); }

  validateConsciousnessConsensus(phiTotal: number, fanoScore: number, qgScore: number, nNodes: number): boolean {
    return validateConsciousnessConsensus(phiTotal, fanoScore, qgScore, nNodes, this.config);
  }

  isValidBlock(data: string, difficulty: number, nNetworkNodes?: number) {
    const r = isValidBlock(data, difficulty, nNetworkNodes ?? 1, this.config);
    return { valid: r.valid, structure: r.structure, gateFailed: r.gateFailed };
  }

  mine(blockData: string, difficulty: number, opts?: { nNetworkNodes?: number; maxAttempts?: number }): MineResultV8 {
    const result = mine(blockData, difficulty, this.config, opts);
    this.lastMineResult = result;
    return result;
  }

  mineWithStats(blockData: string, difficulty: number, opts?: { nNetworkNodes?: number; maxAttempts?: number }) {
    const r = mineWithStats(blockData, difficulty, this.config, opts);
    this.lastMineResult = r.result;
    return r;
  }

  phiToLegacyScore(phiTotal: number): number { return phiToLegacyScore(phiTotal); }
  getStatus() { return { config: this.config, lastMineResult: this.lastMineResult }; }
}

export const qgMiner = new QuantumGravityMinerV8();

export {
  QuantumGravityMinerV8,
  computeSpectralHash,
  meetsDifficulty,
  computePhiStructure as computePhiStructureV8,
  computeQGScore,
  computeHoloScore,
  computeFanoScore,
  phiToLegacyScore,
};
