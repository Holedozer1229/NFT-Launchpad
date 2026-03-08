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

function computeSpectralHash(data: string): string {
  return createHash("sha3-256").update(data).digest("hex");
}

function meetsDifficulty(hashHex: string, difficulty: number): boolean {
  const hashInt = BigInt("0x" + hashHex);
  const bitLen = difficulty.toString(2).length;
  const target = BigInt(2) ** BigInt(256 - bitLen);
  return hashInt < target;
}

function computeQGScore(eigenvalues: number[], densityMatrix: number[][]): number {
  if (eigenvalues.length < 2) return 0;
  const sorted = eigenvalues;
  const n = eigenvalues.length;
  const spectralGap = sorted[0] - sorted[n - 1];
  let curvature = 0;
  for (let i = 0; i < n - 1; i++) {
    curvature += Math.abs(sorted[i] - sorted[i + 1]) * (1 - sorted[i + 1]);
  }
  curvature /= (n - 1);
  const dim = densityMatrix.length;
  let traceSq = 0;
  for (let i = 0; i < dim; i++) {
    let rowSum = 0;
    for (let j = 0; j < dim; j++) {
      rowSum += densityMatrix[i][j] * densityMatrix[j][i];
    }
    traceSq += rowSum;
  }
  const purity = Math.min(1, traceSq);
  return Math.min(1, (spectralGap * 0.4 + curvature * 0.3 + (1 - purity) * 0.3));
}

function computeHoloScore(densityMatrix: number[][]): number {
  const dim = densityMatrix.length;
  let offDiagSum = 0;
  let trace = 0;
  for (let i = 0; i < dim; i++) {
    trace += Math.abs(densityMatrix[i][i]);
    for (let j = 0; j < dim; j++) {
      if (i !== j) {
        offDiagSum += Math.abs(densityMatrix[i][j]);
      }
    }
  }
  if (trace === 0) return 0;
  const coherence = offDiagSum / (dim * (dim - 1));
  return Math.min(1, coherence * dim * 0.5);
}

const FANO_LINES = [
  [0, 1, 3], [1, 2, 4], [2, 3, 5], [3, 4, 6],
  [4, 5, 0], [5, 6, 1], [6, 0, 2],
];

function computeFanoScore(eigenvalues: number[]): number {
  const n = eigenvalues.length;
  if (n === 0) return 0;
  const sectors = 7;
  const sectorSums = new Float64Array(sectors);
  for (let i = 0; i < n; i++) {
    sectorSums[i % sectors] += eigenvalues[i];
  }
  const mean = eigenvalues.reduce((a, b) => a + b, 0) / n;
  let alignment = 0;
  for (let li = 0; li < FANO_LINES.length; li++) {
    const line = FANO_LINES[li];
    let lineProduct = 1;
    for (let idx = 0; idx < line.length; idx++) {
      lineProduct *= (sectorSums[line[idx]] || mean);
    }
    alignment += Math.min(1, lineProduct * 10);
  }
  return Math.min(1, alignment / FANO_LINES.length);
}

function computePhiStructure(data: string, config: MinerConfig): PhiStructureV8 {
  const phi = calculatePhi(data);
  return buildStructureFromPhi(phi, config);
}

