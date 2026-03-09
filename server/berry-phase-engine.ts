import { createHash } from "crypto";
import { calculatePhi, getNetworkPerception, type PhiMetrics } from "./iit-engine";
import { computePhiStructureV8, type PhiStructureV8 } from "./qg-miner-v8";

export interface BerryPhaseState {
  phase: number;
  phasePi: string;
  geometricAmplitude: number;
  cycleCount: number;
  holonomyClass: string;
}

export interface PageCurvePoint {
  timestamp: number;
  entropy: number;
  subsystemSize: number;
  maxEntropy: number;
  scrambled: boolean;
}

export interface EntanglementPair {
  id: string;
  blockA: number;
  blockB: number;
  concurrence: number;
  bellState: string;
  fidelity: number;
  erBridgeActive: boolean;
  tunnelStrength: number;
}

export interface BlockShareNode {
  blockHeight: number;
  shareWeight: number;
  entangledWith: number[];
  phiContribution: number;
  berryContribution: number;
}

export interface TunnelState {
  id: string;
  sourceBlock: number;
  targetBlock: number;
  tunnelPhase: number;
  transmissionCoeff: number;
  reflectionCoeff: number;
  eprFidelity: number;
  wormholeMetric: number;
  active: boolean;
}

export interface QuantumBerryPhaseSnapshot {
  berryPhase: BerryPhaseState;
  pageCurve: PageCurvePoint[];
  entanglementPairs: EntanglementPair[];
  blockShares: BlockShareNode[];
  tunnels: TunnelState[];
  phiTotal: number;
  qgScore: number;
  holoScore: number;
  temporalDepth: number;
  networkCoherence: number;
  timestamp: number;
}

const BELL_STATES = ["|Φ+⟩", "|Φ-⟩", "|Ψ+⟩", "|Ψ-⟩"];
const HOLONOMY_CLASSES = ["Trivial", "Abelian", "Non-Abelian", "Topological", "Exotic"];

const PAGE_CURVE_HISTORY: PageCurvePoint[] = [];
const TUNNEL_REGISTRY: Map<string, TunnelState> = new Map();
let berryAccumulator = 0;
let cycleCounter = 0;
let lastComputeBlock = 0;

