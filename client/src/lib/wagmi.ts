import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  injectedWallet,
  phantomWallet,
  rabbyWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mainnet, polygon, base } from "wagmi/chains";

const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, phantomWallet, rabbyWallet, injectedWallet],
    },
  ],
  {
    appName: "SKYNT Protocol",
    projectId: "skynt_protocol_placeholder",
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [mainnet, polygon, base],
  transports: alchemyApiKey
    ? {
        [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
        [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
        [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
      }
    : {
        [mainnet.id]: http(),
        [polygon.id]: http(),
        [base.id]: http(),
      },
});
