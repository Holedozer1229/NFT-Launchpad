import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { wagmiConfig } from "@/lib/wagmi";
import App from "./App";
import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";

const wcErrorPatterns = ["Unauthorized: invalid key", "Connection interrupted", "core/relayer", "Fatal socket error"];
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message || String(e.reason || "");
  if (wcErrorPatterns.some((p) => msg.includes(p))) {
    e.preventDefault();
  }
});
window.addEventListener("error", (e) => {
  const msg = e.message || "";
  if (wcErrorPatterns.some((p) => msg.includes(p))) {
    e.preventDefault();
  }
});

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
          appName: "SKYNT Protocol — RocketBabesNFT",
        }}
      >
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
