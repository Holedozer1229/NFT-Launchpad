import { createThirdwebClient } from "thirdweb";

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

if (!clientId) {
  console.warn("[Thirdweb] Missing VITE_THIRDWEB_CLIENT_ID environment variable");
}

export const thirdwebClient = createThirdwebClient({
  clientId: clientId || "placeholder",
});
