import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '../shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Please add a database integration.");
}

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isProduction ? 20 : 5,
  idleTimeoutMillis: isProduction ? 30_000 : 10_000,
  connectionTimeoutMillis: 5_000,
  ...(isProduction && process.env.DATABASE_URL.includes("sslmode=require") ? {} : {}),
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });
