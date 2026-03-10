import { createConfig, http } from "wagmi";
import { mainnet, polygon, base } from "wagmi/chains";
import { metaMask, coinbaseWallet, injected } from "@wagmi/connectors";

const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "";

export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, base],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "SKYNT Protocol",
        url: typeof window !== "undefined" ? window.location.origin : "https://skynt.io",
      },
    }),
    coinbaseWallet({
      appName: "SKYNT Protocol",
    }),
    injected(),
  ],
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
