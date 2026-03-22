import { pgTable, text, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  walletAddress: text("wallet_address").unique(),
  authNonce: text("auth_nonce"),
  googleId: text("google_id").unique(),
  appleId: text("apple_id").unique(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  authProvider: text("auth_provider").default("local"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  mfaBackupCodes: text("mfa_backup_codes"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true } as any);
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
    contractAddress: "0xfbc620cc04cc73bf443981b1d9f99a03fd5de38d",
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
  zksync: {
    id: "zksync",
    name: "zkSync Era",
    symbol: "ETH",
    icon: "◆",
    color: "#8C8DFC",
    chainId: 324,
    explorer: "https://explorer.zksync.io",
    contractAddress: "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20",
    gasEstimate: "~0.00004 ETH",
    avgGasUnits: 120000,
  },
  dogecoin: {
    id: "dogecoin",
    name: "Dogecoin",
    symbol: "DOGE",
    icon: "🐕",
    color: "#C2A633",
    chainId: 0,
    explorer: "https://dogechain.info",
    contractAddress: "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20",
    gasEstimate: "~1 DOGE",
    avgGasUnits: 0,
  },
  monero: {
    id: "monero",
    name: "Monero",
    symbol: "XMR",
    icon: "ⓜ",
    color: "#FF6600",
    chainId: 0,
    explorer: "https://xmrchain.net",
    contractAddress: "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20",
    gasEstimate: "~0.0001 XMR",
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

  miningFees: {
    gamePlayFee: 0.5,
    claimFee: 0.25,
    feeToken: "SKYNT",
    treasuryReinvestRate: 0.60,
    feeDescription: "Fair play mining fee supports treasury yield and network security",
  },

  yieldTiers: {
    singleStake:     { aprPercent: 24.6, riskScore: 10 },
    liquidityPool:   { aprPercent: 42.8, riskScore: 25 },
    crossChain:      { aprPercent: 68.5, riskScore: 55 },
    poxDelegation:   { aprPercent: 95.2, riskScore: 40 },
  },
} as const;

export type RarityTier = keyof typeof RARITY_TIERS;

export const ACCESS_TIERS = {
  0: {
    name: "Public",
    skyntRequirement: 0,
    description: "No requirements — access to /lab, auth pages",
  },
  1: {
    name: "Explorer",
    skyntRequirement: 10,
    description: "10+ SKYNT — access to Dashboard, Gallery, Analytics",
  },
  2: {
    name: "Miner",
    skyntRequirement: 100,
    nftRequirement: "any",
    description: "100+ SKYNT OR own any NFT — access to Omega Serpent, Bridge, Marketplace",
  },
  3: {
    name: "Oracle",
    skyntRequirement: 500,
    nftRequirement: ["rare", "legendary", "mythic"],
    description: "500+ SKYNT OR own Rare+ NFT — access to Yield Generator, IIT Consciousness",
  },
  4: {
    name: "Architect",
    skyntRequirement: 1000,
    nftRequirement: ["legendary", "mythic"],
    description: "1000+ SKYNT OR own Legendary+ NFT — early access to new drops, Starship page",
  },
} as const;

export type AccessTier = keyof typeof ACCESS_TIERS;

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
} as any);

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

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true } as any);
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
  explorerUrl: text("explorer_url"),
  networkFee: text("network_fee"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true } as any);
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
} as any);

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

export const insertNftSchema = createInsertSchema(nfts).omit({ id: true } as any);
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

export const insertBridgeTransactionSchema = createInsertSchema(bridgeTransactions).omit({ id: true, createdAt: true } as any);
export type BridgeTransaction = typeof bridgeTransactions.$inferSelect;
export type InsertBridgeTransaction = z.infer<typeof insertBridgeTransactionSchema>;

export const guardians = pgTable("guardians", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  guardianIndex: integer("guardian_index").notNull().unique(),
  status: text("status").notNull().default("online"),
  lastSignature: timestamp("last_signature").defaultNow(),
  publicKey: text("public_key"),
});

export const insertGuardianSchema = createInsertSchema(guardians).omit({ id: true } as any);
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

export const insertYieldStrategySchema = createInsertSchema(yieldStrategies).omit({ id: true } as any);
export type YieldStrategy = typeof yieldStrategies.$inferSelect;
export type InsertYieldStrategy = z.infer<typeof insertYieldStrategySchema>;

// ==================== Merge Mining Chains ====================

