-- ============================================================================
-- Monthly Payment Profile Migration
-- ============================================================================
-- 1. Add dia_pagamento_mensal column to user_profiles
-- 2. Make expenses.quinzena nullable
-- 3. Make extra_incomes.quinzena nullable
-- ============================================================================

-- ── 1. Add dia_pagamento_mensal to user_profiles ───────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS dia_pagamento_mensal INTEGER CHECK (
    dia_pagamento_mensal IS NULL OR (dia_pagamento_mensal BETWEEN 1 AND 31)
  );

-- ── 2. Make expenses.quinzena nullable ─────────────────────────────────────

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_quinzena_check;
ALTER TABLE expenses ALTER COLUMN quinzena DROP NOT NULL;
ALTER TABLE expenses ADD CONSTRAINT expenses_quinzena_check
  CHECK (quinzena IS NULL OR quinzena IN ('1', '2'));

-- ── 3. Make extra_incomes.quinzena nullable ────────────────────────────────

ALTER TABLE extra_incomes DROP CONSTRAINT IF EXISTS extra_incomes_quinzena_check;
ALTER TABLE extra_incomes ALTER COLUMN quinzena DROP NOT NULL;
ALTER TABLE extra_incomes ADD CONSTRAINT extra_incomes_quinzena_check
  CHECK (quinzena IS NULL OR quinzena IN ('1', '2'));
