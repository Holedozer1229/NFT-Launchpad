import { createContext, ReactNode, useContext, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, setJwtTokens, clearJwtTokens } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAccount } from "wagmi";

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
  login: (username: string, password: string) => Promise<void>;
  loginWithWallet: (address: string, signature: string, nonce: string) => Promise<void>;
  linkWallet: (address: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  walletLinked: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { address, isConnected } = useAccount();
  const linkingRef = useRef(false);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
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
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", { username, password });
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

  const linkWalletMutation = useMutation({
    mutationFn: async ({ address: addr }: { address: string }) => {
      const res = await apiRequest("POST", "/api/auth/link-wallet", { address: addr });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/register", { username, password });
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

  const doLinkWallet = useCallback(async (addr: string) => {
    if (linkingRef.current) return;
    linkingRef.current = true;
    try {
      await linkWalletMutation.mutateAsync({ address: addr });
    } finally {
      linkingRef.current = false;
    }
  }, [linkWalletMutation]);

  useEffect(() => {
    if (isConnected && address && user && !walletLinked && !linkingRef.current) {
      doLinkWallet(address);
    }
  }, [isConnected, address, user?.id, walletLinked]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        walletLinked,
        login: async (username, password) => {
          await loginMutation.mutateAsync({ username, password });
        },
        loginWithWallet: async (address, signature, nonce) => {
          await loginWithWalletMutation.mutateAsync({ address, signature, nonce });
        },
        linkWallet: doLinkWallet,
        register: async (username, password) => {
          await registerMutation.mutateAsync({ username, password });
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