export const MERGE_MINING_CHAINS = {
  auxpow_btc: {
    id: "auxpow_btc",
    name: "BTC (AuxPoW)",
    symbol: "BTC",
    algorithm: "auxpow",
    color: "#F7931A",
    icon: "₿",
    difficultyFactor: 1.5,
    rewardMultiplier: 0.0001,
    blockTime: 600,
  },
  zkevm: {
    id: "zkevm",
    name: "zkEVM",
    symbol: "ETH",
    algorithm: "zkevm",
    color: "#8247E5",
    icon: "◈",
    difficultyFactor: 0.8,
    rewardMultiplier: 0.005,
    blockTime: 12,
  },
  zksync: {
    id: "zksync",
    name: "ZKsync Era",
    symbol: "ETH",
    algorithm: "zksync",
    color: "#8C8DFC",
    icon: "◆",
    difficultyFactor: 0.7,
    rewardMultiplier: 0.004,
    blockTime: 10,
  },
  wbtc: {
    id: "wbtc",
    name: "Wrapped BTC",
    symbol: "WBTC",
    algorithm: "auxpow",
    color: "#F09242",
    icon: "₩",
    difficultyFactor: 1.2,
    rewardMultiplier: 0.00008,
    blockTime: 300,
  },
  polygon: {
    id: "polygon",
    name: "Polygon PoS",
    symbol: "MATIC",
    algorithm: "zkevm",
    color: "#8247E5",
    icon: "⬡",
    difficultyFactor: 0.6,
    rewardMultiplier: 0.05,
    blockTime: 2,
  },
  solana: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    algorithm: "auxpow",
    color: "#9945FF",
    icon: "◎",
    difficultyFactor: 0.5,
    rewardMultiplier: 0.002,
    blockTime: 0.4,
  },
  randomx: {
    id: "randomx",
    name: "RandomX CPU",
    symbol: "BTC",
    algorithm: "randomx",
    color: "#4D7CFF",
    icon: "⚡",
    difficultyFactor: 4,
    rewardMultiplier: 0.00000625,
    blockTime: 120,
  },
} as const;

export type MergeMiningChainId = keyof typeof MERGE_MINING_CHAINS;

export const RANDOMX_CONFIG = {
  algorithm: "randomx",
  scratchpadSize: 2097152,
  programSize: 256,
  iterationsPerHash: 2048,
  hashTargetTime: 120,
  soloMiningDifficulty: 4,
  blockReward: 0.00000625,
  maxNonceRange: 4294967295,
  cpuThreads: 1,
} as const;

export const STX_LENDING_TIERS = {
  conservative: {
    id: "conservative",
    name: "Conservative",
    aprPercent: 12,
    minStake: 10,
    lockDays: 30,
    riskScore: 15,
    poxBonus: 1.0,
    color: "#22C55E",
    description: "Low-risk PoX delegation yield with STX collateral",
  },
  balanced: {
    id: "balanced",
    name: "Balanced",
    aprPercent: 28,
    minStake: 50,
    lockDays: 90,
    riskScore: 35,
    poxBonus: 1.5,
    color: "#3B82F6",
    description: "Medium-risk cross-chain lending with BTC/STX pair yield",
  },
  aggressive: {
    id: "aggressive",
    name: "Aggressive",
    aprPercent: 45,
    minStake: 200,
    lockDays: 180,
    riskScore: 60,
    poxBonus: 2.2,
    color: "#EF4444",
    description: "High-risk leveraged PoX + cross-chain arbitrage yield",
  },
} as const;

export type StxLendingTierId = keyof typeof STX_LENDING_TIERS;

export const SKYNT_CONTRACT_ADDRESS = "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20";
export const TREASURY_WALLET_ADDRESS = "0x7Fbe68677e63272ECB55355a6778fCee974d4895";

export const ZK_BRIDGE_MINING_CHAINS = ["ethereum", "stacks", "dogecoin", "monero"] as const;
export type ZkBridgeMiningChain = typeof ZK_BRIDGE_MINING_CHAINS[number];

export const ZK_WORMHOLE_CHAINS = {
  ethereum: { id: "ethereum", name: "Ethereum", tunnelColor: "#627EEA", wormholeCapacity: 100, transferFeeBps: 10, proofComplexity: 3 },
  polygon: { id: "polygon", name: "Polygon PoS", tunnelColor: "#8247E5", wormholeCapacity: 200, transferFeeBps: 5, proofComplexity: 2 },
  polygon_zkevm: { id: "polygon_zkevm", name: "Polygon zkEVM", tunnelColor: "#7B3FE4", wormholeCapacity: 250, transferFeeBps: 4, proofComplexity: 2 },
  arbitrum: { id: "arbitrum", name: "Arbitrum", tunnelColor: "#28A0F0", wormholeCapacity: 200, transferFeeBps: 5, proofComplexity: 2 },
  base: { id: "base", name: "Base", tunnelColor: "#0052FF", wormholeCapacity: 200, transferFeeBps: 5, proofComplexity: 2 },
  zksync: { id: "zksync", name: "zkSync Era", tunnelColor: "#8C8DFC", wormholeCapacity: 250, transferFeeBps: 4, proofComplexity: 2 },
  solana: { id: "solana", name: "Solana", tunnelColor: "#9945FF", wormholeCapacity: 300, transferFeeBps: 8, proofComplexity: 3 },
  stacks: { id: "stacks", name: "Stacks", tunnelColor: "#FC6432", wormholeCapacity: 150, transferFeeBps: 8, proofComplexity: 3 },
  skynt: { id: "skynt", name: "SphinxSkynet", tunnelColor: "#FFD700", wormholeCapacity: 500, transferFeeBps: 0, proofComplexity: 1 },
  dogecoin: { id: "dogecoin", name: "Dogecoin", tunnelColor: "#C2A633", wormholeCapacity: 100, transferFeeBps: 12, proofComplexity: 4 },
  monero: { id: "monero", name: "Monero", tunnelColor: "#FF6600", wormholeCapacity: 100, transferFeeBps: 15, proofComplexity: 5 },
} as const;

