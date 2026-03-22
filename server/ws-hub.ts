import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

class WSHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  attach(server: Server): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      try {
        ws.send(JSON.stringify({
          event: "connected",
          data: { message: "SKYNT Engine Hub connected" },
          ts: Date.now(),
        }));
      } catch {}

      ws.on("close", () => this.clients.delete(ws));
      ws.on("error", () => {
        this.clients.delete(ws);
        try { ws.terminate(); } catch {}
      });
    });

    console.log("[WSHub] WebSocket server attached at /ws");
  }

  broadcast(event: string, data: Record<string, unknown>): void {
    if (!this.wss || this.clients.size === 0) return;
    const payload = JSON.stringify({ event, data, ts: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(payload); } catch {}
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const wsHub = new WSHub();
