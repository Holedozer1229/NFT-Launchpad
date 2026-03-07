import { createRoot } from "react-dom/client";
import { ThirdwebProvider } from "thirdweb/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThirdwebProvider>
    <App />
  </ThirdwebProvider>
);
