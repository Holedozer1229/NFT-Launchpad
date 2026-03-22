import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface ClientMeta {
  ws: WebSocket;
  subscriptions: Set<string>;
  alive: boolean;
  connectedAt: number;
}

class WSHub {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientMeta> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  attach(server: Server): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      const meta: ClientMeta = {
        ws,
        subscriptions: new Set(["*"]),
        alive: true,
        connectedAt: Date.now(),
      };
      this.clients.set(ws, meta);

      try {
        ws.send(JSON.stringify({
          event: "connected",
          data: {
            message: "SKYNT Engine Hub connected",
            clientId: `cli-${Date.now().toString(36)}`,
            serverTime: Date.now(),
          },
          ts: Date.now(),
        }));
      } catch {}

      ws.on("pong", () => {
        const m = this.clients.get(ws);
        if (m) m.alive = true;
      });

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const m = this.clients.get(ws);
          if (!m) return;

          if (msg.type === "ping") {
            try { ws.send(JSON.stringify({ event: "pong", data: {}, ts: Date.now() })); } catch {}
            return;
          }

          if (msg.type === "subscribe" && Array.isArray(msg.events)) {
            m.subscriptions = new Set(msg.events);
            m.subscriptions.add("pong");
            try {
              ws.send(JSON.stringify({ event: "subscribed", data: { events: [...m.subscriptions] }, ts: Date.now() }));
            } catch {}
            return;
          }

          if (msg.type === "subscribe_all") {
            m.subscriptions = new Set(["*"]);
            return;
          }
        } catch {}
      });

      ws.on("close", () => this.clients.delete(ws));
      ws.on("error", () => {
        this.clients.delete(ws);
        try { ws.terminate(); } catch {}
      });
    });

    this.startHeartbeat();
    console.log("[WSHub] WebSocket server attached at /ws");
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [ws, meta] of this.clients) {
        if (!meta.alive) {
          this.clients.delete(ws);
          try { ws.terminate(); } catch {}
          continue;
        }
        meta.alive = false;
        try { ws.ping(); } catch { this.clients.delete(ws); }
      }
    }, 30_000);
  }

  broadcast(event: string, data: Record<string, unknown>): void {
    if (!this.wss || this.clients.size === 0) return;
    const payload = JSON.stringify({ event, data, ts: Date.now() });
    for (const [ws, meta] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const allowed = meta.subscriptions.has("*") || meta.subscriptions.has(event);
      if (!allowed) continue;
      try { ws.send(payload); } catch {}
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  getStats(): { clients: number; uptime: number } {
    return { clients: this.clients.size, uptime: process.uptime() };
  }
}

export const wsHub = new WSHub();
