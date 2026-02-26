import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const SUPPORTED_CHAINS = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    icon: "⟠",
    color: "#627EEA",
    chainId: 1,
    explorer: "https://etherscan.io",
    contractAddress: "0x7A3F...SpaceFlightNFT",
    gasEstimate: "~0.003 ETH",
    avgGasUnits: 180000,
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    icon: "⬡",
    color: "#8247E5",
    chainId: 137,
    explorer: "https://polygonscan.com",
    contractAddress: "0x4E8D...SpaceFlightNFT",
    gasEstimate: "~0.003 MATIC",
    avgGasUnits: 180000,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum",
    symbol: "ETH",
    icon: "◈",
    color: "#28A0F0",
    chainId: 42161,
    explorer: "https://arbiscan.io",
    contractAddress: "0x9B2C...SpaceFlightNFT",
    gasEstimate: "~0.00008 ETH",
    avgGasUnits: 180000,
  },
  stacks: {
    id: "stacks",
    name: "Stacks",
    symbol: "STX",
    icon: "⟐",
    color: "#FC6432",
    chainId: 0,
    explorer: "https://explorer.stacks.co",
    contractAddress: "SP2...sphinx-nft",
    gasEstimate: "~0.01 STX",
    avgGasUnits: 0,
  },
  base: {
    id: "base",
    name: "Base",
    symbol: "ETH",
    icon: "◉",
    color: "#0052FF",
    chainId: 8453,
    explorer: "https://basescan.org",
    contractAddress: "0x1F6A...SpaceFlightNFT",
    gasEstimate: "~0.00005 ETH",
    avgGasUnits: 180000,
  },
  solana: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    icon: "◎",
    color: "#9945FF",
    chainId: 0,
    explorer: "https://explorer.solana.com",
    contractAddress: "Sphnx...NftProgram",
    gasEstimate: "~0.00025 SOL",
    avgGasUnits: 0,
  },
  skynt: {
    id: "skynt",
    name: "SphinxSkynet",
    symbol: "SKYNT",
    icon: "🦁",
    color: "#FFD700",
    chainId: 0,
    explorer: "https://explorer.sphinxskynet.io",
    contractAddress: "SKYNT...SpaceFlightNFT",
    gasEstimate: "~0 SKYNT",
    avgGasUnits: 0,
  },
} as const;

export const BRIDGE_FEE_BPS = 10;
export const BRIDGE_FEE_PERCENT = "0.1%";

export type ChainId = keyof typeof SUPPORTED_CHAINS;

export const RARITY_TIERS = {
  mythic: { label: "Mythic", supply: 1, color: "magenta", price: "100 ETH" },
  legendary: { label: "Legendary", supply: 3, color: "orange", price: "1.0 ETH" },
  rare: { label: "Rare", supply: 6, color: "cyan", price: "0.5 ETH" },
  common: { label: "Common", supply: 90, color: "green", price: "0.1 ETH" },
} as const;

// ==================== SKYNT Tokenomics ====================

export const SKYNT_TOKENOMICS = {
  name: "SKYNT",
  maxSupply: 21_000_000,
  initialCirculating: 2_100_000,
  decimals: 18,
  transactionFee: 0,
  miningReward: 50,
  halvingInterval: 210_000,
  powAlgorithm: "phi-spectral",

  distribution: {
    mining:           { percent: 40, tokens: 8_400_000,  label: "Mining & Validation" },
    ecosystem:        { percent: 20, tokens: 4_200_000,  label: "Ecosystem & Staking Rewards" },
    treasury:         { percent: 15, tokens: 3_150_000,  label: "Treasury & Operations" },
    team:             { percent: 10, tokens: 2_100_000,  label: "Team & Advisors",      vestingMonths: 24 },
    communityRewards: { percent: 10, tokens: 2_100_000,  label: "Community & Game Rewards" },
    liquidity:        { percent:  5, tokens: 1_050_000,  label: "Liquidity Provision" },
  },

  gameRewards: {
    scoreMultiplier: 0.1,
    phiBonusMultiplier: 0.5,
    maxScorePerGame: 50_000,
    maxErgotropy: 10_000,
  },

  yieldTiers: {
    singleStake:     { aprPercent: 24.6, riskScore: 10 },
    liquidityPool:   { aprPercent: 42.8, riskScore: 25 },
    crossChain:      { aprPercent: 68.5, riskScore: 55 },
    poxDelegation:   { aprPercent: 95.2, riskScore: 40 },
  },
} as const;

export type RarityTier = keyof typeof RARITY_TIERS;

export const launches = pgTable("launches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull(),
  supply: integer("supply").notNull(),
  minted: integer("minted").notNull().default(0),
  image: text("image").notNull(),
  status: text("status").notNull().default("upcoming"),
  type: text("type").notNull().default("standard"),
  contractAddress: text("contract_address"),
  features: jsonb("features").notNull().default([]),
  mintedByRarity: jsonb("minted_by_rarity").notNull().default({ mythic: 0, legendary: 0, rare: 0, common: 0 }),
});

