import { createContext, useContext, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export interface StakedNftRecord {
  nftId: number;
  rarity: string;
  title: string;
  owner: string;
  boost: number;
  stakedAt: number;
}

export interface ProtocolState {
  lastUpdated: number;
  treasury: {
    poolBalance: number;
    totalYield: number;
    phiBoost: number;
    nftPhiMultiplier: number;
    aaveApr: number;
    aaveDeposited: number;
    gasRefillPool: number;
  };
  mining: {
    isRunning: boolean;
    currentBlock: number;
    latestEpochXi: number;
    totalStxYield: number;
    gasAccumulated: number;
    daemonUptime: number;
  };
  oiye: {
    btcBalance: number;
    sweepCount: number;
    lastSweepAt: number | null;
    freebitcoinDeposited: number;
    depositCount: number;
    watchAddress: string | null;
  };
  wormhole: {
    totalBridged: number;
    activePortals: number;
    completedTransfers: number;
    networkChains: number;
  };
  nfts: {
    totalMinted: number;
    stakedCount: number;
    listedCount: number;
    nftPhiMultiplier: number;
    stakedBoosts: StakedNftRecord[];
    topRarity: string | null;
  };
}

const defaultState: ProtocolState = {
  lastUpdated: 0,
  treasury: { poolBalance: 0, totalYield: 0, phiBoost: 1, nftPhiMultiplier: 1, aaveApr: 0, aaveDeposited: 0, gasRefillPool: 0 },
  mining: { isRunning: false, currentBlock: 0, latestEpochXi: 0, totalStxYield: 0, gasAccumulated: 0, daemonUptime: 0 },
  oiye: { btcBalance: 0, sweepCount: 0, lastSweepAt: null, freebitcoinDeposited: 0, depositCount: 0, watchAddress: null },
  wormhole: { totalBridged: 0, activePortals: 0, completedTransfers: 0, networkChains: 0 },
  nfts: { totalMinted: 0, stakedCount: 0, listedCount: 0, nftPhiMultiplier: 1, stakedBoosts: [], topRarity: null },
};

interface ProtocolContextValue {
  protocol: ProtocolState;
  isLoading: boolean;
  refetch: () => void;
}

const ProtocolContext = createContext<ProtocolContextValue>({
  protocol: defaultState,
  isLoading: false,
  refetch: () => {},
});

export function ProtocolProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = useQuery<ProtocolState>({
    queryKey: ["/api/protocol/state"],
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 2,
  });

  const stableRefetch = useCallback(() => { refetch(); }, [refetch]);

  return (
    <ProtocolContext.Provider value={{ protocol: data ?? defaultState, isLoading, refetch: stableRefetch }}>
      {children}
    </ProtocolContext.Provider>
  );
}

export function useProtocol() {
  return useContext(ProtocolContext);
}
