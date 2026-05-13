-- Tabela de devedores
CREATE TABLE debtors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pagamentos parciais
CREATE TABLE debtor_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their debtors" ON debtors
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage payments of their debtors" ON debtor_payments
  FOR ALL USING (debtor_id IN (SELECT id FROM debtors WHERE user_id = auth.uid()));
