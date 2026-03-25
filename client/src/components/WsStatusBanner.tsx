import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

type WsStatus = "connected" | "reconnecting" | "disconnected";

export function WsStatusBanner() {
  const [status, setStatus] = useState<WsStatus>("connected");
  const [attempt, setAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let backoff = 1000;

    function connect() {
      if (!mountedRef.current) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        setAttempt(0);
        backoff = 1000;
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus("reconnecting");
        setAttempt(a => a + 1);
        retryRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          backoff = Math.min(backoff * 1.5, 15000);
          connect();
        }, backoff);
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  if (status === "connected") return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono transition-all ${
      status === "reconnecting"
        ? "bg-yellow-500/20 border-b border-yellow-500/30 text-yellow-300"
        : "bg-red-500/20 border-b border-red-500/30 text-red-300"
    }`}>
      {status === "reconnecting" ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          Reconnecting to live feed… (attempt {attempt})
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          Live connection lost — data may be stale
        </>
      )}
    </div>
  );
}
