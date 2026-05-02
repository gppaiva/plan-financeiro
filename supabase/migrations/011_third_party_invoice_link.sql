-- Link third-party expenses to invoice items for value return on delete
ALTER TABLE third_party_expenses
  ADD COLUMN IF NOT EXISTS source_invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_third_party_source_invoice
  ON third_party_expenses(source_invoice_item_id)
  WHERE source_invoice_item_id IS NOT NULL;
