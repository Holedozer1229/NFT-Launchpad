import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, users } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool, db } from "./db";
import { eq } from "drizzle-orm";
import { rateLimit } from "./routes";
import { verifyMessage } from "viem";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

async function findOrCreateOAuthUser(opts: {
  provider: "google" | "apple";
  providerId: string;
  email?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<User> {
  const { provider, providerId, email, displayName, avatarUrl } = opts;

  const lookupFn = provider === "google"
    ? storage.getUserByGoogleId.bind(storage)
    : storage.getUserByAppleId.bind(storage);
  let user = await lookupFn(providerId);
  if (user) return user;

  if (email) {
    user = await storage.getUserByEmail(email);
    if (user) {
      return user;
    }
  }

  const baseUsername = displayName
    ? displayName.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 20)
    : `${provider}_${providerId.slice(0, 8)}`;

  let username = baseUsername;
  let counter = 1;
  while (await storage.getUserByUsername(username)) {
    username = `${baseUsername}_${counter}`;
    counter++;
  }

  const providerIdField = provider === "google" ? "googleId" : "appleId";

  user = await storage.createUser({
    username,
    password: await hashPassword(randomBytes(32).toString("hex")),
    [providerIdField]: providerId,
    email: email || null,
    avatarUrl: avatarUrl || null,
    authProvider: provider,
  });

  await storage.createWallet(user.id, "Main Wallet");
  return user;
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);

  if (!process.env.SESSION_SECRET) {
    const generated = randomBytes(32).toString("hex");
    process.env.SESSION_SECRET = generated;
    console.warn("[Auth] SESSION_SECRET not set — generated ephemeral secret (sessions will not persist across restarts)");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    name: "__skynt_sid",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      pruneSessionInterval: 600,
    }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid credentials" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || null;
            const avatarUrl = profile.photos?.[0]?.value || null;
            const user = await findOrCreateOAuthUser({
              provider: "google",
              providerId: profile.id,
              email,
              displayName: profile.displayName,
              avatarUrl,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
    console.log("[Auth] Google OAuth strategy configured");
  } else {
    console.log("[Auth] Google OAuth not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", rateLimit(60000, 5), async (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        authProvider: "local",
      });

      await storage.createWallet(user.id, "Main Wallet");

      req.login(user, (err: any) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        return res.status(201).json(safeUser);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", rateLimit(60000, 10), (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      req.login(user, async (err: any) => {
        if (err) return next(err);
        
        try {
          const userWallets = await storage.getWalletsByUser(user.id);
          if (userWallets.length === 0) {
            await storage.createWallet(user.id, "Main Wallet");
          }
        } catch (walletErr) {
          console.error("Failed to auto-create wallet on login:", walletErr);
        }

        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.get("/api/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(501).json({ message: "Google authentication is not configured" });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", { failureRedirect: "/auth?error=google_failed" })(req, res, () => {
      res.redirect("/");
    });
  });

  app.post("/api/auth/apple/callback", rateLimit(60000, 10), async (req, res, next) => {
    try {
      const { id_token } = req.body;
      if (!id_token) {
        return res.status(400).json({ message: "Missing id_token" });
      }

      const parts = id_token.split(".");
      if (parts.length !== 3) {
        return res.status(400).json({ message: "Invalid token format" });
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      if (!payload.sub) {
        return res.status(400).json({ message: "Invalid token payload" });
      }

      const user = await findOrCreateOAuthUser({
        provider: "apple",
        providerId: payload.sub,
        email: payload.email || null,
        displayName: payload.email ? payload.email.split("@")[0] : undefined,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
      });
    } catch (error) {
      console.error("Apple auth error:", error);
      next(error);
    }
  });

  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      google: !!process.env.GOOGLE_CLIENT_ID,
      apple: !!process.env.APPLE_CLIENT_ID,
      wallet: true,
      local: true,
    });
  });

  app.get("/api/auth/nonce", async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== "string") {
      return res.status(400).json({ message: "Address is required" });
    }
    const nonce = randomBytes(16).toString("hex");
    const user = await storage.getUserByWalletAddress(address);
    if (user) {
      await storage.updateUserNonce(user.id, nonce);
    }
    res.json({ nonce });
  });

  app.post("/api/auth/wallet", async (req, res, next) => {
    try {
      const { address, signature, nonce } = req.body;
      if (!address || !signature || !nonce) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const message = `Sign this message to authenticate with SKYNT Protocol (Contract: 0x22d3f06afB69e5FCFAa98C20009510dD11aF2517)\nNonce: ${nonce}`;
      
      const isValid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return res.status(401).json({ message: "Invalid signature" });
      }

      if (req.isAuthenticated() && req.user) {
        const existingOwner = await storage.getUserByWalletAddress(address);
        if (existingOwner && existingOwner.id !== req.user.id) {
          return res.status(409).json({ message: "This wallet is already linked to another account" });
        }

        if (!existingOwner || existingOwner.id === req.user.id) {
          await db.update(users)
            .set({ walletAddress: address, authNonce: null })
            .where(eq(users.id, req.user.id));
        }

        const updatedUser = await storage.getUser(req.user.id);
        const { password: _, ...safeUser } = updatedUser!;
        return res.json(safeUser);
      }

      let user = await storage.getUserByWalletAddress(address);
      if (!user) {
        user = await storage.createUser({
          username: `wallet_${address.slice(2, 8)}`,
          password: await hashPassword(randomBytes(32).toString("hex")),
          walletAddress: address,
          authNonce: null,
          authProvider: "wallet",
        });
        await storage.createWallet(user.id, "Primary Wallet");
      } else {
        if (user.authNonce !== nonce) {
          return res.status(401).json({ message: "Invalid or expired nonce" });
        }
        await storage.updateUserNonce(user.id, null);
      }

      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user!;
        res.json(safeUser);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/link-wallet", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Must be logged in to link a wallet" });
      }

      const { address } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ message: "Wallet address is required" });
      }

      const normalized = address.trim();
      if (!/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(normalized)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }

      const existingOwner = await storage.getUserByWalletAddress(normalized);
      if (existingOwner && existingOwner.id !== req.user.id) {
        return res.status(409).json({ message: "This wallet is already linked to another account" });
      }

      await db.update(users)
        .set({ walletAddress: normalized })
        .where(eq(users.id, req.user.id));

      const updatedUser = await storage.getUser(req.user.id);
      const { password: _, ...safeUser } = updatedUser!;
      res.json(safeUser);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    req.logout((err: any) => {
      if (err) return next(err);
      if (userId) {
        try {
          const { stopMining } = require("./background-miner");
          stopMining(userId);
        } catch {}
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password: _, ...safeUser } = req.user as User;
    return res.json(safeUser);
  });
}
