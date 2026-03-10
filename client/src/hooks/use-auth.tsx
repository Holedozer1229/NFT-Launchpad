import { createContext, ReactNode, useContext, useRef, useEffect, useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, setJwtTokens, clearJwtTokens, getJwtToken } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAccount, useSignMessage } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

type User = {
  id: number;
  username: string;
  isAdmin: boolean;
  walletAddress?: string | null;
  authProvider?: string | null;
  mfaEnabled?: boolean;
};

type MfaChallenge = {
  mfaToken: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string, captchaToken?: string) => Promise<MfaChallenge | void>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  loginWithWallet: (address: string, signature: string, nonce: string) => Promise<void>;
  linkWallet: () => Promise<void>;
  resetLinkState: () => void;
  register: (username: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  walletLinked: boolean;
  isLinkingWallet: boolean;
  linkError: string | null;
};

const AuthContext = createContext<AuthContextType | null>(null);

const SIGN_TIMEOUT_MS = 60000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkingRef = useRef(false);
  const lastLinkAttempt = useRef(0);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const token = getJwtToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/user", { credentials: "include", headers });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  const walletLinked = !!(
    user?.walletAddress &&
    address &&
    user.walletAddress.toLowerCase() === address.toLowerCase()
  );

  const loginMutation = useMutation({
    mutationFn: async ({ username, password, captchaToken }: { username: string; password: string; captchaToken?: string }) => {
      const res = await apiRequest("POST", "/api/login", { username, password, captchaToken });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.mfaRequired) {
        return;
      }
      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);
      setLocation("/");
    },
  });

  const verifyMfaMutation = useMutation({
    mutationFn: async ({ mfaToken, code }: { mfaToken: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/mfa/verify", { mfaToken, code });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);
      setLocation("/");
    },
  });

  const loginWithWalletMutation = useMutation({
    mutationFn: async ({ address, signature, nonce }: { address: string; signature: string; nonce: string }) => {
      const res = await apiRequest("POST", "/api/auth/wallet", { address, signature, nonce });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const wasLoggedIn = !!user;
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);
      if (!wasLoggedIn) {
        setLocation("/");
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password, captchaToken }: { username: string; password: string; captchaToken?: string }) => {
      const res = await apiRequest("POST", "/api/register", { username, password, captchaToken });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);
      setLocation("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      clearJwtTokens();
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/auth");
    },
  });

  const resetLinkState = useCallback(() => {
    linkingRef.current = false;
    setIsLinkingWallet(false);
    setLinkError(null);
  }, []);

  const doLinkWallet = useCallback(async () => {
    if (linkingRef.current || !address || !isConnected || !user) return;
    if (walletLinked) return;

    const now = Date.now();
    if (now - lastLinkAttempt.current < 3000) return;
    lastLinkAttempt.current = now;

    linkingRef.current = true;
    setIsLinkingWallet(true);
    setLinkError(null);

    try {
      const nonceRes = await withTimeout(
        apiRequest("POST", "/api/auth/link-wallet/nonce", { address }),
        10000,
        "Nonce request"
      );
      if (!nonceRes.ok) {
        const errData = await nonceRes.json().catch(() => ({ message: "Failed to get verification nonce" }));
        throw new Error(errData.message || "Failed to get verification nonce");
      }
      const { nonce } = await nonceRes.json();

      if (!nonce || typeof nonce !== "string") {
        throw new Error("Server returned invalid nonce");
      }

      const message = `SKYNT Protocol — Link Wallet\nAccount: ${user.username}\nWallet: ${address}\nNonce: ${nonce}`;

      let signature: string;
      try {
        signature = await withTimeout(
          signMessageAsync({ message }),
          SIGN_TIMEOUT_MS,
          "Wallet signature"
        );
      } catch (signErr: any) {
        const msg = signErr?.message || "";
        if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected") || msg.includes("user rejected")) {
          throw new Error("rejected");
        }
        if (msg.includes("timed out")) {
          throw new Error("Signature request timed out. Please try again.");
        }
        throw new Error(`Wallet signing failed: ${msg.slice(0, 100)}`);
      }

      if (!signature || !signature.startsWith("0x")) {
        throw new Error("Invalid signature returned from wallet");
      }

      const res = await withTimeout(
        apiRequest("POST", "/api/auth/link-wallet", { address, signature, nonce }),
        15000,
        "Link verification"
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Verification failed" }));
        if (res.status === 409) {
          throw new Error("409:" + (errData.message || "already linked"));
        }
        if (res.status === 401) {
          throw new Error(errData.message || "Signature verification failed");
        }
        throw new Error(errData.message || "Failed to link wallet");
      }

      const data = await res.json();

      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);

      haptic("success");
      setLinkError(null);
      toast({
        title: "Wallet Linked",
        description: `${address.slice(0, 6)}...${address.slice(-4)} verified via Alchemy signer.`,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to link wallet";
      haptic("error");

      let userMessage: string;
      if (msg === "rejected" || msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
        userMessage = "Signature rejected. You must sign the message to verify wallet ownership.";
        toast({ title: "Signature Rejected", description: userMessage, variant: "destructive" });
      } else if (msg.includes("409") || msg.includes("already linked")) {
        userMessage = "This wallet is already linked to another account.";
        toast({ title: "Wallet Conflict", description: userMessage, variant: "destructive" });
      } else if (msg.includes("timed out")) {
        userMessage = msg;
        toast({ title: "Request Timed Out", description: userMessage, variant: "destructive" });
      } else if (msg.includes("nonce") || msg.includes("expired")) {
        userMessage = "Verification nonce expired. Please try again.";
        toast({ title: "Nonce Expired", description: userMessage, variant: "destructive" });
      } else {
        userMessage = msg.length > 120 ? msg.slice(0, 120) + "..." : msg;
        toast({ title: "Wallet Link Failed", description: userMessage, variant: "destructive" });
      }
      setLinkError(userMessage);
    } finally {
      linkingRef.current = false;
      setIsLinkingWallet(false);
    }
  }, [address, isConnected, user, walletLinked, signMessageAsync, toast]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        walletLinked,
        isLinkingWallet,
        linkError,
        login: async (username, password, captchaToken?) => {
          const data = await loginMutation.mutateAsync({ username, password, captchaToken });
          if (data?.mfaRequired) {
            return { mfaToken: data.mfaToken };
          }
        },
        verifyMfa: async (mfaToken, code) => {
          await verifyMfaMutation.mutateAsync({ mfaToken, code });
        },
        loginWithWallet: async (address, signature, nonce) => {
          await loginWithWalletMutation.mutateAsync({ address, signature, nonce });
        },
        linkWallet: doLinkWallet,
        resetLinkState,
        register: async (username, password, captchaToken?) => {
          await registerMutation.mutateAsync({ username, password, captchaToken });
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
