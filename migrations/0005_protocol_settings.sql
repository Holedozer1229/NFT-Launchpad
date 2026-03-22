CREATE TABLE IF NOT EXISTS protocol_settings (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  user_id integer,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamp DEFAULT now()
);
