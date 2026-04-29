-- Table to track monthly payment status for recurring expenses
CREATE TABLE IF NOT EXISTS expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(expense_id, mes, ano)
);

CREATE INDEX idx_expense_payments_expense_id ON expense_payments(expense_id);
CREATE INDEX idx_expense_payments_period ON expense_payments(expense_id, mes, ano);

-- RLS
ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense payments"
  ON expense_payments FOR ALL
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));
