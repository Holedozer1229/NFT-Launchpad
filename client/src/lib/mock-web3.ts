import { create } from 'zustand';
import { MetaMaskSDK } from '@metamask/sdk';

export type WalletProvider = "metamask" | "phantom" | null;

type WalletState = {
  isConnected: boolean;
  address: string | null;
  balance: number;
  isConnecting: boolean;
  provider: WalletProvider;
  chainId: string | null;
  chainName: string | null;
  error: string | null;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  connect: (provider?: WalletProvider) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
  getEthereumProvider: () => any;
  getActivePhantomProvider: () => any;
};

const SESSION_KEY = "skynt_wallet_session";

function saveSession(provider: WalletProvider, address: string | null) {
  try {
    if (provider && address) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ provider, address }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch { /* storage unavailable */ }
}

function loadSession(): { provider: WalletProvider; address: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable */ }
  return null;
}

let mmSDK: MetaMaskSDK | null = null;
let activeEthProvider: any = null;
let activePhantomProvider: any = null;

function getInjectedEthereum(): any | null {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const eth = (window as any).ethereum;
    if (eth.isMetaMask) return eth;
    if (eth.providers) {
      const mm = eth.providers.find((p: any) => p.isMetaMask);
      if (mm) return mm;
    }
  }
  return null;
}

function getMetaMaskSDK() {
  if (!mmSDK) {
    const infuraKey = (import.meta as any).env?.VITE_INFURA_API_KEY || undefined;
    mmSDK = new MetaMaskSDK({
      dappMetadata: {
        name: "SKYNT Protocol",
        url: window.location.origin,
      },
      useDeeplink: true,
      preferDesktop: false,
      ...(infuraKey ? { infuraAPIKey: infuraKey } : {}),
    });
  }
  return mmSDK;
}

function getPhantomProvider(): any | null {
  if (typeof window !== "undefined" && (window as any).phantom?.solana) {
    return (window as any).phantom.solana;
  }
  return null;
}

const EVM_CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet", 5: "Goerli", 11155111: "Sepolia",
  137: "Polygon", 42161: "Arbitrum One", 10: "Optimism",
  324: "zkSync Era", 8453: "Base",
};

function getChainName(chainId: string | null): string | null {
  if (!chainId) return null;
  const id = parseInt(chainId, 16);
  return EVM_CHAIN_NAMES[id] || `Chain ${id}`;
}

async function fetchMetaMaskBalance(addr: string): Promise<{ balance: number; chainId: string | null }> {
  const ethereum = activeEthProvider || getInjectedEthereum();
  let balance = 0;
  let chainId: string | null = null;
  if (ethereum) {
    try {
      const rawBal = await ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
      balance = parseInt(rawBal as string, 16) / 1e18;
    } catch { balance = 0; }
    try {
      chainId = (await ethereum.request({ method: 'eth_chainId' })) as string;
    } catch { chainId = null; }
  }
  return { balance, chainId };
}

async function fetchPhantomBalance(phantom: any): Promise<number> {
  try {
    const connection = phantom.connection || null;
    if (connection && phantom.publicKey) {
      const lamports = await connection.getBalance(phantom.publicKey);
      return lamports / 1e9;
    }
  } catch { /* balance unavailable */ }
  return 0;
}