function buildStructureFromPhi(phi: PhiMetrics, config: MinerConfig): PhiStructureV8 {
  const qgScore = computeQGScore(phi.eigenvalues, phi.densityMatrix);
  const holoScore = computeHoloScore(phi.densityMatrix);
  const fanoScore = computeFanoScore(phi.eigenvalues);
  const phiTau = phi.phi;
  const dimLog = Math.log2(phi.densityMatrix.length);
  const gwtS = dimLog > 0 ? phi.entropy / dimLog : 0;
  const icpAvg = phi.eigenvalues.reduce((s, v) => s + v * Math.log2(v > 1e-15 ? 1 / v : 1), 0) / phi.eigenvalues.length;
  const nablaScore = Math.min(1, Math.abs(phi.eigenvalues[0] - phi.eigenvalues[phi.eigenvalues.length - 1]) * 2);
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

function validateConsciousnessConsensus(
  phiTotal: number,
  fanoScore: number,
  qgScore: number,
  nNetworkNodes: number,
  config: MinerConfig
): boolean {
  const logN = Math.log2(Math.max(1, nNetworkNodes));
  const threshold = logN + config.delta * fanoScore + config.zeta * qgScore;
  const normalizedThreshold = threshold / (logN + 1);
  return phiTotal > normalizedThreshold * 0.3;
}

function phiToLegacyScore(phiTotal: number): number {
  return Math.min(1000, Math.max(200, 200 + phiTotal * 800));
}

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
    return {
      valid: false,
      structure: null as unknown as PhiStructureV8,
      gateFailed: "difficulty",
      hashHex,
    };
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
        nonce,
        blockHash: hashHex,
        phiTotal: structure.phiTotal,
        qgScore: structure.qgScore,
        holoScore: structure.holoScore,
        fanoScore: structure.fanoScore,
        phiScore: phiToLegacyScore(structure.phiTotal),
        attempts: nonce + 1,
        gatesPassed: ["spectral", "consciousness", "qg_curvature"],
      };
    }
  }

  const fallbackStructure = computePhiStructure(blockData, config);
  return {
    nonce: null,
    blockHash: null,
    phiTotal: fallbackStructure.phiTotal,
    qgScore: fallbackStructure.qgScore,
    holoScore: fallbackStructure.holoScore,
    fanoScore: fallbackStructure.fanoScore,
    phiScore: 200,
    attempts: maxAttempts,
    gatesPassed: [],
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

  const stats: GateStats = {
    totalAttempts: 0,
    difficultyRejected: 0,
    consciousnessRejected: 0,
    qgCurvatureRejected: 0,
    accepted: 0,
  };

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
          nonce,
          blockHash: hashHex,
          phiTotal: structure.phiTotal,
          qgScore: structure.qgScore,
          holoScore: structure.holoScore,
          fanoScore: structure.fanoScore,
          phiScore: phiToLegacyScore(structure.phiTotal),
          attempts: nonce + 1,
          gatesPassed: ["spectral", "consciousness", "qg_curvature"],
        },
        stats,
      };
    }
  }

  const fallbackStructure = computePhiStructure(blockData, config);
  return {
    result: {
      nonce: null,
      blockHash: null,
      phiTotal: fallbackStructure.phiTotal,
      qgScore: fallbackStructure.qgScore,
      holoScore: fallbackStructure.holoScore,
      fanoScore: fallbackStructure.fanoScore,
      phiScore: 200,
      attempts: maxAttempts,
      gatesPassed: [],
    },
    stats,
  };
}

class QuantumGravityMinerV8 {
  config: MinerConfig;
  lastMineResult: MineResultV8 | null = null;

  constructor(config?: Partial<MinerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  computeSpectralHash(data: string): string {
    return computeSpectralHash(data);
  }

  meetsDifficulty(hashHex: string, difficulty: number): boolean {
    return meetsDifficulty(hashHex, difficulty);
  }

  computePhiStructure(data: string): PhiStructureV8 {
    return computePhiStructure(data, this.config);
  }

  validateConsciousnessConsensus(phiTotal: number, fanoScore: number, qgScore: number, nNodes: number): boolean {
    return validateConsciousnessConsensus(phiTotal, fanoScore, qgScore, nNodes, this.config);
  }

  isValidBlock(data: string, difficulty: number, nNetworkNodes?: number) {
    const result = isValidBlock(data, difficulty, nNetworkNodes ?? 1, this.config);
    return { valid: result.valid, structure: result.structure, gateFailed: result.gateFailed };
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

  phiToLegacyScore(phiTotal: number): number {
    return phiToLegacyScore(phiTotal);
  }

  getStatus() {
    return {
      config: this.config,
      lastMineResult: this.lastMineResult,
    };
  }
}

export const qgMiner = new QuantumGravityMinerV8();

export {
  QuantumGravityMinerV8,
  computeSpectralHash,
  meetsDifficulty,
  computePhiStructure as computePhiStructureV8,
  phiToLegacyScore,
};
