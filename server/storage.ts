import { launches, miners, type Launch, type InsertLaunch, type Miner, type InsertMiner } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getLaunches(): Promise<Launch[]>;
  getLaunch(id: number): Promise<Launch | undefined>;
  createLaunch(launch: InsertLaunch): Promise<Launch>;
  updateMintCount(id: number, count: number): Promise<void>;
  
  getMiner(walletAddress: string): Promise<Miner | undefined>;
  upsertMiner(miner: InsertMiner): Promise<Miner>;
  updateMinerStats(walletAddress: string, hashRate: number, shards: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getLaunches(): Promise<Launch[]> {
    return await db.select().from(launches);
  }

  async getLaunch(id: number): Promise<Launch | undefined> {
    const [launch] = await db.select().from(launches).where(eq(launches.id, id));
    return launch;
  }

  async createLaunch(insertLaunch: InsertLaunch): Promise<Launch> {
    const [launch] = await db.insert(launches).values(insertLaunch).returning();
    return launch;
  }

  async updateMintCount(id: number, count: number): Promise<void> {
    await db.update(launches)
      .set({ minted: count })
      .where(eq(launches.id, id));
  }

  async getMiner(walletAddress: string): Promise<Miner | undefined> {
    const [miner] = await db.select().from(miners).where(eq(miners.walletAddress, walletAddress));
    return miner;
  }

  async upsertMiner(insertMiner: InsertMiner): Promise<Miner> {
    const existing = await this.getMiner(insertMiner.walletAddress);
    if (existing) {
      const [updated] = await db.update(miners)
        .set(insertMiner)
        .where(eq(miners.walletAddress, insertMiner.walletAddress))
        .returning();
      return updated;
    }
    const [newMiner] = await db.insert(miners).values(insertMiner).returning();
    return newMiner;
  }

  async updateMinerStats(walletAddress: string, hashRate: number, shards: number): Promise<void> {
    await db.update(miners)
      .set({ hashRate, shards, lastUpdate: new Date() })
      .where(eq(miners.walletAddress, walletAddress));
  }
}

export const storage = new DatabaseStorage();
