import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, users } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool, db } from "./db";
import { eq } from "drizzle-orm";
import { rateLimit } from "./routes";
import { getAlchemySigner } from "./alchemy-signer";
import jwt from "jsonwebtoken";
import { generateSync, verifySync, generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || "";
const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

async function verifyCaptcha(token: string): Promise<boolean> {
  if (!HCAPTCHA_SECRET) return true;
  try {
    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `response=${encodeURIComponent(token)}&secret=${encodeURIComponent(HCAPTCHA_SECRET)}`,
    });
    const data = await res.json() as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}

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

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    const generated = randomBytes(64).toString("hex");
    process.env.JWT_SECRET = generated;
    console.warn("[Auth] JWT_SECRET not set — generated ephemeral secret");
  }
  return process.env.JWT_SECRET;
}

function generateToken(user: User): string {
  return jwt.sign(
    { sub: user.id, username: user.username, isAdmin: user.isAdmin },
    getJwtSecret(),
    { expiresIn: "1h", issuer: "skynt-protocol" }
  );
}

function generateRefreshToken(user: User): string {
  return jwt.sign(
    { sub: user.id, type: "refresh" },
    getJwtSecret(),
    { expiresIn: "30d", issuer: "skynt-protocol" }
  );
}

function verifyToken(token: string): jwt.JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { issuer: "skynt-protocol" }) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload || !payload.sub) {
    return next();
  }

  storage.getUser(Number(payload.sub)).then((user) => {
    if (user) {
      (req as any).user = user;
      (req as any).isAuthenticated = () => true;
      (req as any).jwtAuth = true;
    }
    next();
  }).catch((err) => {
    console.error("[Auth] JWT middleware DB lookup failed:", err);
    next();
  });
}

