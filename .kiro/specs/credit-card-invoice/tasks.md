# Plano de Implementação: Importação de Fatura de Cartão de Crédito

## Visão Geral

Implementação da importação de faturas de cartão de crédito (CSV C6 e ZIP) no planejador financeiro. A implementação é incremental: migração SQL → tipo TypeScript → parser CSV → schema Zod → service Supabase → modais UI → integração na TransactionsPage. Segue os padrões existentes do projeto (inline styles, Modal existente, Zod, Supabase, Zustand). Requer instalação do JSZip para extração de arquivos ZIP.

## Tasks

- [ ] 1. Criar migração SQL e instalar dependência JSZip
  - [-] 1.1 Criar `supabase/migrations/010_invoice_items.sql` com a tabela `invoice_items`
    - Criar tabela com campos: id (UUID PK), expense_id (UUID FK → expenses ON DELETE CASCADE), data_compra (DATE NOT NULL), descricao (VARCHAR 255 NOT NULL), categoria_c6 (VARCHAR 100 NOT NULL DEFAULT ''), parcela (VARCHAR 50 NOT NULL DEFAULT 'Única'), valor (NUMERIC 12,2 NOT NULL CHECK valor > 0), created_at (TIMESTAMPTZ NOT NULL DEFAULT now())
    - Criar índice `idx_invoice_items_expense_id` no campo expense_id
    - Habilitar RLS na tabela
    - Criar policies SELECT, INSERT, UPDATE, DELETE com join via expenses → user_profiles → auth.uid()
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 10.3_

  - [x] 1.2 Instalar JSZip como dependência de produção
    - Executar `npm install jszip` para adicionar ao projeto
    - _Requisitos: 2.1 (suporte a .zip)_

- [ ] 2. Adicionar tipo InvoiceItem e criar parser CSV C6
  - [ ] 2.1 Adicionar interface `InvoiceItem` em `src/types/index.ts`
    - Adicionar interface com campos: id, expense_id, data_compra, descricao, categoria_c6, parcela, valor, created_at (todos string/number conforme design)
    - _Requisitos: 7.1_

  - [ ] 2.2 Criar `src/lib/invoice-csv-parser.ts` com o parser CSV C6
    - Exportar interfaces `C6InvoiceItem`, `C6ParseResult`, `C6ParseOutcome`
    - Implementar `parseC6Csv(content: string): C6ParseOutcome` — separador `;`, ignora cabeçalho, exclui valores negativos, ignora linhas inválidas, converte datas DD/MM/YYYY → ISO, converte valores com vírgula decimal, faz trim em campos string
    - Implementar `prettyPrintC6Csv(items: C6InvoiceItem[]): string` — converte itens de volta para formato CSV C6
    - Implementar `extractCsvFromZip(zipData: ArrayBuffer): Promise<string>` — usa JSZip para extrair primeiro .csv do ZIP
    - Retornar erro descritivo para arquivo vazio, sem linhas válidas, formato inválido
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.2, 9.4_

  - [ ]* 2.3 Escrever teste de propriedade: round-trip do parser CSV C6
    - **Propriedade 1: Round-trip do parser CSV C6**
    - **Valida: Requisitos 3.2, 3.3, 3.4, 3.7, 3.8**
    - Criar `src/lib/invoice-csv-parser.test.ts`
    - Usar `fast-check` para gerar listas aleatórias de `C6InvoiceItem` e verificar que `parse(prettyPrint(items))` produz lista equivalente

  - [ ]* 2.4 Escrever teste de propriedade: valores negativos excluídos
    - **Propriedade 2: Valores negativos são excluídos pelo parser**
    - **Valida: Requisitos 3.5**
    - Gerar CSV com mix de valores positivos e negativos, verificar que resultado contém apenas itens com valorBrl > 0

  - [ ]* 2.5 Escrever teste de propriedade: resiliência a linhas inválidas
    - **Propriedade 7: Resiliência do parser a linhas inválidas**
    - **Valida: Requisitos 9.1**
    - Gerar CSV com mix de linhas válidas e inválidas, verificar que apenas linhas válidas são retornadas

  - [ ]* 2.6 Escrever testes unitários para o parser
    - Testar parsing de CSV válido com dados reais do C6
    - Testar arquivo vazio, sem linhas válidas, formato inválido
    - Testar extração de CSV de arquivo ZIP
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.1, 9.2, 9.4_