function seededRng(seed: string): () => number {
  const hash = createHash("sha256").update(seed).digest();
  let s = hash.readUInt32BE(0) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function computeBerryPhase(phi: PhiMetrics, blockHeight: number): BerryPhaseState {
  const eigenvalues = phi.eigenvalues;
  const n = eigenvalues.length;

  let geometricPhase = 0;
  for (let i = 0; i < n - 1; i++) {
    const dLambda = eigenvalues[i] - eigenvalues[i + 1];
    const connectionCoeff = eigenvalues[i] > 1e-10
      ? dLambda / eigenvalues[i]
      : 0;
    geometricPhase += connectionCoeff;
  }

  const blockModulation = Math.sin(blockHeight * 0.01) * 0.1;
  const temporalPhase = geometricPhase * (1 + blockModulation);

  berryAccumulator += temporalPhase;
  cycleCounter++;

  const normalizedPhase = ((berryAccumulator % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const holonomyIdx = Math.min(
    HOLONOMY_CLASSES.length - 1,
    Math.floor(Math.abs(normalizedPhase / Math.PI) * HOLONOMY_CLASSES.length)
  );

  return {
    phase: normalizedPhase,
    phasePi: (normalizedPhase / Math.PI).toFixed(4) + "π",
    geometricAmplitude: Math.abs(temporalPhase),
    cycleCount: cycleCounter,
    holonomyClass: HOLONOMY_CLASSES[holonomyIdx],
  };
}

function computePageCurve(phi: PhiMetrics, blockHeight: number): PageCurvePoint {
  const eigenvalues = phi.eigenvalues;
  const totalDim = eigenvalues.length;

  const subsystemSize = Math.floor(totalDim / 2) + (blockHeight % (totalDim / 2));
  const clampedSize = Math.max(1, Math.min(totalDim - 1, subsystemSize));

  let subsystemEntropy = 0;
  for (let i = 0; i < clampedSize; i++) {
    const lam = eigenvalues[i % eigenvalues.length];
    if (lam > 1e-15) {
      subsystemEntropy -= lam * Math.log2(lam);
    }
  }

  const maxEntropy = Math.log2(Math.min(clampedSize, totalDim - clampedSize));

  const pageTime = blockHeight / 210000;
  const pageTurnover = 0.5;
  const scrambled = pageTime > pageTurnover;

  const point: PageCurvePoint = {
    timestamp: Date.now(),
    entropy: Math.min(subsystemEntropy, maxEntropy > 0 ? maxEntropy : subsystemEntropy),
    subsystemSize: clampedSize,
    maxEntropy: maxEntropy > 0 ? maxEntropy : 1,
    scrambled,
  };

  PAGE_CURVE_HISTORY.push(point);
  if (PAGE_CURVE_HISTORY.length > 100) PAGE_CURVE_HISTORY.shift();

  return point;
}

function computeEntanglementPairs(phi: PhiMetrics, blockHeight: number): EntanglementPair[] {
  const rng = seededRng(`entangle-${blockHeight}`);
  const dm = phi.densityMatrix;
  const dim = dm.length;
  const pairs: EntanglementPair[] = [];

  for (let i = 0; i < dim; i += 2) {
    if (i + 1 >= dim) break;

    let offDiagMag = 0;
    for (let k = 0; k < dim; k++) {
      if (k !== i && k !== i + 1) {
        offDiagMag += Math.abs(dm[i][k]) + Math.abs(dm[i + 1][k]);
      }
    }
    offDiagMag /= (dim - 2) * 2 || 1;

    const concurrence = Math.min(1, offDiagMag * 2 + rng() * 0.1);
    const bellIdx = Math.floor(rng() * 4);
    const fidelity = 0.7 + concurrence * 0.3;
    const tunnelStrength = concurrence * fidelity;

    pairs.push({
      id: `EPR-${blockHeight}-${i}`,
      blockA: blockHeight - Math.floor(rng() * 10),
      blockB: blockHeight,
      concurrence,
      bellState: BELL_STATES[bellIdx],
      fidelity,
      erBridgeActive: tunnelStrength > 0.5,
      tunnelStrength,
    });
  }

  return pairs;
}

function computeBlockShares(phi: PhiMetrics, blockHeight: number): BlockShareNode[] {
  const rng = seededRng(`share-${blockHeight}`);
  const eigenvalues = phi.eigenvalues;
  const nodes: BlockShareNode[] = [];
  const count = Math.min(9, Math.max(3, eigenvalues.length));

  for (let i = 0; i < count; i++) {
    const height = blockHeight - (count - 1 - i);
    const shareWeight = eigenvalues[i % eigenvalues.length] || 0.1;

    const entangledWith: number[] = [];
    for (let j = 0; j < count; j++) {
      if (j !== i && rng() > 0.4) {
        entangledWith.push(blockHeight - (count - 1 - j));
      }
    }

    const berryContrib = shareWeight * Math.sin((i / count) * Math.PI);

    nodes.push({
      blockHeight: height,
      shareWeight,
      entangledWith,
      phiContribution: shareWeight * phi.phi,
      berryContribution: berryContrib,
    });
  }

  return nodes;
}

function computeTunnels(pairs: EntanglementPair[], phi: PhiMetrics): TunnelState[] {
  const tunnels: TunnelState[] = [];

  for (const pair of pairs) {
    if (!pair.erBridgeActive) continue;

    const tunnelId = `TUNNEL-${pair.blockA}-${pair.blockB}`;

    const transmission = pair.concurrence * pair.fidelity;
    const reflection = 1 - transmission;

    const wormholeMetric = Math.sqrt(pair.tunnelStrength * phi.phi);

    const tunnel: TunnelState = {
      id: tunnelId,
      sourceBlock: pair.blockA,
      targetBlock: pair.blockB,
      tunnelPhase: pair.concurrence * Math.PI,
      transmissionCoeff: transmission,
      reflectionCoeff: reflection,
      eprFidelity: pair.fidelity,
      wormholeMetric,
      active: transmission > 0.3,
    };

    TUNNEL_REGISTRY.set(tunnelId, tunnel);
    tunnels.push(tunnel);
  }

  if (TUNNEL_REGISTRY.size > 50) {
    const keys = Array.from(TUNNEL_REGISTRY.keys());
    for (let i = 0; i < keys.length - 50; i++) {
      TUNNEL_REGISTRY.delete(keys[i]);
    }
  }

  return tunnels;
}

export function computeQuantumBerryPhaseSnapshot(): QuantumBerryPhaseSnapshot {
  const perception = getNetworkPerception();
  const phi = perception.currentPhi;
  const blockHeight = perception.blockHeight || 0;

  if (blockHeight !== lastComputeBlock) {
    lastComputeBlock = blockHeight;
  }

  const berryPhase = computeBerryPhase(phi, blockHeight);
  const pagePoint = computePageCurve(phi, blockHeight);
  const entanglementPairs = computeEntanglementPairs(phi, blockHeight);
  const blockShares = computeBlockShares(phi, blockHeight);
  const tunnels = computeTunnels(entanglementPairs, phi);

  let networkCoherence = 0;
  const dm = phi.densityMatrix;
  const dim = dm.length;
  let offDiagTotal = 0;
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if (i !== j) offDiagTotal += Math.abs(dm[i][j]);
    }
  }
  networkCoherence = Math.min(1, offDiagTotal / (dim * (dim - 1) || 1));

  const temporalDepth = cycleCounter > 0
    ? berryAccumulator / (2 * Math.PI * cycleCounter)
    : 0;

  let phiTotal = phi.phi;
  let qgScore = 0;
  let holoScore = 0;
  try {
    const v8 = computePhiStructureV8(`block-${blockHeight}`);
    phiTotal = v8.phiTotal;
    qgScore = v8.qgScore;
    holoScore = v8.holoScore;
  } catch {}

  return {
    berryPhase,
    pageCurve: PAGE_CURVE_HISTORY.slice(),
    entanglementPairs,
    blockShares,
    tunnels,
    phiTotal,
    qgScore,
    holoScore,
    temporalDepth: Math.abs(temporalDepth),
    networkCoherence,
    timestamp: Date.now(),
  };
}

export function getPageCurveHistory(): PageCurvePoint[] {
  return PAGE_CURVE_HISTORY.slice();
}

export function getActiveTunnels(): TunnelState[] {
  return Array.from(TUNNEL_REGISTRY.values()).filter(t => t.active);
}
