import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { queryClient } from "@/lib/queryClient";
import { wagmiConfig } from "@/lib/wagmi";
import App from "./App";
import "./index.css";

const skyntTheme = darkTheme({
  accentColor: "hsl(45 100% 60%)",
  accentColorForeground: "#000000",
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "large",
});

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={skyntTheme} modalSize="compact" appInfo={{ appName: "SKYNT Protocol" }}>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
