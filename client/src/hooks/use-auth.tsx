import { createContext, ReactNode, useContext, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, setJwtTokens, clearJwtTokens, getJwtToken } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";

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
  linkWallet: (address: string) => Promise<void>;
  resetLinkState: () => void;
  register: (username: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  walletLinked: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

const MAX_AUTO_LINK_RETRIES = 3;
const RETRY_DELAYS = [500, 2000, 5000];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const linkingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLinkedAddressRef = useRef<string | null>(null);

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
    retryCountRef.current = 0;
    linkingRef.current = false;
    lastLinkedAddressRef.current = null;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const doLinkWallet = useCallback(async (addr: string) => {
    if (linkingRef.current) return;
    linkingRef.current = true;
    try {
      const res = await apiRequest("POST", "/api/auth/link-wallet", { address: addr });
      const data = await res.json();
      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
      }
      const { token: _t, refreshToken: _rt, ...userData } = data;
      queryClient.setQueryData(["/api/user"], userData);
      lastLinkedAddressRef.current = addr.toLowerCase();
      retryCountRef.current = 0;
    } catch (err: any) {
      const msg = err?.message || "Failed to link wallet";
      const is409 = msg.includes("409") || msg.includes("already linked");
      if (is409) {
        retryCountRef.current = MAX_AUTO_LINK_RETRIES;
      }
      throw err;
    } finally {
      linkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (
      !isConnected ||
      !address ||
      !user ||
      walletLinked ||
      linkingRef.current
    ) return;

    if (lastLinkedAddressRef.current === address.toLowerCase()) return;

    if (retryCountRef.current >= MAX_AUTO_LINK_RETRIES) return;

    const delay = RETRY_DELAYS[retryCountRef.current] || 500;

    retryTimerRef.current = setTimeout(() => {
      if (linkingRef.current || walletLinked) return;

      doLinkWallet(address).catch((err) => {
        retryCountRef.current++;
        if (retryCountRef.current >= MAX_AUTO_LINK_RETRIES) {
          const msg = err?.message || "";
          const is409 = msg.includes("409") || msg.includes("already linked");
          if (is409) {
            toast({
              title: "Wallet Conflict",
              description: "This wallet is already linked to another account.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Wallet Link Failed",
              description: "Could not auto-link wallet. Try manually from the Wallet page.",
              variant: "destructive",
            });
          }
        }
      });
    }, delay);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [isConnected, address, user?.id, user?.walletAddress, walletLinked, doLinkWallet, toast]);

  useEffect(() => {
    retryCountRef.current = 0;
    lastLinkedAddressRef.current = null;
    linkingRef.current = false;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [address]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        walletLinked,
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
