import { useState, useEffect, useRef, useCallback } from "react";

export interface EngineEvent {
  event: string;
  data: Record<string, unknown>;
  ts: number;
}

const MAX_EVENTS = 100;
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function useEngineStream() {
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(BASE_RECONNECT_MS);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const listenersRef = useRef<Map<string, Set<(data: Record<string, unknown>) => void>>>(new Map());

  const connect = useCallback(() => {
    if (unmounted.current) return;
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      setConnected(true);
      reconnectDelay.current = BASE_RECONNECT_MS;
    };

    ws.onmessage = (evt) => {
      try {
        const parsed: EngineEvent = JSON.parse(evt.data as string);
        if (parsed.event === "connected") return;

        setEvents((prev) => {
          const next = [parsed, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });

        const callbacks = listenersRef.current.get(parsed.event);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try { cb(parsed.data); } catch {}
          });
        }
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (unmounted.current) return;
      setConnected(false);
      wsRef.current = null;
      const delay = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_MS);
      reconnectDelay.current = delay;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [connect]);

  const on = useCallback((event: string, cb: (data: Record<string, unknown>) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(cb);
    return () => {
      listenersRef.current.get(event)?.delete(cb);
    };
  }, []);

  return { events, connected, on };
}