export type ZkWormholeChainId = keyof typeof ZK_WORMHOLE_CHAINS;

export const STARSHIP_FLIGHT_SHOWCASES = [
  {
    flightId: "ift-1",
    missionName: "Integrated Flight Test 1",
    launchDate: "2023-04-20T13:33:00Z",
    vehicleName: "Starship + Super Heavy (B7/S24)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Alpha", pilot: "Lt. Orion Vex", missionSpecialist: "Dr. Nova Helix", flightEngineer: "Eng. Tau Meridian" },
    objectives: ["Full stack ignition", "Max-Q passage", "Stage separation attempt"],
    outcome: "partial" as const,
    orbit: "Suborbital",
    description: "First integrated flight test. Vehicle cleared the pad but experienced engine failures and was terminated by FTS at T+4:00."
  },
  {
    flightId: "ift-2",
    missionName: "Integrated Flight Test 2",
    launchDate: "2023-11-18T13:03:00Z",
    vehicleName: "Starship + Super Heavy (B9/S25)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Alpha", pilot: "Lt. Kael Stardust", missionSpecialist: "Dr. Lyra Quantum", flightEngineer: "Eng. Tau Meridian" },
    objectives: ["Hot-stage separation", "Booster boostback", "Ship orbital insertion"],
    outcome: "partial" as const,
    orbit: "Suborbital",
    description: "First hot-stage separation achieved. Booster RUD after sep, Ship lost during coast."
  },
  {
    flightId: "ift-3",
    missionName: "Integrated Flight Test 3",
    launchDate: "2024-03-14T13:25:00Z",
    vehicleName: "Starship + Super Heavy (B10/S28)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Beta", pilot: "Lt. Orion Vex", missionSpecialist: "Dr. Nova Helix", flightEngineer: "Eng. Zeta Flux" },
    objectives: ["In-space engine relight", "Propellant transfer demo", "Controlled reentry"],
    outcome: "partial" as const,
    orbit: "Low Earth Orbit",
    description: "Reached space, demonstrated propellant transfer and engine relight. Both vehicles lost during reentry."
  },
  {
    flightId: "ift-4",
    missionName: "Integrated Flight Test 4",
    launchDate: "2024-06-06T12:50:00Z",
    vehicleName: "Starship + Super Heavy (B11/S29)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Beta", pilot: "Lt. Kael Stardust", missionSpecialist: "Dr. Lyra Quantum", flightEngineer: "Eng. Tau Meridian" },
    objectives: ["Booster soft splashdown", "Ship controlled reentry", "Heat shield validation"],
    outcome: "success" as const,
    orbit: "Low Earth Orbit",
    description: "All primary objectives achieved. Booster splashdown in Gulf of Mexico, Ship survived reentry and splashed in Indian Ocean."
  },
  {
    flightId: "ift-5",
    missionName: "Integrated Flight Test 5",
    launchDate: "2024-10-13T12:25:00Z",
    vehicleName: "Starship + Super Heavy (B12/S30)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Gamma", pilot: "Lt. Orion Vex", missionSpecialist: "Dr. Nova Helix", flightEngineer: "Eng. Zeta Flux" },
    objectives: ["Tower catch (Mechazilla)", "Booster return to launch site", "Ship Indian Ocean splashdown"],
    outcome: "success" as const,
    orbit: "Low Earth Orbit",
    description: "Historic first booster catch by Mechazilla chopstick arms. Ship completed controlled splashdown in Indian Ocean."
  },
  {
    flightId: "ift-6",
    missionName: "Integrated Flight Test 6",
    launchDate: "2025-01-16T22:37:00Z",
    vehicleName: "Starship + Super Heavy (B13/S31)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Gamma", pilot: "Lt. Kael Stardust", missionSpecialist: "Dr. Lyra Quantum", flightEngineer: "Eng. Tau Meridian" },
    objectives: ["Second tower catch attempt", "Orbital insertion", "Payload deployment sim"],
    outcome: "partial" as const,
    orbit: "Low Earth Orbit",
    description: "Booster catch aborted due to off-nominal conditions, diverted to Gulf splashdown. Ship reached orbit but lost during reentry."
  },
  {
    flightId: "ift-7",
    missionName: "Integrated Flight Test 7",
    launchDate: "2025-04-13T00:00:00Z",
    vehicleName: "Starship + Super Heavy (B14/S33)",
    vehicleImage: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/starship2520_image_20230420095310.jpeg",
    crew: { commander: "Cmdr. Sphinx-Delta", pilot: "Lt. Orion Vex", missionSpecialist: "Dr. Nova Helix", flightEngineer: "Eng. Zeta Flux" },
    objectives: ["Next-gen heat shield", "Improved Raptor engines", "Payload deployment"],
    outcome: "success" as const,
    orbit: "Low Earth Orbit",
    description: "Major upgrades validated. Next-gen heat shield tiles, improved Raptors, payload deployment simulation successful."
  },
] as const;