- [ ] 3. Checkpoint - Verificar parser e testes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Criar schema Zod e service de fatura
  - [ ] 4.1 Criar `src/schemas/invoice.schema.ts` com schemas de validação
    - Implementar `invoiceItemSchema` com validação de dataCompra (regex ISO), descricao (min 1, max 255), categoriaC6 (max 100), parcela (max 50), valorBrl (positive)
    - Implementar `invoiceImportSchema` com validação de dataVencimento (regex ISO) e quinzena (enum '1'|'2' nullish)
    - Exportar tipos `InvoiceItemFormData` e `InvoiceImportFormData`
    - Seguir padrão de `src/schemas/expense.schema.ts`
    - _Requisitos: 6.5, 8.1, 8.3_

  - [ ] 4.2 Criar `src/services/invoice.service.ts` com funções CRUD
    - Implementar `createInvoice(userId, data)` — cria expense categoria "Cartão" + insere items em batch, com rollback manual (deleta expense se items falharem)
    - Implementar `listInvoiceItems(expenseId)` — lista itens ordenados por data_compra ASC
    - Implementar `updateInvoiceItem(itemId, expenseId, newValor)` — atualiza valor do item e recalcula total da expense via SUM
    - Implementar `hasInvoiceItems(expenseId)` — verifica se expense tem itens vinculados
    - Seguir padrão de `src/services/expenses.service.ts` (uso do supabase client, throw Error)
    - _Requisitos: 4.1, 4.2, 4.3, 4.5, 5.1, 5.4, 6.2, 6.3, 6.4, 9.3, 10.1_

  - [ ]* 4.3 Escrever teste de propriedade: invariante do total da fatura
    - **Propriedade 3: Invariante do total da fatura**
    - **Valida: Requisitos 4.1, 6.3**
    - Gerar listas de valores positivos e verificar que soma dos itens é igual ao total da fatura

  - [ ]* 4.4 Escrever teste de propriedade: preservação da contagem de itens
    - **Propriedade 4: Preservação da contagem de itens**
    - **Valida: Requisitos 4.3**
    - Verificar que N itens do parsing produzem exatamente N registros

  - [ ]* 4.5 Escrever teste de propriedade: ordenação dos itens por data
    - **Propriedade 5: Ordenação dos itens por data**
    - **Valida: Requisitos 5.4**
    - Gerar listas de itens com datas aleatórias e verificar que listInvoiceItems retorna em ordem crescente

- [ ] 5. Checkpoint - Verificar schema e service
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Criar modais de importação e detalhe da fatura
  - [ ] 6.1 Criar `src/pages/transactions/InvoiceImportModal.tsx`
    - Usar componente `Modal` existente com título "Importar Fatura"
    - Campo de upload aceitando `.csv` e `.zip` com validação de extensão
    - Ao selecionar arquivo: se .zip → `extractCsvFromZip()` → texto CSV; texto CSV → `parseC6Csv()` → resultado
    - Exibir resumo: banco (C6), quantidade de itens, total formatado em R$
    - Campos de data de vencimento (input date) e quinzena (select, condicional ao ciclo_tipo)
    - Botão "Importar" desabilitado até data preenchida e parsing com sucesso
    - Ao confirmar: `createInvoice()` → toast sucesso → `onSuccess()`
    - Tratamento de erros: toast para arquivo inválido, formato inválido, falha no Supabase
    - Usar inline styles seguindo padrão da TransactionsPage (inputWrapStyle, inputStyle, labelStyle, selectStyle)
    - Props: isOpen, onClose, onSuccess, profileId, cicloTipo
    - _Requisitos: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3, 8.4, 9.3, 9.4_

  - [ ] 6.2 Criar `src/pages/transactions/InvoiceDetailModal.tsx`
    - Usar componente `Modal` existente com título "Detalhe da Fatura"
    - Ao abrir: `listInvoiceItems(expense.id)` → exibir lista de itens
    - Cada item exibe: data de compra, descrição, categoria C6, parcela, valor formatado em R$
    - Itens ordenados por data de compra (ASC) — já vem ordenado do service
    - Exibir total da fatura no rodapé
    - Edição inline de valor: ao clicar no item, campo de valor editável
    - Ao confirmar edição: validar valor > 0, `updateInvoiceItem()` → atualizar lista e total
    - Usar inline styles seguindo padrão existente
    - Props: isOpen, onClose, expense, onExpenseUpdated
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.3 Escrever teste de propriedade: rejeição de valores não-positivos na edição
    - **Propriedade 6: Rejeição de valores não-positivos na edição**
    - **Valida: Requisitos 6.5**
    - Gerar números ≤ 0 e verificar que a validação rejeita a edição

- [ ] 7. Checkpoint - Verificar modais UI
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integrar na TransactionsPage
  - [ ] 8.1 Adicionar botão "Cadastrar Fatura" e importar modais na `TransactionsPage`
    - Adicionar botão "Cadastrar Fatura" com ícone 💳 abaixo do botão "Adicionar", com estilo visual distinto (outline ou cor diferente)
    - Adicionar estados: `showInvoiceImportModal`, `showInvoiceDetailModal`, `invoiceDetailExpense`
    - Importar e renderizar `InvoiceImportModal` com props corretas (profileId, cicloTipo, onSuccess → refetch)
    - Importar e renderizar `InvoiceDetailModal` com props corretas
    - _Requisitos: 1.1, 1.2_

  - [ ] 8.2 Implementar lógica de abertura condicional do modal ao clicar em despesa "Cartão"
    - Manter cache local (`Set<string>`) de expense IDs que possuem invoice_items
    - Popular cache no `fetchExpenses` usando `hasInvoiceItems()` para despesas categoria "Cartão"
    - No `openEditModal`: se despesa é "Cartão" e está no cache → abrir `InvoiceDetailModal`; senão → abrir modal de edição padrão
    - No `onExpenseUpdated` do InvoiceDetailModal: atualizar a expense na lista local
    - _Requisitos: 5.1, 4.4_

- [ ] 9. Checkpoint final - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e casos de borda
- O projeto já possui `fast-check` e `vitest` configurados
- JSZip precisa ser instalado como dependência de produção
- O tipo `InvoiceItem` será adicionado ao `src/types/index.ts` existente
- Usar componentes e inline styles existentes — sem novos padrões de design
