import { launches, miners, users, wallets, walletTransactions, nfts, bridgeTransactions, guardians, yieldStrategies, yieldPositions, contractDeployments, gameScores, marketplaceListings, powChallenges, powSubmissions, zkWormholes, zkWormholeTransfers, rarityCertificates, rocketBabeModels, airdrops, airdropClaims, kycSubmissions, type RarityCertificate, type InsertRarityCertificate, type ZkWormhole, type InsertZkWormhole, type ZkWormholeTransfer, type InsertZkWormholeTransfer, type Launch, type InsertLaunch, type Miner, type InsertMiner, type User, type InsertUser, type Wallet, type InsertWallet, type WalletTransaction, type InsertWalletTransaction, type Nft, type InsertNft, type BridgeTransaction, type InsertBridgeTransaction, type Guardian, type InsertGuardian, type YieldStrategy, type InsertYieldStrategy, type YieldPosition, type InsertYieldPosition, type ContractDeployment, type InsertContractDeployment, type GameScore, type InsertGameScore, type MarketplaceListing, type InsertMarketplaceListing, type PowChallenge, type InsertPowChallenge, type PowSubmission, type InsertPowSubmission, type RocketBabeModel, type InsertRocketBabeModel, type Airdrop, type InsertAirdrop, type AirdropClaim, type InsertAirdropClaim, type KycSubmission, type InsertKycSubmission } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateWalletAddress(): string {
  return "0x" + randomBytes(20).toString("hex");
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByWalletAddress(address: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserNonce(id: number, nonce: string | null): Promise<void>;
  createUser(user: InsertUser): Promise<User>;

  getLaunches(): Promise<Launch[]>;
  getLaunch(id: number): Promise<Launch | undefined>;
  createLaunch(launch: InsertLaunch): Promise<Launch>;
  updateMintCount(id: number, count: number): Promise<void>;
  
  getMiner(walletAddress: string): Promise<Miner | undefined>;
  upsertMiner(miner: InsertMiner): Promise<Miner>;
  updateMinerStats(walletAddress: string, hashRate: number, shards: number): Promise<void>;

  createWallet(userId: number, name?: string): Promise<Wallet>;
  getAllWallets(): Promise<Wallet[]>;
  getWalletsByUser(userId: number): Promise<Wallet[]>;
  getWallet(id: number): Promise<Wallet | undefined>;
  updateWalletBalance(id: number, token: string, amount: string): Promise<void>;
  /**
   * Atomically set the balance to `newBalance` for `token` on wallet `id`,
   * but only if the current balance equals `expectedBalance` (optimistic locking / compare-and-swap).
   * The caller is responsible for computing `newBalance` using integer (BigInt) arithmetic.
   * Returns true if the update succeeded, false if the row was concurrently modified.
   */
  reserveWalletBalance(id: number, token: string, expectedBalance: string, newBalance: string): Promise<boolean>;
  /**
   * Atomically restore a previously reserved balance back to `restoredBalance`,
   * but only if the current balance equals `reservedBalance` (the post-deduction value).
   * Prevents the rollback from clobbering a concurrent successful transaction.
   * Returns true if the restore succeeded.
   */
  releaseWalletBalance(id: number, token: string, reservedBalance: string, restoredBalance: string): Promise<boolean>;
  /**
   * Atomically deduct balance and record a transaction in a single DB transaction.
   * The balance update is gated on `expectedBalance` (CAS predicate) — throws if the row
   * was concurrently modified. Callers should catch and return HTTP 409.
   */
  sendToken(walletId: number, token: string, expectedBalance: string, newBalance: string, txRecord: typeof walletTransactions.$inferInsert): Promise<WalletTransaction>;
  /**
   * Atomically update both sides of a swap and record a transaction in a single DB transaction.
   * Each balance update is gated on its expected current value (CAS). Throws on concurrent modification.
   */
  swapTokens(walletId: number, fromToken: string, expectedFromBalance: string, newFromBalance: string, toToken: string, expectedToBalance: string, newToBalance: string, txRecord: typeof walletTransactions.$inferInsert): Promise<WalletTransaction>;
  consolidateWallets(userId: number): Promise<{ wallet: Wallet; deletedCount: number }>;
  createTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction>;
  getTransactionsByWallet(walletId: number): Promise<WalletTransaction[]>;

  getNfts(): Promise<Nft[]>;
  getNft(id: number): Promise<Nft | undefined>;
  getNftsByUser(userId: number): Promise<Nft[]>;
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

  // ─── PoW Challenge methods ────────────────────────────────────────────────
  getActivePowChallenge(): Promise<PowChallenge | undefined>;
  getPowChallenge(challengeId: string): Promise<PowChallenge | undefined>;
  createPowChallenge(challenge: InsertPowChallenge): Promise<PowChallenge>;
  updatePowChallengeStatus(challengeId: string, status: string): Promise<void>;
  incrementPowChallengeSolutions(challengeId: string): Promise<void>;
  createPowSubmission(submission: InsertPowSubmission): Promise<PowSubmission>;
  getPowSubmissions(challengeId: string): Promise<PowSubmission[]>;
  getMinerSubmission(challengeId: string, minerAddress: string): Promise<PowSubmission | undefined>;
  updatePowSubmissionStatus(id: number, status: string, solanaTxHash?: string): Promise<void>;

  createZkWormhole(wormhole: InsertZkWormhole): Promise<ZkWormhole>;
  getZkWormholesByUser(userId: number): Promise<ZkWormhole[]>;
  getZkWormhole(id: number): Promise<ZkWormhole | undefined>;
  getZkWormholeByWormholeId(wormholeId: string): Promise<ZkWormhole | undefined>;
  updateZkWormholeStatus(id: number, status: string): Promise<void>;
  updateZkWormholeStats(id: number, totalTransferred: string, transferCount: number): Promise<void>;
  createZkWormholeTransfer(transfer: InsertZkWormholeTransfer): Promise<ZkWormholeTransfer>;
  getZkWormholeTransfers(wormholeId: number): Promise<ZkWormholeTransfer[]>;
  getZkWormholeTransfersByUser(userId: number): Promise<ZkWormholeTransfer[]>;
  updateZkWormholeTransferStatus(id: number, status: string, txHash?: string): Promise<void>;
  updateZkWormholeTransferOnChain(id: number, onChainTxHash: string | null, explorerUrl: string | null, transmitStatus: string): Promise<void>;

  createRarityCertificate(cert: InsertRarityCertificate): Promise<RarityCertificate>;
  getRarityCertificatesByUser(userId: number): Promise<RarityCertificate[]>;
  getRarityCertificateByNft(nftId: number, userId: number): Promise<RarityCertificate | undefined>;
  getRarityCertificateByNftOnly(nftId: number): Promise<RarityCertificate | undefined>;
  getRarityCertificateById(certificateId: string): Promise<RarityCertificate | undefined>;

  getModelByUserId(userId: number): Promise<RocketBabeModel | undefined>;
  getModelById(id: number): Promise<RocketBabeModel | undefined>;
  createModel(model: InsertRocketBabeModel): Promise<RocketBabeModel>;
  updateModel(id: number, updates: Partial<InsertRocketBabeModel>): Promise<RocketBabeModel | undefined>;
  getApprovedModels(): Promise<RocketBabeModel[]>;
  getAllModels(): Promise<RocketBabeModel[]>;

  getAirdrops(): Promise<Airdrop[]>;
  getAirdrop(id: number): Promise<Airdrop | undefined>;
  createAirdrop(airdrop: InsertAirdrop): Promise<Airdrop>;
  updateAirdropStatus(id: number, status: string): Promise<void>;
  incrementAirdropClaimed(id: number): Promise<void>;
  getUserAirdropClaim(airdropId: number, userId: number): Promise<AirdropClaim | undefined>;
  createAirdropClaim(claim: InsertAirdropClaim): Promise<AirdropClaim>;
  getAirdropClaims(airdropId: number): Promise<AirdropClaim[]>;

  getKycByUser(userId: number): Promise<KycSubmission | undefined>;
  getKycById(id: number): Promise<KycSubmission | undefined>;
  getAllKycSubmissions(): Promise<KycSubmission[]>;
  createKycSubmission(sub: InsertKycSubmission): Promise<KycSubmission>;
  updateKycStatus(id: number, status: string, reviewNotes: string | null, reviewedBy: number): Promise<void>;
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

  async getUserByWalletAddress(address: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, address));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserNonce(id: number, nonce: string | null): Promise<void> {
    await db.update(users).set({ authNonce: nonce }).where(eq(users.id, id));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
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
    const [launch] = await db.insert(launches).values(insertLaunch as any).returning();
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
    const [miner] = await db.insert(miners)
      .values(insertMiner as any)
      .onConflictDoUpdate({ target: miners.walletAddress, set: insertMiner as any })
      .returning();
    return miner;
  }

  async updateMinerStats(walletAddress: string, hashRate: number, shards: number): Promise<void> {
    await db.update(miners)
      .set({ hashRate, shards, lastUpdate: new Date() })
      .where(eq(miners.walletAddress, walletAddress));
  }

  async getAllWallets(): Promise<Wallet[]> {
    return await db.select().from(wallets);
  }

  async createWallet(userId: number, name: string = "Main Wallet"): Promise<Wallet> {
    const address = generateWalletAddress();
    const [wallet] = await db.insert(wallets).values({
      userId,
      name,
      address,
      balanceStx: "100",
      balanceSkynt: "1000",
      balanceEth: "0",
      balanceSol: "0",
    } as any).returning();
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
    const field = token === "STX" ? "balanceStx" : token === "ETH" ? "balanceEth" : token === "SOL" ? "balanceSol" : "balanceSkynt";
    await db.update(wallets).set({ [field]: amount }).where(eq(wallets.id, id));
  }

  async reserveWalletBalance(id: number, token: string, expectedBalance: string, newBalance: string): Promise<boolean> {
    const field: "balanceStx" | "balanceEth" | "balanceSkynt" | "balanceSol" =
      token === "STX" ? "balanceStx" : token === "ETH" ? "balanceEth" : token === "SOL" ? "balanceSol" : "balanceSkynt";
    // Atomic compare-and-swap: only update if balance is still at expectedBalance
    const updated = await db
      .update(wallets)
      .set({ [field]: newBalance })
      .where(and(eq(wallets.id, id), eq(wallets[field], expectedBalance)))
      .returning({ id: wallets.id });
    return updated.length > 0;
  }

  async releaseWalletBalance(id: number, token: string, reservedBalance: string, restoredBalance: string): Promise<boolean> {
    const field: "balanceStx" | "balanceEth" | "balanceSkynt" | "balanceSol" =
      token === "STX" ? "balanceStx" : token === "ETH" ? "balanceEth" : token === "SOL" ? "balanceSol" : "balanceSkynt";
    // Only restore if balance is still at reservedBalance — prevents clobbering concurrent successful txns
    const updated = await db
      .update(wallets)
      .set({ [field]: restoredBalance })
      .where(and(eq(wallets.id, id), eq(wallets[field], reservedBalance)))
      .returning({ id: wallets.id });
    return updated.length > 0;
  }

  async sendToken(walletId: number, token: string, expectedBalance: string, newBalance: string, txRecord: typeof walletTransactions.$inferInsert): Promise<WalletTransaction> {
    return await db.transaction(async (dbTx) => {
      const field: "balanceStx" | "balanceEth" | "balanceSkynt" | "balanceSol" =
        token === "STX" ? "balanceStx" : token === "ETH" ? "balanceEth" : token === "SOL" ? "balanceSol" : "balanceSkynt";
      // CAS predicate: only update if balance is still at expectedBalance
      const updated = await dbTx
        .update(wallets)
        .set({ [field]: newBalance })
        .where(and(eq(wallets.id, walletId), eq(wallets[field], expectedBalance)))
        .returning({ id: wallets.id });
      if (updated.length === 0) {
        throw Object.assign(new Error("Balance changed concurrently — please retry"), { code: "CONCURRENT_MODIFICATION" });
      }
      const [transaction] = await dbTx.insert(walletTransactions).values(txRecord).returning();
      return transaction;
    });
  }

  async swapTokens(walletId: number, fromToken: string, expectedFromBalance: string, newFromBalance: string, toToken: string, expectedToBalance: string, newToBalance: string, txRecord: typeof walletTransactions.$inferInsert): Promise<WalletTransaction> {
    return await db.transaction(async (dbTx) => {
      const fromField: "balanceStx" | "balanceEth" | "balanceSkynt" | "balanceSol" =
        fromToken === "STX" ? "balanceStx" : fromToken === "ETH" ? "balanceEth" : fromToken === "SOL" ? "balanceSol" : "balanceSkynt";
      const toField: "balanceStx" | "balanceEth" | "balanceSkynt" | "balanceSol" =
        toToken === "STX" ? "balanceStx" : toToken === "ETH" ? "balanceEth" : toToken === "SOL" ? "balanceSol" : "balanceSkynt";
      // CAS on source balance
      const updatedFrom = await dbTx
        .update(wallets)
        .set({ [fromField]: newFromBalance })
        .where(and(eq(wallets.id, walletId), eq(wallets[fromField], expectedFromBalance)))
        .returning({ id: wallets.id });
      if (updatedFrom.length === 0) {
        throw Object.assign(new Error("Balance changed concurrently — please retry"), { code: "CONCURRENT_MODIFICATION" });
      }
      // CAS on destination balance
      const updatedTo = await dbTx
        .update(wallets)
        .set({ [toField]: newToBalance })
        .where(and(eq(wallets.id, walletId), eq(wallets[toField], expectedToBalance)))
        .returning({ id: wallets.id });
      if (updatedTo.length === 0) {
        throw Object.assign(new Error("Balance changed concurrently — please retry"), { code: "CONCURRENT_MODIFICATION" });
      }
      const [transaction] = await dbTx.insert(walletTransactions).values(txRecord).returning();
      return transaction;
    });
  }

  async consolidateWallets(userId: number): Promise<{ wallet: Wallet; deletedCount: number }> {
    return await db.transaction(async (tx) => {
      // Sort by id ascending — the first wallet (lowest id) is the admin/primary wallet
      const allWallets = (await tx.select().from(wallets).where(eq(wallets.userId, userId))).sort((a, b) => a.id - b.id);
      if (allWallets.length === 0) throw new Error("No wallets found");

      const adminWallet = allWallets[0];
      const others = allWallets.slice(1);

      // Sum all balances using BigInt micro-unit arithmetic (6 decimal places = 1_000_000 units)
      // This avoids floating-point rounding errors when summing across many wallets.
      const PRECISION_STX   = 1_000_000n;    // 6 decimal places
      const PRECISION_SKYNT = 1_000_000n;    // 6 decimal places
      const PRECISION_ETH   = 100_000_000n;  // 8 decimal places

      function toMicroUnits(value: string, precision: bigint): bigint {
        const [intPart = "0", fracPart = ""] = value.split(".");
        const digits = Number(precision).toString().length - 1;
        const fracPadded = (fracPart + "0".repeat(digits)).slice(0, digits);
        return BigInt(intPart) * precision + BigInt(fracPadded);
      }

      function fromMicroUnits(units: bigint, precision: bigint): string {
        const digits = Number(precision).toString().length - 1;
        const intPart = units / precision;
        const fracPart = String(units % precision).padStart(digits, "0");
        return `${intPart}.${fracPart}`;
      }

      let totalStx   = toMicroUnits(adminWallet.balanceStx,   PRECISION_STX);
      let totalSkynt = toMicroUnits(adminWallet.balanceSkynt, PRECISION_SKYNT);
      let totalEth   = toMicroUnits(adminWallet.balanceEth,   PRECISION_ETH);

      for (const w of others) {
        totalStx   += toMicroUnits(w.balanceStx,   PRECISION_STX);
        totalSkynt += toMicroUnits(w.balanceSkynt, PRECISION_SKYNT);
        totalEth   += toMicroUnits(w.balanceEth,   PRECISION_ETH);
      }

      // Update admin wallet with the combined total (inside transaction)
      const [updated] = await tx.update(wallets)
        .set({
          balanceStx:   fromMicroUnits(totalStx,   PRECISION_STX),
          balanceSkynt: fromMicroUnits(totalSkynt, PRECISION_SKYNT),
          balanceEth:   fromMicroUnits(totalEth,   PRECISION_ETH),
          name:         adminWallet.name,
        })
        .where(eq(wallets.id, adminWallet.id))
        .returning();

      // Delete all other wallets atomically (wallet_transactions cascade automatically)
      let deletedCount = 0;
      for (const w of others) {
        await tx.delete(wallets).where(eq(wallets.id, w.id));
        deletedCount++;
      }

      return { wallet: updated, deletedCount };
    });
  }

  async createTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction> {
    const [transaction] = await db.insert(walletTransactions).values(tx as any).returning();
    return transaction;
  }

  async getTransactionsByWallet(walletId: number): Promise<WalletTransaction[]> {
    return await db.select().from(walletTransactions).where(eq(walletTransactions.walletId, walletId)).orderBy(desc(walletTransactions.createdAt));
  }

  async getNfts(): Promise<Nft[]> {
    return await db.select().from(nfts).orderBy(desc(nfts.id));
  }

  async getNftsByUser(userId: number): Promise<Nft[]> {
    return await db.select().from(nfts).where(eq(nfts.mintedBy, userId)).orderBy(desc(nfts.id));
  }

  async getNft(id: number): Promise<Nft | undefined> {
    const [nft] = await db.select().from(nfts).where(eq(nfts.id, id));
    return nft;
  }

  async createNft(insertNft: InsertNft): Promise<Nft> {
    const [nft] = await db.insert(nfts).values(insertNft as any).returning();
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
    const [btx] = await db.insert(bridgeTransactions).values(tx as any).returning();
    return btx;
  }

  async updateBridgeStatus(id: number, status: string, signatures: string): Promise<void> {
    await db.update(bridgeTransactions).set({ status, signatures }).where(eq(bridgeTransactions.id, id));
  }

  async getGuardians(): Promise<Guardian[]> {
    return await db.select().from(guardians).orderBy(guardians.guardianIndex);
  }

  async createGuardian(guardian: InsertGuardian): Promise<Guardian> {
    const [g] = await db.insert(guardians).values(guardian as any).returning();
    return g;
  }

  async updateGuardianStatus(guardianIndex: number, status: string): Promise<void> {
    await db.update(guardians).set({ status, lastSignature: new Date() }).where(eq(guardians.guardianIndex, guardianIndex));
  }

  async getYieldStrategies(): Promise<YieldStrategy[]> {
    return await db.select().from(yieldStrategies);
  }

  async createYieldStrategy(strategy: InsertYieldStrategy): Promise<YieldStrategy> {
    const [s] = await db.insert(yieldStrategies).values(strategy as any).returning();
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
    const [d] = await db.insert(contractDeployments).values(deployment as any).returning();
    return d;
  }

  async createGameScore(score: InsertGameScore): Promise<GameScore> {
    const [s] = await db.insert(gameScores).values(score as any).returning();
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
      const newWallet = await this.createWallet(userId, "Main Wallet");
      userWallets = [newWallet];
    }
    if (userWallets.length === 0) return undefined;

    const wallet = userWallets[0];
    // Use BigInt micro-unit arithmetic (SKYNT: 6 decimal places = 1_000_000 units)
    function skyntToUnits(v: string): bigint {
      const [i = "0", f = ""] = v.split(".");
      const fPad = (f + "000000").slice(0, 6);
      return BigInt(i) * 1_000_000n + BigInt(fPad);
    }
    function skyntFromUnits(u: bigint): string {
      return `${u / 1_000_000n}.${String(u % 1_000_000n).padStart(6, "0")}`;
    }
    const expectedBalance = wallet.balanceSkynt;
    const currentUnits = skyntToUnits(expectedBalance);
    const rewardUnits = skyntToUnits(score.skyntEarned);
    const newBalance = skyntFromUnits(currentUnits + rewardUnits);
    await this.sendToken(wallet.id, "SKYNT", expectedBalance, newBalance, {
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
    const [created] = await db.insert(marketplaceListings).values(listing as any).returning();
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

      const currency = listing.currency || "ETH";
      const prec = currency === "ETH" ? 100_000_000n : 1_000_000n;
      const digits = currency === "ETH" ? 8 : 6;

      function mktToUnits(v: string): bigint {
        const [i = "0", f = ""] = v.split(".");
        const fPad = (f + "0".repeat(digits)).slice(0, digits);
        return BigInt(i) * prec + BigInt(fPad);
      }
      function mktFromUnits(u: bigint): string {
        return `${u / prec}.${String(u % prec).padStart(digits, "0")}`;
      }

      const priceUnits = mktToUnits(listing.price);
      if (priceUnits <= 0n) return { success: false, error: "Invalid listing price" };

      const balanceField = currency === "STX" ? "balanceStx" as const : currency === "SKYNT" ? "balanceSkynt" as const : "balanceEth" as const;
      const buyerBalanceUnits = mktToUnits(String(buyerWallet[balanceField]));
      if (buyerBalanceUnits < priceUnits) return { success: false, error: `Insufficient ${currency} balance` };

      await tx.update(wallets).set({ [balanceField]: mktFromUnits(buyerBalanceUnits - priceUnits) }).where(eq(wallets.id, buyerWallet.id));

      const sellerWalletList = await tx.select().from(wallets).where(eq(wallets.userId, listing.sellerId));
      if (sellerWalletList.length > 0) {
        const sellerWallet = sellerWalletList[0];
        const sellerBalanceUnits = mktToUnits(String(sellerWallet[balanceField]));
        await tx.update(wallets).set({ [balanceField]: mktFromUnits(sellerBalanceUnits + priceUnits) }).where(eq(wallets.id, sellerWallet.id));
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
      } as any);

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

  // ─── PoW Challenge implementations ───────────────────────────────────────

  async getActivePowChallenge(): Promise<PowChallenge | undefined> {
    const [challenge] = await db
      .select()
      .from(powChallenges)
      .where(eq(powChallenges.status, "active"))
      .orderBy(desc(powChallenges.createdAt))
      .limit(1);
    return challenge;
  }

  async getPowChallenge(challengeId: string): Promise<PowChallenge | undefined> {
    const [challenge] = await db
      .select()
      .from(powChallenges)
      .where(eq(powChallenges.challengeId, challengeId));
    return challenge;
  }

  async createPowChallenge(challenge: InsertPowChallenge): Promise<PowChallenge> {
    const [created] = await db.insert(powChallenges).values(challenge as any).returning();
    return created;
  }

  async updatePowChallengeStatus(challengeId: string, status: string): Promise<void> {
    await db
      .update(powChallenges)
      .set({ status })
      .where(eq(powChallenges.challengeId, challengeId));
  }

  async incrementPowChallengeSolutions(challengeId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(powChallenges)
      .where(eq(powChallenges.challengeId, challengeId));
    if (existing) {
      await db
        .update(powChallenges)
        .set({ solutionsCount: existing.solutionsCount + 1 })
        .where(eq(powChallenges.challengeId, challengeId));
    }
  }

  async createPowSubmission(submission: InsertPowSubmission): Promise<PowSubmission> {
    const [created] = await db.insert(powSubmissions).values(submission as any).returning();
    return created;
  }

  async getPowSubmissions(challengeId: string): Promise<PowSubmission[]> {
    return db
      .select()
      .from(powSubmissions)
      .where(eq(powSubmissions.challengeId, challengeId))
      .orderBy(desc(powSubmissions.createdAt));
  }

  async getMinerSubmission(challengeId: string, minerAddress: string): Promise<PowSubmission | undefined> {
    const [record] = await db
      .select()
      .from(powSubmissions)
      .where(
        and(
          eq(powSubmissions.challengeId, challengeId),
          eq(powSubmissions.minerAddress, minerAddress),
        ),
      );
    return record;
  }

  async updatePowSubmissionStatus(id: number, status: string, solanaTxHash?: string): Promise<void> {
    await db
      .update(powSubmissions)
      .set({ status, ...(solanaTxHash !== undefined ? { solanaTxHash } : {}) })
      .where(eq(powSubmissions.id, id));
  }

  async createZkWormhole(wormhole: InsertZkWormhole): Promise<ZkWormhole> {
    const [created] = await db.insert(zkWormholes).values(wormhole as any).returning();
    return created;
  }

  async getZkWormholesByUser(userId: number): Promise<ZkWormhole[]> {
    return await db.select().from(zkWormholes).where(eq(zkWormholes.userId, userId)).orderBy(desc(zkWormholes.createdAt));
  }

  async getZkWormhole(id: number): Promise<ZkWormhole | undefined> {
    const [wormhole] = await db.select().from(zkWormholes).where(eq(zkWormholes.id, id));
    return wormhole;
  }

  async getZkWormholeByWormholeId(wormholeId: string): Promise<ZkWormhole | undefined> {
    const [wormhole] = await db.select().from(zkWormholes).where(eq(zkWormholes.wormholeId, wormholeId));
    return wormhole;
  }

  async updateZkWormholeStatus(id: number, status: string): Promise<void> {
    await db.update(zkWormholes).set({ status }).where(eq(zkWormholes.id, id));
  }

  async updateZkWormholeStats(id: number, totalTransferred: string, transferCount: number): Promise<void> {
    await db.update(zkWormholes).set({ totalTransferred, transferCount }).where(eq(zkWormholes.id, id));
  }

  async createZkWormholeTransfer(transfer: InsertZkWormholeTransfer): Promise<ZkWormholeTransfer> {
    const [created] = await db.insert(zkWormholeTransfers).values(transfer as any).returning();
    return created;
  }

  async getZkWormholeTransfers(wormholeId: number): Promise<ZkWormholeTransfer[]> {
    return await db.select().from(zkWormholeTransfers).where(eq(zkWormholeTransfers.wormholeId, wormholeId)).orderBy(desc(zkWormholeTransfers.createdAt));
  }

  async getZkWormholeTransfersByUser(userId: number): Promise<ZkWormholeTransfer[]> {
    return await db.select().from(zkWormholeTransfers).where(eq(zkWormholeTransfers.userId, userId)).orderBy(desc(zkWormholeTransfers.createdAt));
  }

  async updateZkWormholeTransferStatus(id: number, status: string, txHash?: string): Promise<void> {
    await db.update(zkWormholeTransfers).set({ status, ...(txHash ? { txHash } : {}) }).where(eq(zkWormholeTransfers.id, id));
  }

  async updateZkWormholeTransferOnChain(id: number, onChainTxHash: string | null, explorerUrl: string | null, transmitStatus: string): Promise<void> {
    await db.update(zkWormholeTransfers).set({ onChainTxHash, explorerUrl, transmitStatus }).where(eq(zkWormholeTransfers.id, id));
  }

  async createRarityCertificate(cert: InsertRarityCertificate): Promise<RarityCertificate> {
    const [created] = await db.insert(rarityCertificates).values(cert as any).returning();
    return created;
  }

  async getRarityCertificatesByUser(userId: number): Promise<RarityCertificate[]> {
    return await db.select().from(rarityCertificates)
      .where(eq(rarityCertificates.userId, userId))
      .orderBy(desc(rarityCertificates.createdAt));
  }

  async getRarityCertificateByNft(nftId: number, userId: number): Promise<RarityCertificate | undefined> {
    const [cert] = await db.select().from(rarityCertificates)
      .where(and(eq(rarityCertificates.nftId, nftId), eq(rarityCertificates.userId, userId)));
    return cert;
  }

  async getRarityCertificateByNftOnly(nftId: number): Promise<RarityCertificate | undefined> {
    const [cert] = await db.select().from(rarityCertificates)
      .where(and(eq(rarityCertificates.nftId, nftId), eq(rarityCertificates.status, "valid")))
      .orderBy(desc(rarityCertificates.createdAt))
      .limit(1);
    return cert;
  }

  async getRarityCertificateById(certificateId: string): Promise<RarityCertificate | undefined> {
    const [cert] = await db.select().from(rarityCertificates)
      .where(eq(rarityCertificates.certificateId, certificateId));
    return cert;
  }

  async getModelByUserId(userId: number): Promise<RocketBabeModel | undefined> {
    const [model] = await db.select().from(rocketBabeModels).where(eq(rocketBabeModels.userId, userId));
    return model;
  }

  async getModelById(id: number): Promise<RocketBabeModel | undefined> {
    const [model] = await db.select().from(rocketBabeModels).where(eq(rocketBabeModels.id, id));
    return model;
  }

  async createModel(model: InsertRocketBabeModel): Promise<RocketBabeModel> {
    const [created] = await db.insert(rocketBabeModels).values(model as any).returning();
    return created;
  }

  async updateModel(id: number, updates: Partial<InsertRocketBabeModel>): Promise<RocketBabeModel | undefined> {
    const [updated] = await db.update(rocketBabeModels).set(updates).where(eq(rocketBabeModels.id, id)).returning();
    return updated;
  }

  async getApprovedModels(): Promise<RocketBabeModel[]> {
    return await db.select().from(rocketBabeModels)
      .where(eq(rocketBabeModels.approved, true))
      .orderBy(desc(rocketBabeModels.totalMints));
  }

  async getAllModels(): Promise<RocketBabeModel[]> {
    return await db.select().from(rocketBabeModels)
      .orderBy(desc(rocketBabeModels.createdAt));
  }

  async getAirdrops(): Promise<Airdrop[]> {
    return await db.select().from(airdrops).orderBy(desc(airdrops.createdAt));
  }

  async getAirdrop(id: number): Promise<Airdrop | undefined> {
    const [airdrop] = await db.select().from(airdrops).where(eq(airdrops.id, id));
    return airdrop;
  }

  async createAirdrop(airdrop: InsertAirdrop): Promise<Airdrop> {
    const [created] = await db.insert(airdrops).values(airdrop as any).returning();
    return created;
  }

  async updateAirdropStatus(id: number, status: string): Promise<void> {
    await db.update(airdrops).set({ status }).where(eq(airdrops.id, id));
  }

  async incrementAirdropClaimed(id: number): Promise<void> {
    const [airdrop] = await db.select().from(airdrops).where(eq(airdrops.id, id));
    if (airdrop) {
      await db.update(airdrops).set({ claimedCount: airdrop.claimedCount + 1 }).where(eq(airdrops.id, id));
    }
  }

  async getUserAirdropClaim(airdropId: number, userId: number): Promise<AirdropClaim | undefined> {
    const [claim] = await db.select().from(airdropClaims)
      .where(and(eq(airdropClaims.airdropId, airdropId), eq(airdropClaims.userId, userId)));
    return claim;
  }

  async createAirdropClaim(claim: InsertAirdropClaim): Promise<AirdropClaim> {
    const [created] = await db.insert(airdropClaims).values(claim as any).returning();
    return created;
  }

  async getAirdropClaims(airdropId: number): Promise<AirdropClaim[]> {
    return await db.select().from(airdropClaims)
      .where(eq(airdropClaims.airdropId, airdropId))
      .orderBy(desc(airdropClaims.claimedAt));
  }

  async getKycByUser(userId: number): Promise<KycSubmission | undefined> {
    const [row] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.userId, userId));
    return row;
  }

  async getKycById(id: number): Promise<KycSubmission | undefined> {
    const [row] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.id, id));
    return row;
  }

  async getAllKycSubmissions(): Promise<KycSubmission[]> {
    return await db.select().from(kycSubmissions).orderBy(desc(kycSubmissions.submittedAt));
  }

  async createKycSubmission(sub: InsertKycSubmission): Promise<KycSubmission> {
    const [created] = await db.insert(kycSubmissions).values(sub as any).returning();
    return created;
  }

  async updateKycStatus(id: number, status: string, reviewNotes: string | null, reviewedBy: number): Promise<void> {
    await db.update(kycSubmissions)
      .set({ status, reviewNotes, reviewedBy, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(kycSubmissions.id, id));
  }

  async createYieldPosition(pos: InsertYieldPosition): Promise<YieldPosition> {
    const [row] = await db.insert(yieldPositions).values(pos as any).returning();
    return row;
  }

  async getUserYieldPositions(userId: number): Promise<YieldPosition[]> {
    return await db.select().from(yieldPositions)
      .where(and(eq(yieldPositions.userId, userId), eq(yieldPositions.status, "active")))
      .orderBy(desc(yieldPositions.stakedAt));
  }

  async getYieldPosition(positionId: number): Promise<YieldPosition | undefined> {
    const [row] = await db.select().from(yieldPositions).where(eq(yieldPositions.id, positionId));
    return row;
  }

  async closeYieldPosition(positionId: number, finalRewards: number): Promise<void> {
    await db.update(yieldPositions)
      .set({ status: "closed", accruedRewards: finalRewards })
      .where(eq(yieldPositions.id, positionId));
  }

  async updateYieldPositionRewards(positionId: number, accruedRewards: number): Promise<void> {
    await db.update(yieldPositions)
      .set({ accruedRewards, lastRewardAt: new Date() })
      .where(eq(yieldPositions.id, positionId));
  }

  async compoundYieldPosition(positionId: number): Promise<YieldPosition | undefined> {
    const pos = await this.getYieldPosition(positionId);
    if (!pos) return undefined;
    const [row] = await db.update(yieldPositions)
      .set({ amountStaked: pos.amountStaked + pos.accruedRewards, accruedRewards: 0, lastRewardAt: new Date() })
      .where(eq(yieldPositions.id, positionId))
      .returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
