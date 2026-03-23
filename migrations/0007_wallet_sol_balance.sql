-- Add Solana balance column to wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS balance_sol TEXT NOT NULL DEFAULT '0';
