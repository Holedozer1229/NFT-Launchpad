import { create } from 'zustand';

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


export const MINT_STAGES = {
  PRE_LAUNCH: 'pre-launch',
  LIFT_OFF: 'lift-off',
  ORBIT: 'orbit',
};