export const insertLaunchSchema = createInsertSchema(launches).omit({ 
  id: true,
  minted: true 
});

export type Launch = typeof launches.$inferSelect;
export type InsertLaunch = z.infer<typeof insertLaunchSchema>;

export const wallets = pgTable("wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Main Wallet"),
  address: text("address").notNull().unique(),
  balanceStx: text("balance_stx").notNull().default("0"),
  balanceSkynt: text("balance_skynt").notNull().default("1000"),
  balanceEth: text("balance_eth").notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true });
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export const walletTransactions = pgTable("wallet_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  toAddress: text("to_address"),
  fromAddress: text("from_address"),
  amount: text("amount").notNull(),
  token: text("token").notNull().default("SKYNT"),
  status: text("status").notNull().default("completed"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;

export const miners = pgTable("miners", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: text("wallet_address").notNull().unique(),
  hashRate: integer("hash_rate").notNull().default(0),
  shards: integer("shards").notNull().default(0),
  lastUpdate: timestamp("last_update").defaultNow(),
});

export const insertMinerSchema = createInsertSchema(miners).omit({ 
  id: true 
});

export type Miner = typeof miners.$inferSelect;
export type InsertMiner = z.infer<typeof insertMinerSchema>;

export const nfts = pgTable("nfts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  image: text("image").notNull(),
  rarity: text("rarity").notNull(),
  status: text("status").notNull().default("minted"),
  mintDate: text("mint_date").notNull(),
  tokenId: text("token_id").notNull(),
  owner: text("owner").notNull(),
  price: text("price").notNull(),
  chain: text("chain").notNull().default("ethereum"),
  launchId: integer("launch_id"),
  mintedBy: integer("minted_by"),
  openseaUrl: text("opensea_url"),
  openseaStatus: text("opensea_status").default("pending"),
  openseaListingId: text("opensea_listing_id"),
});

export const insertNftSchema = createInsertSchema(nfts).omit({ id: true });
export type Nft = typeof nfts.$inferSelect;
export type InsertNft = z.infer<typeof insertNftSchema>;

export const bridgeTransactions = pgTable("bridge_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fromChain: text("from_chain").notNull(),
  toChain: text("to_chain").notNull(),
  amount: text("amount").notNull(),
  token: text("token").notNull().default("SKYNT"),
  status: text("status").notNull().default("Locked"),
  signatures: text("signatures").notNull().default("0/5"),
  mechanism: text("mechanism").notNull().default("Lock → Mint"),
  txHash: text("tx_hash"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBridgeTransactionSchema = createInsertSchema(bridgeTransactions).omit({ id: true, createdAt: true });
export type BridgeTransaction = typeof bridgeTransactions.$inferSelect;
export type InsertBridgeTransaction = z.infer<typeof insertBridgeTransactionSchema>;

export const guardians = pgTable("guardians", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  guardianIndex: integer("guardian_index").notNull().unique(),
  status: text("status").notNull().default("online"),
  lastSignature: timestamp("last_signature").defaultNow(),
  publicKey: text("public_key"),
});

export const insertGuardianSchema = createInsertSchema(guardians).omit({ id: true });
export type Guardian = typeof guardians.$inferSelect;
export type InsertGuardian = z.infer<typeof insertGuardianSchema>;

export const yieldStrategies = pgTable("yield_strategies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  strategyId: text("strategy_id").notNull().unique(),
  name: text("name").notNull(),
  contract: text("contract").notNull(),
  apr: text("apr").notNull(),
  riskScore: integer("risk_score").notNull().default(25),
  tvl: text("tvl").notNull().default("0"),
  totalStaked: text("total_staked").notNull().default("0"),
  color: text("color").notNull().default("cyan"),
  active: boolean("active").notNull().default(true),
  description: text("description").notNull(),
});

export const insertYieldStrategySchema = createInsertSchema(yieldStrategies).omit({ id: true });
export type YieldStrategy = typeof yieldStrategies.$inferSelect;
export type InsertYieldStrategy = z.infer<typeof insertYieldStrategySchema>;

export const CONTRACT_DEFINITIONS = [
  { contractId: "SpaceFlightNFT", name: "SpaceFlightNFT", description: "Gas-optimized tiered NFT minting with royalties and OpenSea integration", gasRange: [160000, 240000] },
  { contractId: "SphinxBridge", name: "SphinxBridge", description: "Gas-optimized cross-chain bridge with 5-of-9 guardian multi-sig", gasRange: [180000, 280000] },
  { contractId: "SphinxYieldAggregator", name: "SphinxYieldAggregator", description: "Gas-optimized multi-chain yield aggregator with zk-proof verification", gasRange: [200000, 320000] },
] as const;

export type ContractId = typeof CONTRACT_DEFINITIONS[number]["contractId"];

