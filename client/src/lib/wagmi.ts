import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, base } from "wagmi/chains";
import { http } from "wagmi";

const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "";

if (!alchemyApiKey) {
  console.warn("[Wagmi] Missing VITE_ALCHEMY_API_KEY environment variable — using public RPC");
}

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "skynt_protocol_default";

export const wagmiConfig = getDefaultConfig({
  appName: "SKYNT Protocol",
  projectId: walletConnectProjectId,
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
  ssr: false,
});
