-- Task #6: Admin Engine Console & Price Target Control
-- protocol_settings: hot-reload config for all protocol engines
CREATE TABLE IF NOT EXISTS protocol_settings (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        TEXT    NOT NULL UNIQUE,
  value      TEXT    NOT NULL,
  updated_by TEXT    NOT NULL DEFAULT 'system',
  user_id    INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add user_id column if upgrading from earlier schema (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'protocol_settings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE protocol_settings ADD COLUMN user_id INTEGER;
  END IF;
END;
$$;

-- Seed default price driver settings (idempotent)
INSERT INTO protocol_settings (key, value, updated_by) VALUES
  ('price_driver.target_price_usd',  '0.65',   'system'),
  ('price_driver.burn_ratio',        '0.3',    'system'),
  ('price_driver.max_eth_per_epoch', '0.005',  'system'),
  ('price_driver.epoch_interval_ms', '300000', 'system'),
  ('iit_engine.enabled',             'true',   'system'),
  ('p2p_network.enabled',            'true',   'system'),
  ('treasury_yield.enabled',         'true',   'system'),
  ('btc_zk_daemon.enabled',          'true',   'system'),
  ('self_fund_sentinel.enabled',     'true',   'system'),
  ('dyson_sphere.enabled',           'true',   'system')
ON CONFLICT (key) DO NOTHING;

-- admin_action_log: tracks all admin actions including settings changes
CREATE TABLE IF NOT EXISTS admin_action_log (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER,
  username   TEXT    NOT NULL DEFAULT 'system',
  action     TEXT    NOT NULL,
  detail     TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_created_at
  ON admin_action_log (created_at DESC);
