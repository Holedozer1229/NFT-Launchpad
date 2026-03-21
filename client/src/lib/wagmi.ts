import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, base, arbitrum, optimism, zksync } from "wagmi/chains";
import { http } from "wagmi";

const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "";
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "b5a10f88c3b97b70e36dfbf4e6cd673e";

function alchemyTransport(network: string) {
  if (alchemyApiKey) {
    return http(`https://${network}.g.alchemy.com/v2/${alchemyApiKey}`);
  }
  return http();
}

export const wagmiConfig = getDefaultConfig({
  appName: "SKYNT Protocol",
  projectId: walletConnectProjectId,
  chains: [mainnet, polygon, base, arbitrum, optimism, zksync],
  transports: {
    [mainnet.id]: alchemyTransport("eth-mainnet"),
    [polygon.id]: alchemyTransport("polygon-mainnet"),
    [base.id]: alchemyTransport("base-mainnet"),
    [arbitrum.id]: alchemyTransport("arb-mainnet"),
    [optimism.id]: alchemyTransport("opt-mainnet"),
    [zksync.id]: http("https://mainnet.era.zksync.io"),
  },
  ssr: false,
});
