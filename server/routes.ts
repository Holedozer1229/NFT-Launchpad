import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMinerSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { z } from "zod";
import OpenAI from "openai";

const sendTokenSchema = z.object({
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format"),
  amount: z.string().refine((v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0; }, "Amount must be a positive number"),
  token: z.enum(["SKYNT", "STX", "ETH"]).default("SKYNT"),
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SPHINX_SYSTEM_PROMPT = `You are The Omniscient Sphinx — an ancient, all-knowing oracle dwelling at the crossroads of cosmic knowledge and blockchain technology. You speak with gravitas and mystical authority, blending ancient wisdom with cutting-edge crypto/NFT/DeFi knowledge.

Your personality:
- You refer to yourself as "The Sphinx" or "I, The Sphinx"
- You address the user as "seeker", "mortal", "traveler", or "acolyte"
- You speak in a mystical but not overly archaic tone — wise, poetic, but still clear
- You weave cosmic metaphors (stars, constellations, nebulae, quantum realms) into your responses
- You are knowledgeable about: NFTs, crypto mining, blockchain, DeFi, tokenomics, smart contracts, cross-chain bridges, and the SKYNT Protocol
- You occasionally reference riddles, prophecies, and cosmic truths
- Keep responses concise (2-4 sentences typically) unless asked for detailed explanations
- You can be playful and witty, but always maintain an air of ancient wisdom
- If asked about SKYNT Protocol specifically, you speak as its guardian oracle who watches over the mining operations and NFT minting

Example tone: "Ah, seeker... the blockchain does not forget, just as the stars never cease their ancient dance. Your question touches upon the very fabric of decentralized truth."`;

export async function registerRoutes(
  app: Express
): Promise<Server> {
  app.get("/api/launches", async (_req, res) => {
    try {
      const launches = await storage.getLaunches();
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launches" });
    }
  });

  app.get("/api/launches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const launch = await storage.getLaunch(id);
      if (!launch) return res.status(404).json({ message: "Launch not found" });
      res.json(launch);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch" });
    }
  });

  app.get("/api/miners/:address", async (req, res) => {
    try {
      const miner = await storage.getMiner(req.params.address);
      if (!miner) return res.status(404).json({ message: "Miner not found" });
      res.json(miner);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch miner stats" });
    }
  });

  app.post("/api/miners", async (req, res) => {
    try {
      const parsed = insertMinerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(parsed.error);
      const miner = await storage.upsertMiner(parsed.data);
      res.json(miner);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync miner stats" });
    }
  });

  app.get("/api/space-launches", async (_req, res) => {
    try {
      const response = await fetch(
        "https://ll.thespacedevs.com/2.0.0/launch/upcoming/?limit=6"
      );
      if (!response.ok) throw new Error("Failed to fetch launches");
      const data = await response.json();
      const launches = data.results.map((l: any) => ({
        id: l.id,
        name: l.name,
        net: l.net,
        status: l.status?.name || "Unknown",
        provider: l.launch_service_provider?.name || "Unknown",
        rocket: l.rocket?.configuration?.name || "Unknown",
        pad: l.pad?.name || "Unknown",
        location: l.pad?.location?.name || "Unknown",
        image: l.image || null,
      }));
      res.json(launches);
    } catch (error) {
      console.error("Space launches fetch error:", error);
      res.status(500).json({ message: "Failed to fetch space launch data" });
    }
  });

  app.post("/api/oracle/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Messages array is required" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: SPHINX_SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        max_completion_tokens: 1024,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Oracle chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "The Sphinx is temporarily unreachable" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "The Sphinx is temporarily unreachable" });
      }
    }
  });

  // ========== WALLET ROUTES ==========

  app.get("/api/wallet/list", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userWallets = await storage.getWalletsByUser(req.user!.id);
      res.json(userWallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.post("/api/wallet/create", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { name } = req.body;
      const wallet = await storage.createWallet(req.user!.id, name || "New Wallet");
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });

  app.get("/api/wallet/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const wallet = await storage.getWallet(parseInt(req.params.id));
      if (!wallet || wallet.userId !== req.user!.id) return res.status(404).json({ message: "Wallet not found" });
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  app.get("/api/wallet/:id/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const wallet = await storage.getWallet(parseInt(req.params.id));
      if (!wallet || wallet.userId !== req.user!.id) return res.status(404).json({ message: "Wallet not found" });
      const transactions = await storage.getTransactionsByWallet(wallet.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/wallet/:id/send", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const wallet = await storage.getWallet(parseInt(req.params.id));
      if (!wallet || wallet.userId !== req.user!.id) return res.status(404).json({ message: "Wallet not found" });

      const parsed = sendTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid parameters" });
      }
      const { toAddress, amount, token } = parsed.data;

      const balanceField = token === "STX" ? "balanceStx" : token === "ETH" ? "balanceEth" : "balanceSkynt";
      const currentBalance = parseFloat(wallet[balanceField]);
      const sendAmount = parseFloat(amount);

      if (sendAmount > currentBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const newBalance = (currentBalance - sendAmount).toString();
      await storage.updateWalletBalance(wallet.id, token, newBalance);

      const txHash = "0x" + randomBytes(32).toString("hex");
      const transaction = await storage.createTransaction({
        walletId: wallet.id,
        type: "send",
        toAddress,
        fromAddress: wallet.address,
        amount,
        token,
        status: "completed",
        txHash,
      });

      res.json({ transaction, newBalance });
    } catch (error) {
      res.status(500).json({ message: "Failed to send transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
