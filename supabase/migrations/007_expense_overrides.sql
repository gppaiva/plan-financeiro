-- Table to store monthly field overrides for recurring expenses
CREATE TABLE IF NOT EXISTS expense_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  valor NUMERIC(12,2),
  descricao VARCHAR(255),
  categoria TEXT,
  quinzena TEXT CHECK (quinzena IN ('1', '2')),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(expense_id, mes, ano)
);

CREATE INDEX idx_expense_overrides_expense_id ON expense_overrides(expense_id);
CREATE INDEX idx_expense_overrides_period ON expense_overrides(expense_id, mes, ano);

-- RLS
ALTER TABLE expense_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense overrides"
  ON expense_overrides FOR ALL
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));
