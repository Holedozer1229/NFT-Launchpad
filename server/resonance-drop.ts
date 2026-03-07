import { calculatePhi } from "./iit-engine";

interface ResonanceState {
  schumannFrequency: number;
  phi: number;
  isResonanceActive: boolean;
  status: "DORMANT" | "CHARGING" | "RESONANCE_ACTIVE";
  nextWindowCountdown: number; // seconds
  lastEventTimestamp: number;
}

interface ResonanceHistory {
  timestamp: number;
  phi: number;
  frequency: number;
  type: string;
}

let resonanceHistory: ResonanceHistory[] = [];

export function getSchumannFrequency(): number {
  const now = Date.now();
  // Base 7.83Hz with some simulated fluctuations
  const base = 7.83;
  const fluctuation = Math.sin(now / 10000) * 0.5 + Math.sin(now / 1000) * 0.1;
  return parseFloat((base + fluctuation).toFixed(2));
}

export function getResonanceStatus(): ResonanceState {
  const now = Date.now();
  const schumann = getSchumannFrequency();
  
  // Use IIT engine to get current network Phi
  // We'll use a consistent seed for the "network" based on 30s intervals
  const networkSeed = `network-resonance-${Math.floor(now / 30000)}`;
  const phiMetrics = calculatePhi(networkSeed);
  const phi = phiMetrics.phi * 2; // Scale for demo purposes to reach 1.618

  const phiThreshold = 1.618;
  const isResonanceActive = phi > phiThreshold;

  let status: ResonanceState["status"] = "DORMANT";
  if (isResonanceActive) {
    status = "RESONANCE_ACTIVE";
  } else if (phi > 1.2) {
    status = "CHARGING";
  }

  // Next window prediction (mock logic)
  const nextWindowCountdown = 30 - (Math.floor(now / 1000) % 30);

  const state: ResonanceState = {
    schumannFrequency: schumann,
    phi,
    isResonanceActive,
    status,
    nextWindowCountdown,
    lastEventTimestamp: resonanceHistory[0]?.timestamp || 0,
  };

  // Record history if active and not already recorded for this window
  if (isResonanceActive) {
    const lastHistory = resonanceHistory[0];
    const windowStart = Math.floor(now / 30000) * 30000;
    if (!lastHistory || lastHistory.timestamp < windowStart) {
      resonanceHistory.unshift({
        timestamp: now,
        phi,
        frequency: schumann,
        type: "PHI_THRESHOLD_CROSSING",
      });
      if (resonanceHistory.length > 20) resonanceHistory.pop();
    }
  }

  return state;
}

export function getResonanceHistory(): ResonanceHistory[] {
  return resonanceHistory;
}
