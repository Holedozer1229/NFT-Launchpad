import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMinerSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}