export const useWallet = create<WalletState>((set, get) => ({
  isConnected: false,
  address: null,
  balance: 0,
  isConnecting: false,
  provider: null,
  chainId: null,
  chainName: null,
  error: null,
  showPicker: false,
  setShowPicker: (show: boolean) => set({ showPicker: show }),
  clearError: () => set({ error: null }),
  connect: async (walletProvider?: WalletProvider) => {
    if (!walletProvider) {
      set({ showPicker: true });
      return;
    }
    set({ isConnecting: true, showPicker: false, error: null });

    try {
      if (walletProvider === "metamask") {
        const injected = getInjectedEthereum();
        let ethereum: any;
        let accounts: string[];

        if (injected) {
          ethereum = injected;
          const result = await injected.request({ method: "eth_requestAccounts" });
          accounts = result as string[];
        } else {
          const sdk = getMetaMaskSDK();
          try {
            const sdkAccounts = await sdk.connect();
            ethereum = sdk.getProvider();
            accounts = sdkAccounts || [];
          } catch (sdkErr: any) {
            if (sdkErr?.message?.includes("User rejected") || sdkErr?.code === 4001) {
              throw sdkErr;
            }
            ethereum = sdk.getProvider();
            if (ethereum) {
              const result = await ethereum.request({ method: "eth_requestAccounts" });
              accounts = result as string[];
            } else {
              throw new Error("Could not connect to MetaMask. Please make sure the MetaMask app is installed.");
            }
          }
        }

        if (accounts && accounts.length > 0) {
          const addr = accounts[0];
          activeEthProvider = ethereum;
          const { balance, chainId } = await fetchMetaMaskBalance(addr);
          saveSession("metamask", addr);
          set({ isConnected: true, address: addr, balance, isConnecting: false, provider: "metamask", chainId, chainName: getChainName(chainId) });

          if (ethereum) {
            ethereum.on?.("accountsChanged", (...args: unknown[]) => {
              const accts = args[0] as string[];
              if (!accts || accts.length === 0) { get().disconnect(); }
              else {
                const newAddr = accts[0];
                saveSession("metamask", newAddr);
                set({ address: newAddr });
                get().refreshBalance();
              }
            });
            ethereum.on?.("chainChanged", (...args: unknown[]) => {
              const newChainId = args[0] as string;
              set({ chainId: newChainId, chainName: getChainName(newChainId) });
              get().refreshBalance();
            });
          }
        } else {
          set({ isConnecting: false, error: "No accounts returned by MetaMask" });
        }
      } else if (walletProvider === "phantom") {
        const phantom = getPhantomProvider();
        if (!phantom) {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            const appUrl = encodeURIComponent(window.location.origin);
            const redirectUrl = encodeURIComponent(window.location.href);
            window.location.href = `https://phantom.app/ul/v1/connect?app_url=${appUrl}&redirect_link=${redirectUrl}`;
            set({ isConnecting: false });
          } else {
            window.open("https://phantom.app/", "_blank");
            set({ isConnecting: false, error: "Phantom wallet not detected. Please install the Phantom extension or use the Phantom mobile app." });
          }
          return;
        }

        try {
          const resp = await phantom.connect();
          const addr = resp.publicKey.toString();
          activePhantomProvider = phantom;
          const balance = await fetchPhantomBalance(phantom);
          saveSession("phantom", addr);
          set({ isConnected: true, address: addr, balance, isConnecting: false, provider: "phantom", chainId: null, chainName: "Solana" });

          phantom.on?.("accountChanged", (publicKey: any) => {
            if (publicKey) {
              const newAddr = publicKey.toString();
              saveSession("phantom", newAddr);
              set({ address: newAddr });
              get().refreshBalance();
            } else {
              get().disconnect();
            }
          });
          phantom.on?.("disconnect", () => {
            get().disconnect();
          });
        } catch (phantomErr: any) {
          if (phantomErr?.code === 4001 || phantomErr?.message?.includes("User rejected")) {
            throw phantomErr;
          }
          throw new Error("Failed to connect to Phantom. Please unlock your wallet and try again.");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      console.error(`${walletProvider} connection failed`, err);
      set({ isConnecting: false, error: `${walletProvider === "metamask" ? "MetaMask" : "Phantom"}: ${message}` });
    }
  },
  disconnect: () => {
    const { provider } = get();
    if (provider === "metamask") {
      activeEthProvider = null;
      if (mmSDK) {
        mmSDK.terminate();
        mmSDK = null;
      }
    } else if (provider === "phantom") {
      const phantom = activePhantomProvider || getPhantomProvider();
      if (phantom) {
        try { phantom.disconnect(); } catch {}
      }
      activePhantomProvider = null;
    }
    saveSession(null, null);
    set({ isConnected: false, address: null, balance: 0, provider: null, chainId: null, chainName: null, error: null });
  },
  getEthereumProvider: () => {
    return activeEthProvider || getInjectedEthereum();
  },
  getActivePhantomProvider: () => {
    return activePhantomProvider || getPhantomProvider();
  },
  refreshBalance: async () => {
    const { provider, address } = get();
    if (!provider || !address) return;
    try {
      if (provider === "metamask") {
        const { balance, chainId } = await fetchMetaMaskBalance(address);
        set({ balance, chainId, chainName: getChainName(chainId) });
      } else if (provider === "phantom") {
        const phantom = getPhantomProvider();
        if (phantom) {
          const balance = await fetchPhantomBalance(phantom);
          set({ balance });
        }
      }
    } catch { /* refresh failed silently */ }
  },
}));

// Auto-reconnect from session on load (delay allows wallet providers to initialize)
const AUTO_RECONNECT_DELAY_MS = 500;
if (typeof window !== "undefined") {
  const session = loadSession();
  if (session) {
    setTimeout(() => { useWallet.getState().connect(session.provider); }, AUTO_RECONNECT_DELAY_MS);
  }
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
