import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { wagmiConfig } from "@/lib/wagmi";
import App from "./App";
import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: "hsl(45, 100%, 50%)",
          accentColorForeground: "black",
          borderRadius: "small",
          fontStack: "system",
        })}
        appInfo={{
          appName: "SKYNT Protocol",
        }}
        modalSize="compact"
      >
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
