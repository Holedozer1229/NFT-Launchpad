-- Migration: Add explorer_url and network_fee columns to wallet_transactions
-- Applied: 2026-03-21
-- Description: Stores on-chain explorer URL and estimated network fee for
--              ETH and STX sends executed via real treasury broadcast.

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS explorer_url text,
  ADD COLUMN IF NOT EXISTS network_fee text;
