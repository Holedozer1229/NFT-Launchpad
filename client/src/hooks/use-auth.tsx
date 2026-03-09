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
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string, captchaToken?: string) => Promise<void>;
  loginWithWallet: (address: string, signature: string, nonce: string) => Promise<void>;
  linkWallet: () => Promise<void>;
  resetLinkState: () => void;
  register: (username: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  walletLinked: boolean;
  isLinkingWallet: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const linkingRef = useRef(false);

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
  }, []);

  const doLinkWallet = useCallback(async () => {
    if (linkingRef.current || !address || !isConnected || !user) return;
    if (walletLinked) return;

    linkingRef.current = true;
    setIsLinkingWallet(true);
    try {
      const nonceRes = await apiRequest("POST", "/api/auth/link-wallet/nonce", { address });
      const { nonce } = await nonceRes.json();

      const message = `SKYNT Protocol — Link Wallet\nAccount: ${user.username}\nWallet: ${address}\nNonce: ${nonce}`;

      const signature = await signMessageAsync({ message });

      const res = await apiRequest("POST", "/api/auth/link-wallet", {
        address,
        signature,
        nonce,
      });
      const data = await res.json();

      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);

      haptic("success");
      toast({
        title: "Wallet Linked",
        description: `${address.slice(0, 6)}...${address.slice(-4)} verified and linked to your account.`,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to link wallet";
      haptic("error");
      if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
        toast({
          title: "Signature Rejected",
          description: "You must sign the verification message to link your wallet.",
          variant: "destructive",
        });
      } else if (msg.includes("409") || msg.includes("already linked")) {
        toast({
          title: "Wallet Conflict",
          description: "This wallet is already linked to another account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Wallet Link Failed",
          description: msg,
          variant: "destructive",
        });
      }
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
        login: async (username, password, captchaToken?) => {
          await loginMutation.mutateAsync({ username, password, captchaToken });
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
