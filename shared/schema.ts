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

export const launches = pgTable("launches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull(),
  supply: integer("supply").notNull(),
  minted: integer("minted").notNull().default(0),
  image: text("image").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming, active, ended
  type: text("type").notNull().default("standard"),
  contractAddress: text("contract_address"),
  features: jsonb("features").notNull().default([]),
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
