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
    gasEstimate: "~0.008 ETH",
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
    gasEstimate: "~0.01 MATIC",
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
    gasEstimate: "~0.0003 ETH",
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
    gasEstimate: "~0.5 STX",
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
    gasEstimate: "~0.0002 ETH",
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
  },
} as const;

export type ChainId = keyof typeof SUPPORTED_CHAINS;

export const RARITY_TIERS = {
  mythic: { label: "Mythic", supply: 1, color: "magenta", price: "100 ETH" },
  legendary: { label: "Legendary", supply: 3, color: "orange", price: "1.0 ETH" },
  rare: { label: "Rare", supply: 6, color: "cyan", price: "0.5 ETH" },
  common: { label: "Common", supply: 90, color: "green", price: "0.1 ETH" },
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
  walletAddress: text("wallet_address").notNull(),
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

export { conversations, messages } from "./models/chat";
