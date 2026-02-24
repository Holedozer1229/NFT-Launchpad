import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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

export { conversations, messages } from "./models/chat";
