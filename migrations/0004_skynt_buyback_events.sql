CREATE TABLE IF NOT EXISTS skynt_buyback_events (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  eth_spent real NOT NULL,
  skynt_bought real NOT NULL,
  skynt_burned real NOT NULL DEFAULT 0,
  price_before_usd real NOT NULL,
  price_after_usd real NOT NULL,
  impact_bps integer NOT NULL DEFAULT 0,
  tx_hash_swap text,
  tx_hash_burn text,
  pool_fee integer,
  status text NOT NULL DEFAULT 'success',
  created_at timestamp DEFAULT NOW()
);
