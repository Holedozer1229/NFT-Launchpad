import { launches, miners, users, wallets, walletTransactions, type Launch, type InsertLaunch, type Miner, type InsertMiner, type User, type InsertUser, type Wallet, type InsertWallet, type WalletTransaction, type InsertWalletTransaction } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateWalletAddress(): string {
  return "0x" + randomBytes(20).toString("hex");
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getLaunches(): Promise<Launch[]>;
  getLaunch(id: number): Promise<Launch | undefined>;
  createLaunch(launch: InsertLaunch): Promise<Launch>;
  updateMintCount(id: number, count: number): Promise<void>;
  
  getMiner(walletAddress: string): Promise<Miner | undefined>;
  upsertMiner(miner: InsertMiner): Promise<Miner>;
  updateMinerStats(walletAddress: string, hashRate: number, shards: number): Promise<void>;

  createWallet(userId: number, name?: string): Promise<Wallet>;
  getWalletsByUser(userId: number): Promise<Wallet[]>;
  getWallet(id: number): Promise<Wallet | undefined>;
  updateWalletBalance(id: number, token: string, amount: string): Promise<void>;
  createTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction>;
  getTransactionsByWallet(walletId: number): Promise<WalletTransaction[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

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

  async createWallet(userId: number, name: string = "Main Wallet"): Promise<Wallet> {
    const address = generateWalletAddress();
    const [wallet] = await db.insert(wallets).values({
      userId,
      name,
      address,
      balanceStx: "0",
      balanceSkynt: "1000",
      balanceEth: "0",
    }).returning();
    return wallet;
  }

  async getWalletsByUser(userId: number): Promise<Wallet[]> {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet;
  }

  async updateWalletBalance(id: number, token: string, amount: string): Promise<void> {
    const field = token === "STX" ? "balanceStx" : token === "ETH" ? "balanceEth" : "balanceSkynt";
    await db.update(wallets).set({ [field]: amount }).where(eq(wallets.id, id));
  }

  async createTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction> {
    const [transaction] = await db.insert(walletTransactions).values(tx).returning();
    return transaction;
  }

  async getTransactionsByWallet(walletId: number): Promise<WalletTransaction[]> {
    return await db.select().from(walletTransactions).where(eq(walletTransactions.walletId, walletId)).orderBy(desc(walletTransactions.createdAt));
  }
}

export const storage = new DatabaseStorage();
