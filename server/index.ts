import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { startEngine } from "./iit-engine";
import { startP2PLedger } from "./p2p-ledger";
import { startP2PNetwork } from "./p2p-network";
import { startTreasuryYieldEngine } from "./treasury-yield";
import { startDysonEvolution } from "./dyson-sphere-miner";
import { startBtcZkDaemon } from "./btc-zk-daemon";
import { startSelfFundSentinel } from "./self-fund-gas";
import { startPriceDriver } from "./skynt-price-driver";
import { pool } from "./db";
import { isEngineConfigured } from "./alchemy-engine";

const app = express();

app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

const ALLOWED_ORIGINS = new Set([
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "",
  process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "",
  process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "",
  process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : "",
].filter(Boolean));

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (process.env.NODE_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (origin) {
    if (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".replit.app") || origin.endsWith(".replit.dev") || origin.endsWith(".repl.co")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();

  const contentType = req.headers["content-type"];
  const xRequested = req.headers["x-requested-with"];
  const origin = req.headers["origin"];
  const referer = req.headers["referer"];

  if (contentType && contentType.includes("application/json")) return next();
  if (contentType && contentType.includes("application/x-www-form-urlencoded")) return next();
  if (xRequested === "XMLHttpRequest") return next();
  if (origin || referer) return next();
  if (process.env.NODE_ENV !== "production") return next();

  return res.status(403).json({ message: "Forbidden" });
});

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const dbResult = await pool.query("SELECT 1");
    const dbOk = !!dbResult.rows.length;

    const status = {
      status: dbOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbOk ? "connected" : "disconnected",
        alchemy: isEngineConfigured() ? "configured" : "not_configured",
        treasury: !!process.env.TREASURY_PRIVATE_KEY ? "configured" : "not_configured",
      },
    };

    res.status(dbOk ? 200 : 503).json(status);
  } catch (err: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === "production" ? "Service unavailable" : err.message,
    });
  }
});

const missingSecrets = ["JWT_SECRET", "SESSION_SECRET"].filter(k => !process.env[k]);
if (missingSecrets.length > 0) {
  if (process.env.NODE_ENV === "production") {
    console.error(`[FATAL] Missing required secrets: ${missingSecrets.join(", ")}. Server will not start.`);
    process.exit(1);
  } else {
    console.warn(`[Security Warning] Missing secrets: ${missingSecrets.join(", ")} — ephemeral values will be generated. Sessions will not persist across restarts. Set these as environment secrets for stable auth.`);
  }
}

setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > 200 ? body.slice(0, 200) + "…" : body}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const httpServer = await registerRoutes(app);

  await seedDatabase();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (process.env.NODE_ENV !== "production") {
      console.error("Internal Server Error:", err);
    } else {
      console.error(`[ERROR] ${status}: ${message}`);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message: process.env.NODE_ENV === "production" ? "Internal Server Error" : message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  if (process.env.NODE_ENV === "production" && !process.env.ALCHEMY_API_KEY) {
    console.error("[FATAL] Missing required secret for production: ALCHEMY_API_KEY");
    process.exit(1);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      log(`environment: ${process.env.NODE_ENV || "development"}`);
      startEngine();
      startP2PLedger();
      startP2PNetwork();
      startTreasuryYieldEngine();
      startDysonEvolution();
      startBtcZkDaemon();
      startSelfFundSentinel();
      startPriceDriver();
      // Vault auto-init check
      if (process.env.TREASURY_PRIVATE_KEY) {
        log("[Vault] TREASURY_PRIVATE_KEY detected — engine auto-initialized for mainnet transactions");
        log("[Vault] Auto-payout chain: Ethereum Mainnet | SKYNT rewards will transmit on-chain");
      } else {
        log("[Vault] TREASURY_PRIVATE_KEY not configured — on-chain transactions will be rejected until the secret is set");
      }
    },
  );

  let shuttingDown = false;
  async function gracefulShutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} received — shutting down gracefully`, "server");

    httpServer.close(() => {
      log("HTTP server closed", "server");
    });

    try {
      await pool.end();
      log("Database pool closed", "server");
    } catch (err: any) {
      console.error("[server] Error closing database pool:", err.message);
    }

    setTimeout(() => {
      console.error("[server] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