async function seedAdminUser(): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    console.warn("[Auth] ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping admin seed");
    return;
  }

  const existing = await storage.getUserByUsername(adminUsername);
  if (existing) {
    const newHash = await hashPassword(adminPassword);
    await db.update(users).set({ password: newHash, isAdmin: true }).where(eq(users.id, existing.id));
    console.log(`[Auth] Admin user "${adminUsername}" synced with environment credentials`);
    return;
  }

  const user = await storage.createUser({
    username: adminUsername,
    password: await hashPassword(adminPassword),
    isAdmin: true,
    authProvider: "local",
  });
  await storage.createWallet(user.id, "Admin Vault");
  console.log(`[Auth] Admin user "${adminUsername}" created with admin privileges`);
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
      secure: process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT_URL,
      sameSite: process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT_URL ? "strict" : "lax",
      path: "/",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(jwtAuthMiddleware);

  seedAdminUser().catch((err) => {
    console.error("[Auth] Failed to seed admin user:", err);
  });

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

  app.get("/api/auth/captcha-config", (_req, res) => {
    res.json({
      enabled: !!process.env.HCAPTCHA_SITE_KEY,
      siteKey: process.env.HCAPTCHA_SITE_KEY || "",
    });
  });

  app.post("/api/register", rateLimit(60000, 5), async (req, res, next) => {
    try {
      const { username, password, captchaToken } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (HCAPTCHA_SECRET) {
        if (!captchaToken) {
          return res.status(400).json({ message: "Please complete the CAPTCHA" });
        }
        const valid = await verifyCaptcha(captchaToken);
        if (!valid) {
          return res.status(400).json({ message: "CAPTCHA verification failed" });
        }
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
        const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = user;
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        return res.status(201).json({ ...safeUser, token, refreshToken });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", rateLimit(60000, 10), async (req, res, next) => {
    if (HCAPTCHA_SECRET) {
      const { captchaToken } = req.body;
      if (!captchaToken) {
        return res.status(400).json({ message: "Please complete the CAPTCHA" });
      }
      const valid = await verifyCaptcha(captchaToken);
      if (!valid) {
        return res.status(400).json({ message: "CAPTCHA verification failed" });
      }
    }

    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      if (user.mfaEnabled && user.mfaSecret) {
        const mfaToken = jwt.sign(
          { sub: user.id, type: "mfa_challenge" },
          getJwtSecret(),
          { expiresIn: "5m", issuer: "skynt-protocol" }
        );
        return res.status(200).json({ mfaRequired: true, mfaToken });
      }

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

        const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = user;
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        return res.json({ ...safeUser, token, refreshToken });
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
        const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = user;
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

  app.get("/api/auth/nonce", rateLimit(60000, 20), async (req, res) => {
    try {
      const { address } = req.query;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ message: "Address is required" });
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      const nonce = randomBytes(16).toString("hex");
      const user = await storage.getUserByWalletAddress(address);
      if (user) {
        await storage.updateUserNonce(user.id, nonce);
      }
      res.json({ nonce });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate nonce" });
    }
  });

  app.post("/api/auth/wallet", rateLimit(60000, 10), async (req, res, next) => {
    try {
      const { address, signature, nonce } = req.body;
      if (!address || !signature || !nonce) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const addrStr = String(address).trim();
      let sigStr = String(signature).trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addrStr)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      if (!sigStr.startsWith("0x")) {
        sigStr = `0x${sigStr}`;
      }

      const message = `Sign this message to authenticate with SKYNT Protocol (Contract: 0x22d3f06afB69e5FCFAa98C20009510dD11aF2517)\nNonce: ${nonce}`;
      
      const signer = getAlchemySigner();
      const { isValid, recoveredAddress, error: sigError } = await signer.verifySignature(message, sigStr, addrStr);

      if (sigError) {
        console.error("[Auth] Wallet auth signature verification failed:", sigError);
        return res.status(400).json({ message: "Signature verification failed. Please try again." });
      }
      if (!isValid) {
        console.log(`[Auth] Wallet auth signature mismatch. Expected: ${addrStr}, Recovered: ${recoveredAddress}`);
        return res.status(401).json({ message: "Invalid signature" });
      }

      if (req.isAuthenticated() && req.user) {
        const authedUser = req.user as User;
        const existingOwner = await storage.getUserByWalletAddress(addrStr);
        if (existingOwner && existingOwner.id !== authedUser.id) {
          const isAutoWalletAccount = existingOwner.username.startsWith("wallet_") && existingOwner.authProvider === "wallet";
          if (!isAutoWalletAccount) {
            return res.status(409).json({ message: "This wallet is already linked to another account" });
          }
          await db.update(users)
            .set({ walletAddress: null })
            .where(eq(users.id, existingOwner.id));
        }

        await db.update(users)
          .set({ walletAddress: addrStr, authNonce: null })
          .where(eq(users.id, authedUser.id));

        const updatedUser = await storage.getUser(authedUser.id);
        const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = updatedUser!;
        const token = generateToken(updatedUser!);
        const refreshToken = generateRefreshToken(updatedUser!);
        return res.json({ ...safeUser, token, refreshToken });
      }

      let user = await storage.getUserByWalletAddress(addrStr);
      if (!user) {
        user = await storage.createUser({
          username: `wallet_${addrStr.slice(2, 8)}`,
          password: await hashPassword(randomBytes(32).toString("hex")),
          walletAddress: addrStr,
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
        const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = user!;
        const token = generateToken(user!);
        const refreshToken = generateRefreshToken(user!);
        res.json({ ...safeUser, token, refreshToken });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/link-wallet/nonce", rateLimit(60000, 20), async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Must be logged in" });
      }
      const { address } = req.body;
      if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Valid EVM wallet address required" });
      }
      const nonce = randomBytes(16).toString("hex");
      await storage.updateUserNonce(req.user.id, nonce);
      res.json({ nonce });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate link nonce" });
    }
  });

  app.post("/api/auth/link-wallet", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Must be logged in to link a wallet" });
      }

      const { address, signature, nonce } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ message: "Wallet address is required" });
      }

      const normalized = address.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }

      if (!signature || !nonce) {
        return res.status(400).json({ message: "Signature verification required to link wallet" });
      }

      let sigStr = String(signature).trim();
      if (!sigStr.startsWith("0x")) {
        sigStr = `0x${sigStr}`;
      }

      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser || currentUser.authNonce !== nonce) {
        return res.status(401).json({ message: "Invalid or expired nonce. Request a new one." });
      }

      const message = `SKYNT Protocol — Link Wallet\nAccount: ${req.user.username}\nWallet: ${normalized}\nNonce: ${nonce}`;
      const signer = getAlchemySigner();
      const { isValid, recoveredAddress, error: sigError } = await signer.verifySignature(message, sigStr, normalized);

      if (sigError) {
        console.error("[Auth] Link wallet signature verification failed:", sigError);
        return res.status(400).json({ message: "Invalid signature. Please disconnect your wallet and try again." });
      }
      if (!isValid) {
        console.log(`[Auth] Link wallet signature mismatch. Expected: ${normalized.slice(0, 10)}…, Recovered: ${recoveredAddress?.slice(0, 10)}…`);
        return res.status(401).json({ message: "Signature verification failed. You must sign with the wallet you are linking." });
      }

      await storage.updateUserNonce(req.user.id, null);

      const existingOwner = await storage.getUserByWalletAddress(normalized);
      if (existingOwner && existingOwner.id !== req.user.id) {
        const isAutoWalletAccount = existingOwner.username.startsWith("wallet_") && existingOwner.authProvider === "wallet";
        if (!isAutoWalletAccount) {
          return res.status(409).json({ message: "This wallet is already linked to another account" });
        }
        await db.update(users)
          .set({ walletAddress: null })
          .where(eq(users.id, existingOwner.id));
        console.log(`[Auth] Transferred wallet ${normalized.slice(0, 10)}... from auto-account "${existingOwner.username}" (ID: ${existingOwner.id}) to user "${req.user.username}" (ID: ${req.user.id})`);
      }

      await db.update(users)
        .set({ walletAddress: normalized })
        .where(eq(users.id, req.user.id));

      const updatedUser = await storage.getUser(req.user.id);
      const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = updatedUser!;
      const token = generateToken(updatedUser!);
      const refreshToken = generateRefreshToken(updatedUser!);
      console.log(`[Auth] Wallet ${normalized.slice(0, 10)}... securely linked to "${req.user.username}" (ID: ${req.user.id}) via signature verification`);
      res.json({ ...safeUser, token, refreshToken });
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
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = req.user as User;
      return res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/token/refresh", rateLimit(60000, 10), async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }

      const payload = verifyToken(refreshToken);
      if (!payload || !payload.sub || payload.type !== "refresh") {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      const user = await storage.getUser(Number(payload.sub));
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const newToken = generateToken(user);
      const newRefreshToken = generateRefreshToken(user);
      const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = user;
      res.json({ ...safeUser, token: newToken, refreshToken: newRefreshToken });
    } catch {
      res.status(401).json({ message: "Token refresh failed" });
    }
  });

  app.get("/api/auth/token/verify", rateLimit(60000, 30), (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ valid: false, message: "No token provided" });
      }
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ valid: false, message: "Invalid or expired token" });
      }
      res.json({
        valid: true,
        sub: payload.sub,
        username: payload.username,
        isAdmin: payload.isAdmin,
        exp: payload.exp,
        iss: payload.iss,
      });
    } catch (error) {
      res.status(500).json({ message: "Token verification failed" });
    }
  });

  app.post("/api/auth/mfa/verify", rateLimit(60000, 10), async (req, res, next) => {
    try {
      const { mfaToken, code } = req.body;
      if (!mfaToken || !code) {
        return res.status(400).json({ message: "MFA token and code are required" });
      }

      const payload = verifyToken(mfaToken);
      if (!payload || !payload.sub || payload.type !== "mfa_challenge") {
        return res.status(401).json({ message: "Invalid or expired MFA session. Please log in again." });
      }

      const user = await storage.getUser(Number(payload.sub));
      if (!user || !user.mfaSecret) {
        return res.status(401).json({ message: "User not found or MFA not configured" });
      }

      const codeStr = String(code).trim().replace(/\s/g, "");

      let valid = false;

      if (/^\d{6}$/.test(codeStr)) {
        try {
          valid = verifySync({ token: codeStr, secret: user.mfaSecret }).valid;
        } catch {
          valid = false;
        }
      }

      if (!valid && user.mfaBackupCodes) {
        const backupCodes: string[] = JSON.parse(user.mfaBackupCodes);
        const codeIndex = backupCodes.indexOf(codeStr);
        if (codeIndex !== -1) {
          valid = true;
          backupCodes.splice(codeIndex, 1);
          await db.update(users)
            .set({ mfaBackupCodes: JSON.stringify(backupCodes) })
            .where(eq(users.id, user.id));
          console.log(`[Auth] MFA backup code used by user ${user.username} (${backupCodes.length} remaining)`);
        }
      }

      if (!valid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      req.login(user, async (err: any) => {
        if (err) return next(err);

        try {
          const userWallets = await storage.getWalletsByUser(user.id);
          if (userWallets.length === 0) {
            await storage.createWallet(user.id, "Main Wallet");
          }
        } catch (walletErr) {
          console.error("Failed to auto-create wallet on MFA login:", walletErr);
        }

        const { password: _, mfaSecret: _ms, mfaBackupCodes: _mb, ...safeUser } = user;
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        console.log(`[Auth] MFA verification successful for user ${user.username}`);
        return res.json({ ...safeUser, token, refreshToken });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/mfa/setup", rateLimit(60000, 5), async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Must be logged in" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled" });
      }

      const secret = generateSecret();
      const otpAuthUrl = generateURI({ secret, issuer: "SKYNT Protocol", label: `SKYNT Protocol:${user.username}` });

      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

      await db.update(users)
        .set({ mfaSecret: secret })
        .where(eq(users.id, user.id));

      res.json({
        secret,
        qrCode: qrCodeDataUrl,
        otpAuthUrl,
      });
    } catch (error) {
      console.error("[Auth] MFA setup error:", error);
      res.status(500).json({ message: "Failed to initialize MFA setup" });
    }
  });

  app.post("/api/auth/mfa/confirm", rateLimit(60000, 10), async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Must be logged in" });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user || !user.mfaSecret) {
        return res.status(400).json({ message: "MFA setup not initialized. Start setup first." });
      }

      if (user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled" });
      }

      const codeStr = String(code).trim().replace(/\s/g, "");
      const valid = verifySync({ token: codeStr, secret: user.mfaSecret }).valid;

      if (!valid) {
        return res.status(401).json({ message: "Invalid verification code. Please try again." });
      }

      const backupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        backupCodes.push(randomBytes(4).toString("hex"));
      }

      await db.update(users)
        .set({
          mfaEnabled: true,
          mfaBackupCodes: JSON.stringify(backupCodes),
        })
        .where(eq(users.id, user.id));

      console.log(`[Auth] MFA enabled for user ${user.username}`);

      res.json({
        enabled: true,
        backupCodes,
      });
    } catch (error) {
      console.error("[Auth] MFA confirm error:", error);
      res.status(500).json({ message: "Failed to confirm MFA setup" });
    }
  });

  app.post("/api/auth/mfa/disable", rateLimit(60000, 5), async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Must be logged in" });
      }

      const { code, password } = req.body;
      if (!password) {
        return res.status(400).json({ message: "Password is required to disable MFA" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is not enabled" });
      }

      const passwordValid = await comparePasswords(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid password" });
      }

      if (code && user.mfaSecret) {
        const codeStr = String(code).trim().replace(/\s/g, "");
        const codeValid = verifySync({ token: codeStr, secret: user.mfaSecret }).valid;
        if (!codeValid) {
          return res.status(401).json({ message: "Invalid verification code" });
        }
      }

      await db.update(users)
        .set({
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
        })
        .where(eq(users.id, user.id));

      console.log(`[Auth] MFA disabled for user ${user.username}`);

      res.json({ disabled: true });
    } catch (error) {
      console.error("[Auth] MFA disable error:", error);
      res.status(500).json({ message: "Failed to disable MFA" });
    }
  });

  app.get("/api/auth/mfa/status", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Must be logged in" });
    }
    const user = req.user as User;
    res.json({
      enabled: user.mfaEnabled,
      hasBackupCodes: !!(user.mfaBackupCodes && JSON.parse(user.mfaBackupCodes).length > 0),
      backupCodesRemaining: user.mfaBackupCodes ? JSON.parse(user.mfaBackupCodes).length : 0,
    });
  });
}
