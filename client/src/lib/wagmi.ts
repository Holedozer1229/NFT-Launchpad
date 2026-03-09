import { getDefaultConfig, connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  phantomWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { mainnet, polygon, base } from "wagmi/chains";
import { http, createConfig } from "wagmi";

const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "";

if (!alchemyApiKey) {
  console.warn("[Wagmi] Missing VITE_ALCHEMY_API_KEY — using public RPC");
}

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const hasWC = walletConnectProjectId.length > 10 && walletConnectProjectId !== "skynt_protocol_default";

const chains = [mainnet, polygon, base] as const;

const transports = alchemyApiKey
  ? {
      [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
      [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
      [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    }
  : {
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [base.id]: http(),
    };

const browserWallets = [
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  phantomWallet,
  rabbyWallet,
];

const walletGroups = hasWC
  ? [
      {
        groupName: "Popular",
        wallets: [...browserWallets, walletConnectWallet],
      },
    ]
  : [
      {
        groupName: "Browser Wallets",
        wallets: browserWallets,
      },
    ];

const connectors = connectorsForWallets(walletGroups, {
  appName: "SKYNT Protocol",
  projectId: hasWC ? walletConnectProjectId : "00000000000000000000000000000000",
});

export const wagmiConfig = createConfig({
  connectors,
  chains,
  transports,
  ssr: false,
});