export const contractDeployments = pgTable("contract_deployments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: text("wallet_address").notNull(),
  walletId: integer("wallet_id"),
  contractId: text("contract_id").notNull(),
  contractName: text("contract_name").notNull(),
  chain: text("chain").notNull().default("ethereum"),
  deployedAddress: text("deployed_address").notNull(),
  txHash: text("tx_hash").notNull(),
  gasUsed: text("gas_used").notNull(),
  status: text("status").notNull().default("deployed"),
  blockNumber: integer("block_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractDeploymentSchema = createInsertSchema(contractDeployments).omit({ id: true, createdAt: true });
export type ContractDeployment = typeof contractDeployments.$inferSelect;
export type InsertContractDeployment = z.infer<typeof insertContractDeploymentSchema>;

export const gameScores = pgTable("game_scores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  score: integer("score").notNull().default(0),
  skyntEarned: text("skynt_earned").notNull().default("0"),
  ergotropy: integer("ergotropy").notNull().default(0),
  berryPhase: text("berry_phase").notNull().default("0"),
  treasuresCollected: integer("treasures_collected").notNull().default(0),
  milestones: integer("milestones").notNull().default(0),
  superMilestones: integer("super_milestones").notNull().default(0),
  survivalTicks: integer("survival_ticks").notNull().default(0),
  chain: text("chain").notNull().default("ETH"),
  claimed: boolean("claimed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGameScoreSchema = createInsertSchema(gameScores).omit({ id: true, createdAt: true, claimed: true });
export type GameScore = typeof gameScores.$inferSelect;
export type InsertGameScore = z.infer<typeof insertGameScoreSchema>;

export const marketplaceListings = pgTable("marketplace_listings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nftId: integer("nft_id").references(() => nfts.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => users.id),
  sellerUsername: text("seller_username").notNull(),
  buyerId: integer("buyer_id").references(() => users.id),
  buyerUsername: text("buyer_username"),
  title: text("title").notNull(),
  image: text("image").notNull(),
  rarity: text("rarity").notNull(),
  chain: text("chain").notNull().default("ethereum"),
  price: text("price").notNull(),
  currency: text("currency").notNull().default("ETH"),
  status: text("status").notNull().default("active"),
  tokenId: text("token_id"),
  contractAddress: text("contract_address"),
  openseaUrl: text("opensea_url"),
  createdAt: timestamp("created_at").defaultNow(),
  soldAt: timestamp("sold_at"),
});

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({ id: true, createdAt: true, soldAt: true });
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;

export { conversations, messages } from "./models/chat";

// ─── PoW Challenge Tables ─────────────────────────────────────────────────────

/**
 * On-chain PoW challenges created by an authority.
 * Mirrors the PowChallenge Anchor account for off-chain tracking.
 */
export const powChallenges = pgTable("pow_challenges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** Unique challenge identifier (e.g. hex seed prefix or UUID). */
  challengeId: text("challenge_id").notNull().unique(),
  /** 32-byte seed published to miners, stored as hex string. */
  seed: text("seed").notNull(),
  /** Difficulty target as decimal string (u128 doesn't fit in JS number). */
  difficultyTarget: text("difficulty_target").notNull(),
  /** Unix timestamp when this challenge expires. */
  expiresAt: timestamp("expires_at").notNull(),
  /** 'active' | 'expired' | 'completed' */
  status: text("status").notNull().default("active"),
  /** Number of valid solutions accepted. */
  solutionsCount: integer("solutions_count").notNull().default(0),
  /** Username or Solana public key of the authority that created this challenge. */
  createdBy: text("created_by").notNull(),
  /** Solana transaction signature for the create_challenge instruction (optional). */
  solanaTxHash: text("solana_tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPowChallengeSchema = createInsertSchema(powChallenges).omit({
  id: true,
  createdAt: true,
  solutionsCount: true,
});
export type PowChallenge = typeof powChallenges.$inferSelect;
export type InsertPowChallenge = z.infer<typeof insertPowChallengeSchema>;

/**
 * Off-chain record of a miner's PoW solution submission.
 * The solanaTxHash is populated once the on-chain submit_challenge_solution
 * transaction confirms.
 */
export const powSubmissions = pgTable("pow_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** References powChallenges.challengeId. */
  challengeId: text("challenge_id").notNull(),
  /** Solana (or cross-chain source) address of the miner. */
  minerAddress: text("miner_address").notNull(),
  /** Nonce as decimal string. */
  nonce: text("nonce").notNull(),
  /** Resulting SHA-256 hash as hex string. */
  powHash: text("pow_hash").notNull(),
  /** Source chain identifier, e.g. 'solana', 'ethereum'. */
  sourceChain: text("source_chain").notNull().default("solana"),
  /** Solana transaction signature after on-chain submission confirms. */
  solanaTxHash: text("solana_tx_hash"),
  /** 'pending' | 'confirmed' | 'failed' */
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPowSubmissionSchema = createInsertSchema(powSubmissions).omit({
  id: true,
  createdAt: true,
});
export type PowSubmission = typeof powSubmissions.$inferSelect;
export type InsertPowSubmission = z.infer<typeof insertPowSubmissionSchema>;
