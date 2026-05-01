-- Add quinzena column to extra_incomes table
ALTER TABLE extra_incomes
  ADD COLUMN quinzena TEXT NOT NULL DEFAULT '1' CHECK (quinzena IN ('1', '2'));

CREATE INDEX idx_extra_incomes_quinzena ON extra_incomes(user_id, quinzena);
