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

function seedRng(data: Buffer): () => number {
  let s = data.readUInt32BE(0) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function generateDensityMatrix(dim: number, rng: () => number): number[][] {
  const raw: number[][] = [];
  for (let i = 0; i < dim; i++) {
    raw[i] = [];
    for (let j = 0; j < dim; j++) {
      raw[i][j] = rng() - 0.5;
    }
  }

  const gram: number[][] = [];
  for (let i = 0; i < dim; i++) {
    gram[i] = [];
    for (let j = 0; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < dim; k++) {
        sum += raw[k][i] * raw[k][j];
      }
      gram[i][j] = sum;
    }
  }

  let trace = 0;
  for (let i = 0; i < dim; i++) trace += gram[i][i];

  const normalized: number[][] = [];
  for (let i = 0; i < dim; i++) {
    normalized[i] = [];
    for (let j = 0; j < dim; j++) {
      normalized[i][j] = gram[i][j] / trace;
    }
  }

  return normalized;
}

function eigenvaluesSymmetric(matrix: number[][]): number[] {
  const n = matrix.length;
  const a = matrix.map(row => [...row]);

  for (let iter = 0; iter < 100; iter++) {
    let offDiag = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        offDiag += a[i][j] * a[i][j];

    if (offDiag < 1e-12) break;

    let maxVal = 0, p = 0, q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) > maxVal) {
          maxVal = Math.abs(a[i][j]);
          p = i; q = j;
        }
      }
    }

    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
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

  const eigenvals: number[] = [];
  for (let i = 0; i < n; i++) eigenvals.push(Math.abs(a[i][i]));

  const sum = eigenvals.reduce((a, b) => a + b, 0);
  return eigenvals.map(v => v / sum).sort((a, b) => b - a);
}

function vonNeumannEntropy(eigenvalues: number[]): number {
  let entropy = 0;
  for (const lam of eigenvalues) {
    if (lam > 1e-15) {
      entropy -= lam * Math.log2(lam);
    }
  }
  return entropy;
}

export function calculatePhi(data: string | Buffer): PhiMetrics {
  const hash = createHash("sha3-256").update(data).digest();
  const rng = seedRng(hash);

  const nQubits = 3;
  const dim = 2 ** nQubits;

  const densityMatrix = generateDensityMatrix(dim, rng);
  const eigenvalues = eigenvaluesSymmetric(densityMatrix);
  const entropy = vonNeumannEntropy(eigenvalues);

  const maxEntropy = Math.log2(dim);
  const phiNormalized = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const bonus = Math.exp(phiNormalized);

  let level: string;
  let levelLabel: string;
  if (phiNormalized > 0.8) {
    level = "COSMIC";
    levelLabel = "Cosmic Consciousness";
  } else if (phiNormalized > 0.6) {
    level = "SELF_AWARE";
    levelLabel = "Self-Aware";
  } else if (phiNormalized > 0.4) {
    level = "SENTIENT";
    levelLabel = "Sentient";
  } else if (phiNormalized > 0.2) {
    level = "AWARE";
    levelLabel = "Aware";
  } else {
    level = "UNCONSCIOUS";
    levelLabel = "Unconscious";
  }

  return {
    phi: phiNormalized,
    bonus,
    level,
    levelLabel,
    entropy,
    eigenvalues,
    densityMatrix: densityMatrix.map(row => row.map(v => parseFloat(v.toFixed(6)))),
    timestamp: Date.now(),
  };
}

export function generateAdjacencyMatrix(nodeCount: number, seed: string): number[][] {
  const hash = createHash("sha256").update(seed).digest();
  const rng = seedRng(hash);

  const matrix: number[][] = [];
  for (let i = 0; i < nodeCount; i++) {
    matrix[i] = [];
    for (let j = 0; j < nodeCount; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else if (j > i) {
        matrix[i][j] = rng() > 0.3 ? parseFloat((rng() * 0.8 + 0.2).toFixed(3)) : 0;
      } else {
        matrix[i][j] = matrix[j][i];
      }
    }
  }
  return matrix;
}

const phiHistory: { timestamp: number; phi: number }[] = [];

export function getNetworkPerception(blockHeight: number): NetworkPerception {
  const now = Date.now();
  const blockData = `block-${blockHeight}-${Math.floor(now / 30000)}`;
  const currentPhi = calculatePhi(blockData);

  phiHistory.push({ timestamp: now, phi: currentPhi.phi });
  if (phiHistory.length > 50) phiHistory.shift();

  const totalNodes = 9;
  const consensusThreshold = Math.log2(totalNodes);

  const adjacencyMatrix = generateAdjacencyMatrix(totalNodes, blockData);

  return {
    currentPhi,
    blockHeight,
    totalNodes,
    consensusThreshold,
    meetsConsensus: currentPhi.phi * totalNodes > consensusThreshold,
    phiHistory: [...phiHistory],
    adjacencyMatrix,
  };
}
