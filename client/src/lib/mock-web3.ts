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

export const MINT_STAGES = {
  CLOSED: 'closed',
  WHITELIST: 'whitelist',
  PUBLIC: 'public',
};

export const MOCK_COLLECTION_INFO = {
  name: "LegalMint Genesis",
  supply: 1000,
  minted: 432,
  price: 0.08,
  contractAddress: "0x892...1293",
  ipfsStatus: "Pinned & Verified",
  royaltyBasisPoints: 500, // 5%
};
