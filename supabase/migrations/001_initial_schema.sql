-- ============================================================================
-- Financial Planner - Initial Schema Migration
-- ============================================================================
-- Creates 6 tables: user_profiles, expenses, third_party_expenses,
-- investment_accounts, investment_transactions, extra_incomes
-- Includes constraints (CHECK, NOT NULL, FK), indexes, and RLS policies
-- ============================================================================

-- ── 1. user_profiles ─────────────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  nome            VARCHAR(100) NOT NULL,
  salario_liquido NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (salario_liquido >= 0),
  dia_pagamento_1 INTEGER NOT NULL DEFAULT 5 CHECK (dia_pagamento_1 BETWEEN 1 AND 31),
  dia_pagamento_2 INTEGER NOT NULL DEFAULT 20 CHECK (dia_pagamento_2 BETWEEN 1 AND 31),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

-- ── 2. expenses ──────────────────────────────────────────────────────────────

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  descricao       VARCHAR(255) NOT NULL,
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  categoria       TEXT NOT NULL CHECK (categoria IN (
                    'Alimentação', 'Transporte', 'Educação', 'Lazer',
                    'Saúde', 'Moradia', 'Cartão', 'Utilidades', 'Outros'
                  )),
  data_vencimento DATE NOT NULL,
  quinzena        TEXT NOT NULL CHECK (quinzena IN ('1', '2')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  recorrente      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_data_vencimento ON expenses(data_vencimento);
CREATE INDEX idx_expenses_user_status ON expenses(user_id, status);
CREATE INDEX idx_expenses_user_quinzena ON expenses(user_id, quinzena);

-- ── 3. third_party_expenses ──────────────────────────────────────────────────

CREATE TABLE third_party_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  pessoa          VARCHAR(100) NOT NULL,
  descricao       VARCHAR(255) NOT NULL,
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_vencimento DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_third_party_expenses_user_id ON third_party_expenses(user_id);
CREATE INDEX idx_third_party_expenses_pessoa ON third_party_expenses(user_id, pessoa);

-- ── 4. investment_accounts ───────────────────────────────────────────────────

CREATE TABLE investment_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  tipo        VARCHAR(50) NOT NULL,
  saldo_atual NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (saldo_atual >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investment_accounts_user_id ON investment_accounts(user_id);

-- ── 5. investment_transactions ───────────────────────────────────────────────

CREATE TABLE investment_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id   UUID NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('aporte', 'resgate')),
  valor      NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data       DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investment_transactions_conta_id ON investment_transactions(conta_id);
CREATE INDEX idx_investment_transactions_data ON investment_transactions(data);

-- ── 6. extra_incomes ─────────────────────────────────────────────────────────

CREATE TABLE extra_incomes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  descricao  VARCHAR(255) NOT NULL,
  valor      NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data       DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extra_incomes_user_id ON extra_incomes(user_id);
CREATE INDEX idx_extra_incomes_data ON extra_incomes(data);

-- ============================================================================
-- Updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have the column
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_third_party_expenses_updated_at
  BEFORE UPDATE ON third_party_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_investment_accounts_updated_at
  BEFORE UPDATE ON investment_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
-- All tables have RLS enabled. Policies ensure users can only access
-- their own data by matching auth.uid() to the auth_user_id / user_id chain.
-- ============================================================================

-- ── Enable RLS on all tables ─────────────────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_incomes ENABLE ROW LEVEL SECURITY;

-- ── user_profiles policies ───────────────────────────────────────────────────

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  USING (auth_user_id = auth.uid());

-- ── expenses policies ────────────────────────────────────────────────────────

CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

-- ── third_party_expenses policies ────────────────────────────────────────────

CREATE POLICY "Users can view own third party expenses"
  ON third_party_expenses FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own third party expenses"
  ON third_party_expenses FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own third party expenses"
  ON third_party_expenses FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own third party expenses"
  ON third_party_expenses FOR DELETE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

-- ── investment_accounts policies ─────────────────────────────────────────────

CREATE POLICY "Users can view own investment accounts"
  ON investment_accounts FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own investment accounts"
  ON investment_accounts FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own investment accounts"
  ON investment_accounts FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own investment accounts"
  ON investment_accounts FOR DELETE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

-- ── investment_transactions policies ─────────────────────────────────────────
-- Access is controlled through the parent investment_accounts table

CREATE POLICY "Users can view own investment transactions"
  ON investment_transactions FOR SELECT
  USING (conta_id IN (
    SELECT ia.id FROM investment_accounts ia
    JOIN user_profiles up ON up.id = ia.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own investment transactions"
  ON investment_transactions FOR INSERT
  WITH CHECK (conta_id IN (
    SELECT ia.id FROM investment_accounts ia
    JOIN user_profiles up ON up.id = ia.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update own investment transactions"
  ON investment_transactions FOR UPDATE
  USING (conta_id IN (
    SELECT ia.id FROM investment_accounts ia
    JOIN user_profiles up ON up.id = ia.user_id
    WHERE up.auth_user_id = auth.uid()
  ))
  WITH CHECK (conta_id IN (
    SELECT ia.id FROM investment_accounts ia
    JOIN user_profiles up ON up.id = ia.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own investment transactions"
  ON investment_transactions FOR DELETE
  USING (conta_id IN (
    SELECT ia.id FROM investment_accounts ia
    JOIN user_profiles up ON up.id = ia.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

-- ── extra_incomes policies ───────────────────────────────────────────────────

CREATE POLICY "Users can view own extra incomes"
  ON extra_incomes FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own extra incomes"
  ON extra_incomes FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own extra incomes"
  ON extra_incomes FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own extra incomes"
  ON extra_incomes FOR DELETE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));
