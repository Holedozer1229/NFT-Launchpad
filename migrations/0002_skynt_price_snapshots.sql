-- Task #4: SKYNT price history snapshots table
CREATE TABLE IF NOT EXISTS skynt_price_snapshots (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  price_eth            REAL    NOT NULL,
  price_usd            REAL    NOT NULL,
  eth_price_usd        REAL    NOT NULL,
  pool_fee             INTEGER NOT NULL,
  treasury_eth_balance REAL    NOT NULL DEFAULT 0,
  epoch_number         INTEGER NOT NULL,
  eth_spent            REAL    NOT NULL DEFAULT 0,
  skynt_bought         REAL    NOT NULL DEFAULT 0,
  created_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skynt_price_snapshots_created_at
  ON skynt_price_snapshots (created_at DESC);

-- Add new columns if table already exists (idempotent upgrade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skynt_price_snapshots' AND column_name = 'eth_spent'
  ) THEN
    ALTER TABLE skynt_price_snapshots ADD COLUMN eth_spent REAL NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skynt_price_snapshots' AND column_name = 'skynt_bought'
  ) THEN
    ALTER TABLE skynt_price_snapshots ADD COLUMN skynt_bought REAL NOT NULL DEFAULT 0;
  END IF;
END;
$$;
