import { launches, miners, users, wallets, walletTransactions, nfts, bridgeTransactions, guardians, yieldStrategies, contractDeployments, gameScores, marketplaceListings, type Launch, type InsertLaunch, type Miner, type InsertMiner, type User, type InsertUser, type Wallet, type InsertWallet, type WalletTransaction, type InsertWalletTransaction, type Nft, type InsertNft, type BridgeTransaction, type InsertBridgeTransaction, type Guardian, type InsertGuardian, type YieldStrategy, type InsertYieldStrategy, type ContractDeployment, type InsertContractDeployment, type GameScore, type InsertGameScore, type MarketplaceListing, type InsertMarketplaceListing } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
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

  getNfts(): Promise<Nft[]>;
  getNft(id: number): Promise<Nft | undefined>;
  createNft(nft: InsertNft): Promise<Nft>;
  updateNftStatus(id: number, status: string): Promise<void>;
  updateNftOpenSea(id: number, openseaUrl: string | null, openseaStatus: string, openseaListingId: string | null): Promise<void>;

  getBridgeTransactions(): Promise<BridgeTransaction[]>;
  createBridgeTransaction(tx: InsertBridgeTransaction): Promise<BridgeTransaction>;
  updateBridgeStatus(id: number, status: string, signatures: string): Promise<void>;

  getGuardians(): Promise<Guardian[]>;
  createGuardian(guardian: InsertGuardian): Promise<Guardian>;
  updateGuardianStatus(guardianIndex: number, status: string): Promise<void>;

  getYieldStrategies(): Promise<YieldStrategy[]>;
  createYieldStrategy(strategy: InsertYieldStrategy): Promise<YieldStrategy>;
  updateYieldStrategy(strategyId: string, tvl: string, totalStaked: string): Promise<void>;

  getDeploymentsByWallet(walletAddress: string): Promise<ContractDeployment[]>;
  getDeploymentsByWalletId(walletId: number): Promise<ContractDeployment[]>;
  createDeployment(deployment: InsertContractDeployment): Promise<ContractDeployment>;

  createGameScore(score: InsertGameScore): Promise<GameScore>;
  getLeaderboard(limit?: number): Promise<GameScore[]>;
  getGameScoresByUser(userId: number): Promise<GameScore[]>;
  claimGameReward(scoreId: number, userId: number): Promise<GameScore | undefined>;

  getMarketplaceListings(chain?: string, status?: string): Promise<MarketplaceListing[]>;
  getMarketplaceListing(id: number): Promise<MarketplaceListing | undefined>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  buyMarketplaceListing(id: number, buyerId: number, buyerUsername: string): Promise<MarketplaceListing | undefined>;
  cancelMarketplaceListing(id: number, sellerId: number): Promise<MarketplaceListing | undefined>;
  getMarketplaceListingsBySeller(sellerId: number): Promise<MarketplaceListing[]>;
  executeMarketplacePurchase(listingId: number, buyerId: number, buyerUsername: string): Promise<{ success: boolean; error?: string; listing?: MarketplaceListing; txHash?: string }>;
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

  async getNfts(): Promise<Nft[]> {
    return await db.select().from(nfts).orderBy(desc(nfts.id));
  }

  async getNft(id: number): Promise<Nft | undefined> {
    const [nft] = await db.select().from(nfts).where(eq(nfts.id, id));
    return nft;
  }

  async createNft(insertNft: InsertNft): Promise<Nft> {
    const [nft] = await db.insert(nfts).values(insertNft).returning();
    return nft;
  }

  async updateNftStatus(id: number, status: string): Promise<void> {
    await db.update(nfts).set({ status }).where(eq(nfts.id, id));
  }

  async updateNftOpenSea(id: number, openseaUrl: string | null, openseaStatus: string, openseaListingId: string | null): Promise<void> {
    await db.update(nfts).set({ openseaUrl, openseaStatus, openseaListingId }).where(eq(nfts.id, id));
  }

  async getBridgeTransactions(): Promise<BridgeTransaction[]> {
    return await db.select().from(bridgeTransactions).orderBy(desc(bridgeTransactions.createdAt));
  }

  async createBridgeTransaction(tx: InsertBridgeTransaction): Promise<BridgeTransaction> {
    const [btx] = await db.insert(bridgeTransactions).values(tx).returning();
    return btx;
  }

  async updateBridgeStatus(id: number, status: string, signatures: string): Promise<void> {
    await db.update(bridgeTransactions).set({ status, signatures }).where(eq(bridgeTransactions.id, id));
  }

  async getGuardians(): Promise<Guardian[]> {
    return await db.select().from(guardians).orderBy(guardians.guardianIndex);
  }

  async createGuardian(guardian: InsertGuardian): Promise<Guardian> {
    const [g] = await db.insert(guardians).values(guardian).returning();
    return g;
  }

  async updateGuardianStatus(guardianIndex: number, status: string): Promise<void> {
    await db.update(guardians).set({ status, lastSignature: new Date() }).where(eq(guardians.guardianIndex, guardianIndex));
  }

  async getYieldStrategies(): Promise<YieldStrategy[]> {
    return await db.select().from(yieldStrategies);
  }

  async createYieldStrategy(strategy: InsertYieldStrategy): Promise<YieldStrategy> {
    const [s] = await db.insert(yieldStrategies).values(strategy).returning();
    return s;
  }

  async updateYieldStrategy(strategyId: string, tvl: string, totalStaked: string): Promise<void> {
    await db.update(yieldStrategies).set({ tvl, totalStaked }).where(eq(yieldStrategies.strategyId, strategyId));
  }

  async getDeploymentsByWallet(walletAddress: string): Promise<ContractDeployment[]> {
    return await db.select().from(contractDeployments).where(eq(contractDeployments.walletAddress, walletAddress)).orderBy(desc(contractDeployments.createdAt));
  }

  async getDeploymentsByWalletId(walletId: number): Promise<ContractDeployment[]> {
    return await db.select().from(contractDeployments).where(eq(contractDeployments.walletId, walletId)).orderBy(desc(contractDeployments.createdAt));
  }

  async createDeployment(deployment: InsertContractDeployment): Promise<ContractDeployment> {
    const [d] = await db.insert(contractDeployments).values(deployment).returning();
    return d;
  }

  async createGameScore(score: InsertGameScore): Promise<GameScore> {
    const [s] = await db.insert(gameScores).values(score).returning();
    return s;
  }

  async getLeaderboard(limit: number = 20): Promise<GameScore[]> {
    return await db.select().from(gameScores).orderBy(desc(gameScores.score)).limit(limit);
  }

  async getGameScoresByUser(userId: number): Promise<GameScore[]> {
    return await db.select().from(gameScores).where(eq(gameScores.userId, userId)).orderBy(desc(gameScores.score));
  }

  async claimGameReward(scoreId: number, userId: number): Promise<GameScore | undefined> {
    const [score] = await db.select().from(gameScores).where(eq(gameScores.id, scoreId));
    if (!score || score.userId !== userId || score.claimed) return undefined;

    let userWallets = await this.getWalletsByUser(userId);
    if (userWallets.length === 0) {
      await this.createWallet(userId, "Main Wallet");
      userWallets = await this.getWalletsByUser(userId);
    }
    if (userWallets.length === 0) return undefined;

    const wallet = userWallets[0];
    const currentBalance = parseFloat(wallet.balanceSkynt);
    const reward = parseFloat(score.skyntEarned);
    await this.updateWalletBalance(wallet.id, "SKYNT", (currentBalance + reward).toString());
    await this.createTransaction({
      walletId: wallet.id,
      type: "reward",
      fromAddress: "0x0000000000000000000000000000000000000000",
      toAddress: wallet.address,
      amount: score.skyntEarned,
      token: "SKYNT",
      status: "completed",
      txHash: "0x" + randomBytes(32).toString("hex"),
    });

    const [updated] = await db.update(gameScores).set({ claimed: true }).where(eq(gameScores.id, scoreId)).returning();
    return updated;
  }

  async getMarketplaceListings(chain?: string, status?: string): Promise<MarketplaceListing[]> {
    const conditions = [];
    if (chain && chain !== "all") conditions.push(eq(marketplaceListings.chain, chain));
    if (status && status !== "all") conditions.push(eq(marketplaceListings.status, status));
    if (conditions.length > 0) {
      return await db.select().from(marketplaceListings).where(and(...conditions)).orderBy(desc(marketplaceListings.createdAt));
    }
    return await db.select().from(marketplaceListings).orderBy(desc(marketplaceListings.createdAt));
  }

  async getMarketplaceListing(id: number): Promise<MarketplaceListing | undefined> {
    const [listing] = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id));
    return listing;
  }

  async createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const [created] = await db.insert(marketplaceListings).values(listing).returning();
    return created;
  }

  async buyMarketplaceListing(id: number, buyerId: number, buyerUsername: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id));
    if (!listing || listing.status !== "active" || listing.sellerId === buyerId) return undefined;
    const [updated] = await db.update(marketplaceListings)
      .set({ status: "sold", buyerId, buyerUsername, soldAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return updated;
  }

  async cancelMarketplaceListing(id: number, sellerId: number): Promise<MarketplaceListing | undefined> {
    const [listing] = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id));
    if (!listing || listing.sellerId !== sellerId || listing.status !== "active") return undefined;
    const [updated] = await db.update(marketplaceListings)
      .set({ status: "cancelled" })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return updated;
  }

  async getMarketplaceListingsBySeller(sellerId: number): Promise<MarketplaceListing[]> {
    return await db.select().from(marketplaceListings).where(eq(marketplaceListings.sellerId, sellerId)).orderBy(desc(marketplaceListings.createdAt));
  }

  async executeMarketplacePurchase(listingId: number, buyerId: number, buyerUsername: string): Promise<{ success: boolean; error?: string; listing?: MarketplaceListing; txHash?: string }> {
    return await db.transaction(async (tx) => {
      const [listing] = await tx.select().from(marketplaceListings).where(eq(marketplaceListings.id, listingId));
      if (!listing) return { success: false, error: "Listing not found" };
      if (listing.status !== "active") return { success: false, error: "Listing is no longer active" };
      if (listing.sellerId === buyerId) return { success: false, error: "Cannot buy your own listing" };

      const buyerWalletList = await tx.select().from(wallets).where(eq(wallets.userId, buyerId));
      if (buyerWalletList.length === 0) return { success: false, error: "Create a wallet first" };
      const buyerWallet = buyerWalletList[0];

      const price = parseFloat(listing.price);
      if (!Number.isFinite(price) || price <= 0) return { success: false, error: "Invalid listing price" };

      const currency = listing.currency || "ETH";
      const balanceField = currency === "STX" ? "balanceStx" as const : currency === "SKYNT" ? "balanceSkynt" as const : "balanceEth" as const;
      const buyerBalance = parseFloat(buyerWallet[balanceField]);
      if (buyerBalance < price) return { success: false, error: `Insufficient ${currency} balance` };

      await tx.update(wallets).set({ [balanceField]: (buyerBalance - price).toString() }).where(eq(wallets.id, buyerWallet.id));

      const sellerWalletList = await tx.select().from(wallets).where(eq(wallets.userId, listing.sellerId));
      if (sellerWalletList.length > 0) {
        const sellerWallet = sellerWalletList[0];
        const sellerBalance = parseFloat(sellerWallet[balanceField]);
        await tx.update(wallets).set({ [balanceField]: (sellerBalance + price).toString() }).where(eq(wallets.id, sellerWallet.id));
      }

      const txHash = "0x" + randomBytes(32).toString("hex");
      await tx.insert(walletTransactions).values({
        walletId: buyerWallet.id,
        type: "nft_purchase",
        toAddress: listing.contractAddress || "0x0000000000000000000000000000000000000000",
        fromAddress: buyerWallet.address,
        amount: listing.price,
        token: currency,
        status: "completed",
        txHash,
      });

      const [updated] = await tx.update(marketplaceListings)
        .set({ status: "sold", buyerId, buyerUsername, soldAt: new Date() })
        .where(eq(marketplaceListings.id, listingId))
        .returning();

      if (listing.nftId) {
        await tx.update(nfts).set({ status: "minted" }).where(eq(nfts.id, listing.nftId));
      }

      return { success: true, listing: updated, txHash };
    });
  }
}

export const storage = new DatabaseStorage();
