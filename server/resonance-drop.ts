import { calculatePhi } from "./iit-engine";

interface ResonanceState {
  schumannFrequency: number;
  phi: number;
  isResonanceActive: boolean;
  status: "DORMANT" | "CHARGING" | "RESONANCE_ACTIVE";
  nextWindowCountdown: number;
  lastEventTimestamp: number;
}

interface ResonanceHistory {
  timestamp: number;
  phi: number;
  frequency: number;
  type: string;
}

let resonanceHistory: ResonanceHistory[] = [];
let cachedState: ResonanceState | null = null;
let cachedStateWindow = -1;

export function getSchumannFrequency(): number {
  const now = Date.now();
  const base = 7.83;
  const fluctuation = Math.sin(now / 10000) * 0.5 + Math.sin(now / 1000) * 0.1;
  return parseFloat((base + fluctuation).toFixed(2));
}

export function getResonanceStatus(): ResonanceState {
  const now = Date.now();
  const currentWindow = Math.floor(now / 30000);

  if (cachedState && cachedStateWindow === currentWindow) {
    cachedState.nextWindowCountdown = 30 - (Math.floor(now / 1000) % 30);
    cachedState.schumannFrequency = getSchumannFrequency();
    return cachedState;
  }

  const schumann = getSchumannFrequency();
  
  const networkSeed = `network-resonance-${currentWindow}`;
  const phiMetrics = calculatePhi(networkSeed);
  const phi = phiMetrics.phi * 2;

  const phiThreshold = 1.618;
  const isResonanceActive = phi > phiThreshold;

  let status: ResonanceState["status"] = "DORMANT";
  if (isResonanceActive) {
    status = "RESONANCE_ACTIVE";
  } else if (phi > 1.2) {
    status = "CHARGING";
  }

  const nextWindowCountdown = 30 - (Math.floor(now / 1000) % 30);

  const state: ResonanceState = {
    schumannFrequency: schumann,
    phi,
    isResonanceActive,
    status,
    nextWindowCountdown,
    lastEventTimestamp: resonanceHistory[0]?.timestamp || 0,
  };

  if (isResonanceActive) {
    const lastHistory = resonanceHistory[0];
    const windowStart = currentWindow * 30000;
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

  cachedState = state;
  cachedStateWindow = currentWindow;
  return state;
}

export function getResonanceHistory(): ResonanceHistory[] {
  return resonanceHistory;
}
