import { create } from 'zustand';

type WalletState = {
  isConnected: boolean;
  address: string | null;
  balance: number;
  connect: () => void;
  disconnect: () => void;
};

export const useWallet = create<WalletState>((set) => ({
  isConnected: false,
  address: null,
  balance: 0,
  connect: () => set({ isConnected: true, address: '0x71C...9A21', balance: 1.45 }),
  disconnect: () => set({ isConnected: false, address: null, balance: 0 }),
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
