import { create } from 'zustand';
import { useActiveAccount, useActiveWallet, useDisconnect, useConnect } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { thirdwebClient } from "./thirdweb";

export type WalletProvider = "metamask" | "phantom" | null;

type WalletState = {
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  error: string | null;
  clearError: () => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  showPicker: false,
  setShowPicker: (show: boolean) => set({ showPicker: show }),
  error: null,
  clearError: () => set({ error: null }),
}));

export function useWallet() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { connect: twConnect, isConnecting } = useConnect();
  const { disconnect: twDisconnect } = useDisconnect();
  const { showPicker, setShowPicker, error, clearError } = useWalletStore();

  const isConnected = !!account;
  const address = account?.address ?? null;

  let provider: WalletProvider = null;
  if (wallet) {
    const wid = wallet.id;
    if (wid === "io.metamask" || wid === "injected") provider = "metamask";
    else if (wid === "app.phantom") provider = "phantom";
    else provider = "metamask";
  }

  const chainName = null;
  const chainId = null;
  const balance = 0;

  const connect = async (walletProvider?: WalletProvider) => {
    if (!walletProvider) {
      setShowPicker(true);
      return;
    }

    try {
      useWalletStore.setState({ error: null });
      if (walletProvider === "metamask") {
        const w = createWallet("io.metamask");
        await twConnect(async () => {
          await w.connect({ client: thirdwebClient });
          return w;
        });
      } else if (walletProvider === "phantom") {
        const w = createWallet("app.phantom");
        await twConnect(async () => {
          await w.connect({ client: thirdwebClient });
          return w;
        });
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Connection failed";
      console.error(`${walletProvider} connection failed`, err);
      useWalletStore.setState({ error: `${walletProvider === "metamask" ? "MetaMask" : "Phantom"}: ${message}` });
    }
  };

  const disconnect = () => {
    if (wallet) {
      twDisconnect(wallet);
    }
  };

  const refreshBalance = async () => {};

  const getEthereumProvider = () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  };

  const getActivePhantomProvider = () => {
    if (typeof window !== "undefined" && (window as any).phantom?.solana) {
      return (window as any).phantom.solana;
    }
    return null;
  };

  return {
    isConnected,
    address,
    balance,
    isConnecting,
    provider,
    chainId,
    chainName,
    error,
    showPicker,
    setShowPicker,
    connect,
    disconnect,
    refreshBalance,
    clearError,
    getEthereumProvider,
    getActivePhantomProvider,
  };
}

export interface LaunchMission {
  id: string;
  missionName: string;
  vehicle: string;
  date: string;
  type: string;
  outcome: 'Success' | 'Failure' | 'Pending';
  description: string;
  imageUrl?: string;
  supply: number;
  minted: number;
  price: number;
  status: 'upcoming' | 'live' | 'ended';
}

export const MOCK_LAUNCHES: LaunchMission[] = [
  {
    id: "l-001",
    missionName: "Starlink Group 6-12",
    vehicle: "Falcon 9 Block 5",
    date: "2023-09-03",
    type: "Communications",
    outcome: "Success",
    description: "Low Earth Orbit deployment of 21 Starlink V2 Mini satellites.",
    supply: 2500,
    minted: 2100,
    price: 0.02,
    status: 'live'
  },
  {
    id: "l-002",
    missionName: "Artemis II (Commemorative)",
    vehicle: "SLS Block 1",
    date: "2024-11-20",
    type: "Lunar Flyby",
    outcome: "Pending",
    description: "First crewed flight of the Artemis program, sending four astronauts around the Moon.",
    supply: 5000,
    minted: 0,
    price: 0.05,
    status: 'upcoming'
  },
  {
    id: "l-003",
    missionName: "Voyager 1 Legacy",
    vehicle: "Titan IIIE",
    date: "1977-09-05",
    type: "Interstellar Probe",
    outcome: "Success",
    description: "Historical commemorative mint for the farthest human-made object from Earth.",
    supply: 1977,
    minted: 1977,
    price: 0.1,
    status: 'ended'
  }
];

export const MINT_STAGES = {
  PRE_LAUNCH: 'pre-launch',
  LIFT_OFF: 'lift-off',
  ORBIT: 'orbit',
};