export const RARITY_PROOF_FEE = 0.5;

export const CONTRACT_DEFINITIONS = [
  // ─── Core Token & Mining ───────────────────────────────────────────────────
  { contractId: "SKYNTToken", name: "SKYNTToken", description: "SKYNT ERC20 token — 21M max supply, 18 decimals, on Ethereum mainnet at 0xfbc620cc04cc73bf443981b1d9f99a03fd5de38d", gasRange: [50000, 80000], verified: true, address: "0xfbc620cc04cc73bf443981b1d9f99a03fd5de38d" },
  { contractId: "SKYNTMining", name: "SKYNTMining", description: "On-chain keccak256 Proof-of-Work mining contract: submitWork(nonce), claimReward(), dynamic difficulty, halving schedule, cooldowns", gasRange: [80000, 140000], verified: true, address: "" },
  // ─── NFT Contracts ────────────────────────────────────────────────────────
  { contractId: "SpaceFlightNFT", name: "SpaceFlightNFT", description: "Gas-optimized tiered NFT minting with royalties and OpenSea Seaport integration", gasRange: [160000, 240000] },
  { contractId: "RocketBabesNFT", name: "RocketBabesNFT", description: "Cosmic-themed model NFT collection with 33% discount minting, 6 overlay templates, zero platform fees", gasRange: [140000, 220000] },
  { contractId: "RocketGirlsNFT", name: "RocketGirlsNFT", description: "Companion collection to RocketBabes — limited 777 supply, generative art, SKYNT gated minting", gasRange: [130000, 200000] },
  { contractId: "SKYNTGenesisNFT", name: "SKYNTGenesisNFT", description: "Genesis NFT collection — first 100 minters earn 10% mining bonus for life, ERC721A batch minting", gasRange: [120000, 180000] },
  { contractId: "IITConsciousnessNFT", name: "IITConsciousnessNFT", description: "NFT representing IIT consciousness Φ score — dynamic metadata updated on-chain via oracle", gasRange: [150000, 220000] },
  { contractId: "QuantumBerryNFT", name: "QuantumBerryNFT", description: "Berry Phase NFT collection — quantum entanglement-themed ERC1155 with staking integration", gasRange: [140000, 210000] },
  { contractId: "StarshipLaunchNFT", name: "StarshipLaunchNFT", description: "SpaceX Starship launch milestone NFTs — each flight test edition, gated by IIT score", gasRange: [130000, 195000] },
  { contractId: "MiningBadgeNFT", name: "MiningBadgeNFT", description: "Proof-of-Mining badge NFTs — soulbound ERC5192 tokens awarded per mining milestone", gasRange: [90000, 140000] },
  // ─── Bridge & Cross-Chain ─────────────────────────────────────────────────
  { contractId: "SphinxBridge", name: "SphinxBridge", description: "Gas-optimized cross-chain bridge with 5-of-9 guardian multi-sig, ETH ↔ STX ↔ DOGE", gasRange: [180000, 280000] },
  { contractId: "SkynetZkBridge", name: "SkynetZkBridge", description: "zkSync Era cross-chain bridge with zk-SNARK mint proof verification for ETH/STX/DOGE/XMR", gasRange: [100000, 180000] },
  { contractId: "ZkWormhole", name: "ZkWormhole", description: "Per-user ZK-Wormhole cross-chain portal with zk-SNARK proof verification for 11-chain bridging", gasRange: [150000, 250000] },
  { contractId: "SkynetBridge", name: "SkynetBridge", description: "Solana-to-EVM bridge for SKYNT token minting with PoW nonce verification", gasRange: [120000, 190000] },
  { contractId: "PolygonZkBridge", name: "PolygonZkBridge", description: "Polygon zkEVM ↔ Ethereum bridge for SKYNT with Groth16 proof verification", gasRange: [110000, 170000] },
  { contractId: "ArbitrumBridge", name: "ArbitrumBridge", description: "Arbitrum One ↔ Ethereum optimistic bridge with 7-day challenge period and fraud proofs", gasRange: [95000, 150000] },
  { contractId: "BaseBridge", name: "BaseBridge", description: "Base ↔ Ethereum bridge using Optimism stack with SKYNT token support", gasRange: [90000, 140000] },
  { contractId: "CrossChainMessenger", name: "CrossChainMessenger", description: "Generic cross-chain message passing layer using EIP-5164 standard", gasRange: [120000, 180000] },
  // ─── DeFi & Yield ────────────────────────────────────────────────────────
  { contractId: "SphinxYieldAggregator", name: "SphinxYieldAggregator", description: "Multi-chain yield aggregator with zk-proof verification and auto-compounding", gasRange: [200000, 320000] },
  { contractId: "SKYNTStaking", name: "SKYNTStaking", description: "SKYNT token staking with 3/6/12 month lockups, APR tiers, and compounding rewards", gasRange: [120000, 180000] },
  { contractId: "LiquidityPool", name: "LiquidityPool", description: "AMM liquidity pool for SKYNT/ETH and SKYNT/USDC pairs with concentrated liquidity", gasRange: [200000, 320000] },
  { contractId: "YieldVault", name: "YieldVault", description: "ERC4626 tokenized vault for multi-strategy yield optimization across Aave, Compound, and Curve", gasRange: [180000, 280000] },
  { contractId: "STXLendingPool", name: "STXLendingPool", description: "Stacks STX lending pool with SKYNT collateral, cross-chain yield relay", gasRange: [130000, 200000] },
  { contractId: "FeeDistributor", name: "FeeDistributor", description: "Protocol fee collection and distribution to SKYNT stakers (veSKYNT model)", gasRange: [100000, 160000] },
  { contractId: "MerkleDistributor", name: "MerkleDistributor", description: "Merkle-proof airdrop distributor for SKYNT mining rewards and genesis allocations", gasRange: [80000, 120000] },
  // ─── Mining Infrastructure ────────────────────────────────────────────────
  { contractId: "MiningPool", name: "MiningPool", description: "Decentralized mining pool contract — shares proportional rewards among pool participants", gasRange: [150000, 230000] },
  { contractId: "MiningRewardOracle", name: "MiningRewardOracle", description: "Chainlink-powered oracle for off-chain hashrate verification and reward multiplier updates", gasRange: [90000, 140000] },
  { contractId: "DifficultyAdjuster", name: "DifficultyAdjuster", description: "On-chain difficulty retargeting contract with 2016-block intervals using EMA smoothing", gasRange: [70000, 110000] },
  { contractId: "MergeMiningCoordinator", name: "MergeMiningCoordinator", description: "Coordinates merge-mining across BTC/DOGE/XMR chains with auxiliary PoW proof verification", gasRange: [120000, 190000] },
  // ─── ZK / Cryptography ───────────────────────────────────────────────────
  { contractId: "ECDSAVerifier", name: "ECDSAVerifier", description: "zkSNARK proof verification utility for PoW mining bridge cross-chain mints", gasRange: [80000, 120000] },
  { contractId: "SpectralEntropyVerifier", name: "SpectralEntropyVerifier", description: "Groth16 zk-SNARK verifier for spectral entropy proofs with pairing-based verification", gasRange: [90000, 140000] },
  { contractId: "IITPhiVerifier", name: "IITPhiVerifier", description: "zk-SNARK verifier for IIT Φ (phi) score computation proofs — enables on-chain consciousness attestation", gasRange: [100000, 160000] },
  { contractId: "RandomnessBeacon", name: "RandomnessBeacon", description: "VRF-based randomness beacon using Chainlink VRF v2 for NFT trait generation and mining challenges", gasRange: [110000, 170000] },
  { contractId: "CommitReveal", name: "CommitReveal", description: "Commit-reveal scheme for fair NFT reveal with randomness delay protection", gasRange: [60000, 90000] },
  // ─── Governance & DAO ─────────────────────────────────────────────────────
  { contractId: "SKYNTGovernor", name: "SKYNTGovernor", description: "OpenZeppelin Governor contract for SKYNT DAO — proposal creation, voting, timelock execution", gasRange: [200000, 320000] },
  { contractId: "TimelockController", name: "TimelockController", description: "48-hour timelock controller for governance-approved protocol upgrades", gasRange: [120000, 180000] },
  { contractId: "VotingEscrow", name: "VotingEscrow", description: "veSKYNT voting escrow — lock SKYNT for 1-4 years, earn boosted yield and governance power", gasRange: [160000, 240000] },
  // ─── Utilities & Security ─────────────────────────────────────────────────
  { contractId: "MultiSigWallet", name: "MultiSigWallet", description: "5-of-9 treasury multi-sig wallet for SKYNT Protocol fund management", gasRange: [120000, 180000] },
  { contractId: "PaymentSplitter", name: "PaymentSplitter", description: "OpenZeppelin PaymentSplitter for team, treasury, and mining fund allocation", gasRange: [80000, 120000] },
  { contractId: "EmergencyPause", name: "EmergencyPause", description: "Circuit breaker contract with guardian multi-sig for emergency protocol pause", gasRange: [60000, 90000] },
  { contractId: "TokenVesting", name: "TokenVesting", description: "Linear/cliff vesting contract for team and investor SKYNT allocations with revocation", gasRange: [100000, 150000] },
  { contractId: "Whitelist", name: "Whitelist", description: "Merkle-proof whitelist contract for presale and priority minting access control", gasRange: [70000, 100000] },
  { contractId: "RoyaltyRegistry", name: "RoyaltyRegistry", description: "EIP-2981 royalty registry for all SKYNT Protocol NFT collections (10% default)", gasRange: [80000, 120000] },
  { contractId: "MetadataRenderer", name: "MetadataRenderer", description: "On-chain SVG metadata renderer for dynamic NFT attributes based on mining stats and IIT Φ", gasRange: [150000, 220000] },
  { contractId: "ProxyAdmin", name: "ProxyAdmin", description: "OpenZeppelin TransparentUpgradeableProxy admin for protocol contract upgrades", gasRange: [60000, 90000] },
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

export const insertContractDeploymentSchema = createInsertSchema(contractDeployments).omit({ id: true, createdAt: true } as any);
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

export const insertGameScoreSchema = createInsertSchema(gameScores).omit({ id: true, createdAt: true, claimed: true } as any);
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

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({ id: true, createdAt: true, soldAt: true } as any);
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
} as any);
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
} as any);
export type PowSubmission = typeof powSubmissions.$inferSelect;
export type InsertPowSubmission = z.infer<typeof insertPowSubmissionSchema>;

