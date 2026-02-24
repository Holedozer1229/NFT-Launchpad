import { create } from 'zustand';
import { MetaMaskSDK } from '@metamask/sdk';

type WalletState = {
  isConnected: boolean;
  address: string | null;
  balance: number;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

let mmSDK: MetaMaskSDK | null = null;

function getSDK() {
  if (!mmSDK) {
    mmSDK = new MetaMaskSDK({
      dappMetadata: {
        name: "SKYNT Protocol",
        url: window.location.href,
      },
      infuraAPIKey: "12a0ef604cec454d929aa225c94a9d41",
    });
  }
  return mmSDK;
}

export const useWallet = create<WalletState>((set) => ({
  isConnected: false,
  address: null,
  balance: 0,
  isConnecting: false,
  connect: async () => {
    set({ isConnecting: true });
    try {
      const sdk = getSDK();
      const accounts = await sdk.connect();
      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        const ethereum = sdk.getProvider();
        let balance = 0;
        if (ethereum) {
          try {
            const rawBal = await ethereum.request({
              method: 'eth_getBalance',
              params: [addr, 'latest'],
            });
            balance = parseInt(rawBal as string, 16) / 1e18;
          } catch {
            balance = 0;
          }
        }
        set({ isConnected: true, address: addr, balance, isConnecting: false });
      } else {
        set({ isConnecting: false });
      }
    } catch (err) {
      console.error("MetaMask connection failed", err);
      set({ isConnecting: false });
    }
  },
  disconnect: () => {
    set({ isConnected: false, address: null, balance: 0 });
    if (mmSDK) {
      mmSDK.terminate();
      mmSDK = null;
    }
  },
}));

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
