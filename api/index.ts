/**
 * Vercel Serverless Entry Point
 *
 * Wraps the Express app as a Vercel serverless function.
 * All /api/* requests are routed here by vercel.json.
 * Does NOT call httpServer.listen() — Vercel invokes the handler directly.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { setupAuth } from "../server/auth";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

setupAuth(app);

// Lazy initialization — routes registered once per cold start
let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = registerRoutes(app).then(() => {
      app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        if (!res.headersSent) {
          res.status(status).json({ message });
        }
      });
    });
  }
  return initPromise;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  await init();
  app(req, res);
}