export const zkWormholes = pgTable("zk_wormholes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wormholeId: text("wormhole_id").notNull().unique(),
  status: text("status").notNull().default("dormant"),
  sourceChain: text("source_chain").notNull(),
  destChain: text("dest_chain").notNull(),
  capacity: text("capacity").notNull().default("100"),
  totalTransferred: text("total_transferred").notNull().default("0"),
  transferCount: integer("transfer_count").notNull().default(0),
  phiBoost: text("phi_boost").notNull().default("1.0"),
  zkProofHash: text("zk_proof_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertZkWormholeSchema = createInsertSchema(zkWormholes).omit({ id: true, createdAt: true } as any);
export type ZkWormhole = typeof zkWormholes.$inferSelect;
export type InsertZkWormhole = z.infer<typeof insertZkWormholeSchema>;

export const zkWormholeTransfers = pgTable("zk_wormhole_transfers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  wormholeId: integer("wormhole_id").notNull().references(() => zkWormholes.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceChain: text("source_chain").notNull(),
  destChain: text("dest_chain").notNull(),
  amount: text("amount").notNull(),
  token: text("token").notNull().default("SKYNT"),
  status: text("status").notNull().default("pending"),
  zkProofHash: text("zk_proof_hash"),
  guardianSigs: integer("guardian_sigs").notNull().default(0),
  txHash: text("tx_hash"),
  externalRecipient: text("external_recipient"),
  onChainTxHash: text("on_chain_tx_hash"),
  explorerUrl: text("explorer_url"),
  transmitStatus: text("transmit_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertZkWormholeTransferSchema = createInsertSchema(zkWormholeTransfers).omit({ id: true, createdAt: true } as any);
export type ZkWormholeTransfer = typeof zkWormholeTransfers.$inferSelect;
export type InsertZkWormholeTransfer = z.infer<typeof insertZkWormholeTransferSchema>;

export const rarityCertificates = pgTable("rarity_certificates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nftId: integer("nft_id").notNull().references(() => nfts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  certificateId: text("certificate_id").notNull().unique(),
  rarityScore: integer("rarity_score").notNull(),
  rarityPercentile: text("rarity_percentile").notNull(),
  zkProofHash: text("zk_proof_hash").notNull(),
  verificationKeyHash: text("verification_key_hash").notNull(),
  phiBoost: text("phi_boost").notNull().default("1.0"),
  fee: text("fee").notNull().default("0.5"),
  status: text("status").notNull().default("valid"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRarityCertificateSchema = createInsertSchema(rarityCertificates).omit({ id: true, createdAt: true } as any);
export type RarityCertificate = typeof rarityCertificates.$inferSelect;
export type InsertRarityCertificate = z.infer<typeof insertRarityCertificateSchema>;

export const rocketBabeModels = pgTable("rocket_babe_models", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio").default(""),
  avatarUrl: text("avatar_url"),
  socialLinks: jsonb("social_links").default({}),
  tier: text("tier").notNull().default("rising"),
  approved: boolean("approved").notNull().default(false),
  totalMints: integer("total_mints").notNull().default(0),
  totalEarnings: text("total_earnings").notNull().default("0"),
  revenueSharePct: integer("revenue_share_pct").notNull().default(70),
  perks: jsonb("perks").default([]),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRocketBabeModelSchema = createInsertSchema(rocketBabeModels).omit({ id: true, createdAt: true } as any);
export type RocketBabeModel = typeof rocketBabeModels.$inferSelect;
export type InsertRocketBabeModel = z.infer<typeof insertRocketBabeModelSchema>;

export const MODEL_TIERS = {
  rising: { label: "Rising Star", color: "#39ff14", minMints: 0, revShare: 70, perks: ["33% mint discount", "Zero gas fees", "OpenSea auto-list"] },
  verified: { label: "Verified Babe", color: "#00f3ff", minMints: 5, revShare: 75, perks: ["33% mint discount", "Zero gas fees", "OpenSea auto-list", "Priority support", "Custom template access"] },
  elite: { label: "Elite Model", color: "#ff2d78", minMints: 25, revShare: 80, perks: ["33% mint discount", "Zero gas fees", "OpenSea auto-list", "Priority support", "Custom template access", "Featured collection slot", "Promotional boost"] },
  legendary: { label: "Legendary Icon", color: "#ffd700", minMints: 100, revShare: 85, perks: ["33% mint discount", "Zero gas fees", "OpenSea auto-list", "Priority support", "Custom template access", "Featured collection slot", "Promotional boost", "Exclusive drops", "Revenue dashboard", "Brand partnerships"] },
} as const;

export type ModelTierId = keyof typeof MODEL_TIERS;

// ==================== Airdrops ====================

export const airdrops = pgTable("airdrops", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tokenAmount: text("token_amount").notNull(),
  totalSupply: integer("total_supply").notNull(),
  claimedCount: integer("claimed_count").notNull().default(0),
  eligibilityType: text("eligibility_type").notNull().default("all"),
  minSkynt: text("min_skynt").notNull().default("0"),
  minNfts: integer("min_nfts").notNull().default(0),
  requiredChain: text("required_chain"),
  status: text("status").notNull().default("upcoming"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAirdropSchema = createInsertSchema(airdrops).omit({ id: true, claimedCount: true, createdAt: true } as any);
export type Airdrop = typeof airdrops.$inferSelect;
export type InsertAirdrop = z.infer<typeof insertAirdropSchema>;

export const airdropClaims = pgTable("airdrop_claims", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  airdropId: integer("airdrop_id").notNull().references(() => airdrops.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  amountClaimed: text("amount_claimed").notNull(),
  txHash: text("tx_hash"),
  claimedAt: timestamp("claimed_at").defaultNow(),
});

export const insertAirdropClaimSchema = createInsertSchema(airdropClaims).omit({ id: true, claimedAt: true } as any);
export type AirdropClaim = typeof airdropClaims.$inferSelect;
export type InsertAirdropClaim = z.infer<typeof insertAirdropClaimSchema>;

// ==================== KYC ====================

export const KYC_STATUSES = ["pending", "under_review", "approved", "rejected"] as const;
export type KycStatus = typeof KYC_STATUSES[number];

export const KYC_ID_TYPES = ["passport", "drivers_license", "national_id", "residence_permit"] as const;
export type KycIdType = typeof KYC_ID_TYPES[number];

export const kycSubmissions = pgTable("kyc_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nationality: text("nationality").notNull(),
  country: text("country").notNull(),
  address: text("address").notNull(),
  idType: text("id_type").notNull(),
  idNumber: text("id_number").notNull(),
  idFrontUrl: text("id_front_url"),
  idBackUrl: text("id_back_url"),
  selfieUrl: text("selfie_url"),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKycSubmissionSchema = createInsertSchema(kycSubmissions).omit({
  id: true,
  status: true,
  reviewNotes: true,
  reviewedBy: true,
  reviewedAt: true,
  submittedAt: true,
  updatedAt: true,
} as any);
export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type InsertKycSubmission = z.infer<typeof insertKycSubmissionSchema>;

// ==================== GOVERNANCE ====================

export const PROPOSAL_STATUSES = ["active", "passed", "rejected", "executed", "cancelled"] as const;
export type ProposalStatus = typeof PROPOSAL_STATUSES[number];

export const PROPOSAL_CATEGORIES = ["protocol", "treasury", "parameter", "upgrade", "community"] as const;
export type ProposalCategory = typeof PROPOSAL_CATEGORIES[number];

export const governanceProposals = pgTable("governance_proposals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("protocol"),
  status: text("status").notNull().default("active"),
  proposerId: integer("proposer_id").notNull().references(() => users.id),
  proposerAddress: text("proposer_address"),
  votesFor: integer("votes_for").notNull().default(0),
  votesAgainst: integer("votes_against").notNull().default(0),
  votesAbstain: integer("votes_abstain").notNull().default(0),
  quorumRequired: integer("quorum_required").notNull().default(100),
  timelockHours: integer("timelock_hours").notNull().default(48),
  executionHash: text("execution_hash"),
  endsAt: timestamp("ends_at").notNull(),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGovernanceProposalSchema = createInsertSchema(governanceProposals).omit({
  id: true,
  votesFor: true,
  votesAgainst: true,
  votesAbstain: true,
  executedAt: true,
  createdAt: true,
} as any);
export type GovernanceProposal = typeof governanceProposals.$inferSelect;
export type InsertGovernanceProposal = z.infer<typeof insertGovernanceProposalSchema>;

export const VOTE_CHOICES = ["for", "against", "abstain"] as const;
export type VoteChoice = typeof VOTE_CHOICES[number];

export const governanceVotes = pgTable("governance_votes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  proposalId: integer("proposal_id").notNull().references(() => governanceProposals.id),
  voterId: integer("voter_id").notNull().references(() => users.id),
  choice: text("choice").notNull(),
  weight: integer("weight").notNull().default(1),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGovernanceVoteSchema = createInsertSchema(governanceVotes).omit({
  id: true,
  createdAt: true,
} as any);
export type GovernanceVote = typeof governanceVotes.$inferSelect;
export type InsertGovernanceVote = z.infer<typeof insertGovernanceVoteSchema>;

export const btcZkEpochs = pgTable("btc_zk_epochs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  epoch: integer("epoch").notNull(),
  spectralHash: text("spectral_hash").notNull(),
  quantumGaps: text("quantum_gaps").notNull(),
  chainCorr: real("chain_corr").notNull().default(0),
  latticeCorr: real("lattice_corr").notNull().default(0),
  valknutXi: real("valknut_xi"),
  berryPhase: real("berry_phase"),
  dysonFactor: real("dyson_factor"),
  specCube: real("spec_cube"),
  qFib: real("q_fib"),
  xiPassed: boolean("xi_passed").default(false),
  xiPassCount: integer("xi_pass_count").default(0),
  bestXiEpoch: real("best_xi_epoch"),
  btcBlockHeight: integer("btc_block_height"),
  btcPrevHash: text("btc_prev_hash"),
  btcMerkleRoot: text("btc_merkle_root"),
  moneroSeedHash: text("monero_seed_hash"),
  zkSyncAnchor: text("zk_sync_anchor"),
  auxpowHash: text("auxpow_hash"),
  auxpowNonce: integer("auxpow_nonce"),
  difficulty: real("difficulty"),
  networkDifficulty: real("network_difficulty"),
  mempoolFeeRate: real("mempool_fee_rate"),
  stxYieldRouted: real("stx_yield_routed").default(0),
  gasFundedEpoch: real("gas_funded_epoch").default(0),
  wormholeTransferId: text("wormhole_transfer_id"),
  // Spectral PoW fields
  spectralPeakBin: integer("spectral_peak_bin"),
  spectralPeakMagnitude: real("spectral_peak_magnitude"),
  spectralCurveScalar: text("spectral_curve_scalar"),
  spectralIsValid: boolean("spectral_is_valid").default(false),
  spectralEntropy: real("spectral_entropy"),
  // ECRECOVER proof
  ecrecoverMessageHash: text("ecrecover_message_hash"),
  ecrecoverV: integer("ecrecover_v"),
  ecrecoverR: text("ecrecover_r"),
  ecrecoverS: text("ecrecover_s"),
  ecrecoverAddress: text("ecrecover_address"),
  status: text("status").notNull().default("running"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBtcZkEpochSchema = createInsertSchema(btcZkEpochs).omit({
  id: true,
  createdAt: true,
} as any);
export type BtcZkEpochRow = typeof btcZkEpochs.$inferSelect;
export type InsertBtcZkEpoch = z.infer<typeof insertBtcZkEpochSchema>;

// ─── Spectral PoW Proofs ──────────────────────────────────────────────────────

export const spectralPowProofs = pgTable("spectral_pow_proofs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  epoch: integer("epoch").notNull(),
  btcBlockHeight: integer("btc_block_height").notNull(),
  peakBin: integer("peak_bin").notNull(),
  peakMagnitude: real("peak_magnitude").notNull(),
  peakPhase: real("peak_phase").notNull(),
  spectralEntropy: real("spectral_entropy").notNull(),
  curveScalar: text("curve_scalar").notNull(),
  heightBinding: text("height_binding").notNull(),
  isValid: boolean("is_valid").default(false),
  entropySource: text("entropy_source").notNull(),
  dftBins: text("dft_bins"),
  ecrecoverMessageHash: text("ecrecover_message_hash"),
  ecrecoverV: integer("ecrecover_v"),
  ecrecoverR: text("ecrecover_r"),
  ecrecoverS: text("ecrecover_s"),
  ecrecoverAddress: text("ecrecover_address"),
  soundnessVerified: boolean("soundness_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSpectralPowProofSchema = createInsertSchema(spectralPowProofs).omit({
  id: true,
  createdAt: true,
} as any);
export type SpectralPowProofRow = typeof spectralPowProofs.$inferSelect;
export type InsertSpectralPowProof = z.infer<typeof insertSpectralPowProofSchema>;

// ─── Gas Funding Events (OIYE Self-Fund Sentinel) ────────────────────────────

export const gasFundingEvents = pgTable("gas_funding_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  epoch: integer("epoch"),
  triggerReason: text("trigger_reason").notNull(),
  fundingMethod: text("funding_method").notNull(),
  ethFunded: real("eth_funded").default(0),
  stxConverted: real("stx_converted").default(0),
  gasBefore: real("gas_before"),
  gasAfter: real("gas_after"),
  reserveBalance: real("reserve_balance").default(0),
  yieldAllocated: real("yield_allocated").default(0),
  phase: text("phase").notNull().default("bootstrap"),
  status: text("status").notNull().default("executed"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGasFundingEventSchema = createInsertSchema(gasFundingEvents).omit({
  id: true,
  createdAt: true,
} as any);
export type GasFundingEventRow = typeof gasFundingEvents.$inferSelect;
export type InsertGasFundingEvent = z.infer<typeof insertGasFundingEventSchema>;

export const yieldPositions = pgTable("yield_positions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  strategyId: text("strategy_id").notNull(),
  amountStaked: real("amount_staked").notNull(),
  accruedRewards: real("accrued_rewards").notNull().default(0),
  stakedAt: timestamp("staked_at").defaultNow(),
  lastRewardAt: timestamp("last_reward_at").defaultNow(),
  status: text("status").notNull().default("active"),
  txHash: text("tx_hash"),
});

export const insertYieldPositionSchema = createInsertSchema(yieldPositions).omit({
  id: true,
  stakedAt: true,
  lastRewardAt: true,
} as any);
export type YieldPosition = typeof yieldPositions.$inferSelect;
export type InsertYieldPosition = z.infer<typeof insertYieldPositionSchema>;
