-- ============================================================================
-- Invoice Items Migration
-- ============================================================================
-- Creates the invoice_items table for storing individual credit card
-- invoice line items linked to expenses of category "Cartão".
-- Includes constraints, index, and RLS policies.
-- ============================================================================

-- ── 1. invoice_items table ─────────────────────────────────────────────────

CREATE TABLE invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id    UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  data_compra   DATE NOT NULL,
  descricao     VARCHAR(255) NOT NULL,
  categoria_c6  VARCHAR(100) NOT NULL DEFAULT '',
  parcela       VARCHAR(50) NOT NULL DEFAULT 'Única',
  valor         NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_expense_id ON invoice_items(expense_id);

-- ── 2. Row Level Security ──────────────────────────────────────────────────

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice items"
  ON invoice_items FOR SELECT
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own invoice items"
  ON invoice_items FOR INSERT
  WITH CHECK (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update own invoice items"
  ON invoice_items FOR UPDATE
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ))
  WITH CHECK (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own invoice items"
  ON invoice_items FOR DELETE
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));
