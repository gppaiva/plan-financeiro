-- Add quinzena value columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS quinzena_1_valor NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quinzena_1_valor >= 0),
  ADD COLUMN IF NOT EXISTS quinzena_2_valor NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quinzena_2_valor >= 0);
