import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = localStorage.getItem("skynt_jwt");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function setJwtTokens(token: string, refreshToken: string) {
  localStorage.setItem("skynt_jwt", token);
  localStorage.setItem("skynt_refresh", refreshToken);
}

export function clearJwtTokens() {
  localStorage.removeItem("skynt_jwt");
  localStorage.removeItem("skynt_refresh");
}

export function getJwtToken(): string | null {
  return localStorage.getItem("skynt_jwt");
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem("skynt_refresh");
  if (!refreshToken) return false;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearJwtTokens();
        return false;
      }

      const data = await res.json();
      if (data.token && data.refreshToken) {
        setJwtTokens(data.token, data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = getAuthHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && url !== "/api/auth/token/refresh") {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = getAuthHeaders(data ? { "Content-Type": "application/json" } : {});
      const retryRes = await fetch(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      await throwIfResNotOk(retryRes);
      return retryRes;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = getAuthHeaders();
    const url = queryKey.join("/") as string;
    let res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (res.status === 401 && url !== "/api/user") {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(url, {
          credentials: "include",
          headers: getAuthHeaders(),
        });
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.message?.startsWith("401") || error?.message?.startsWith("403")) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: false,
    },
  },
});
