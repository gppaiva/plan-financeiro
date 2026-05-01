# Plano de Implementação — Escopo de Edição de Despesa Recorrente

- [ ] 1. Escrever teste exploratório da bug condition (ANTES do fix)
  - **Property 1: Bug Condition** - Edição de Despesa Recorrente Sem Diálogo de Escopo
  - **CRITICAL**: Este teste DEVE FALHAR no código não corrigido — a falha confirma que o bug existe
  - **NÃO tente corrigir o teste ou o código quando ele falhar**
  - **NOTE**: Este teste codifica o comportamento esperado — ele validará o fix quando passar após a implementação
  - **GOAL**: Demonstrar counterexamples que evidenciam o bug
  - **Scoped PBT Approach**: Focar no caso concreto: `updateExpense` chamado com uma despesa onde `recorrente = true` e campo `valor` alterado
  - Arquivo de teste: `src/services/expenses.service.test.ts` (adicionar novo describe block)
  - Usar `fast-check` para gerar valores aleatórios de `valor` (números positivos) e verificar que:
    - A função `updateExpense(id, { valor: novoValor })` atualiza diretamente o registro base (comportamento bugado)
    - Não existe mecanismo de override mensal (tabela `expense_overrides` não existe)
    - Não existe função `updateExpenseWithScope` no serviço
  - O teste deve assertar o comportamento ESPERADO (correto): que para despesas recorrentes, a edição deveria usar `updateExpenseWithScope` com parâmetro de escopo
  - Executar no código NÃO corrigido — esperar FALHA (confirma que o bug existe)
  - **EXPECTED OUTCOME**: Teste FALHA (correto — prova que o bug existe)
  - Documentar counterexamples encontrados (ex: "updateExpense('id', { valor: 2200 }) atualiza registro base diretamente sem escopo")
  - Marcar task como completa quando o teste estiver escrito, executado e a falha documentada
  - _Requirements: 1.1, 1.2, 2.1_

- [ ] 2. Escrever testes de preservação (ANTES do fix)
  - **Property 2: Preservation** - Comportamento Inalterado para Despesas Não Recorrentes e Outras Operações
  - **IMPORTANT**: Seguir metodologia observation-first
  - Arquivo de teste: `src/services/expenses.service.test.ts` (adicionar novo describe block)
  - **Observar** comportamento no código NÃO corrigido:
    - Observar: `updateExpense('id', { valor: 2000 })` para despesa não recorrente atualiza diretamente o registro
    - Observar: `toggleExpenseStatus('id', 'pending', 6, 2025)` usa `expense_payments` sem diálogo
    - Observar: `createExpense(userId, data)` cria registro normalmente
    - Observar: `deleteExpense('id')` remove registro base
    - Observar: `listExpenses(userId, { month: 6, year: 2025 })` retorna registros base para recorrentes
  - Usar `fast-check` para gerar propriedades:
    - **Prop 2a**: Para qualquer despesa não recorrente, `updateExpense` deve atualizar diretamente sem lógica de escopo
    - **Prop 2b**: Para qualquer operação de toggle de status, o comportamento deve usar `expense_payments` sem diálogo
    - **Prop 2c**: Para qualquer criação de despesa, o registro deve ser criado normalmente
    - **Prop 2d**: Para qualquer exclusão, o registro base deve ser removido
  - Executar no código NÃO corrigido
  - **EXPECTED OUTCOME**: Testes PASSAM (confirma comportamento baseline a preservar)
  - Marcar task como completa quando testes estiverem escritos, executados e passando no código não corrigido
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Implementar fix para escopo de edição de despesa recorrente

  - [x] 3.1 Criar migração SQL para tabela `expense_overrides`
    - Criar arquivo `supabase/migrations/007_expense_overrides.sql`
    - Seguir padrão da tabela `expense_payments` (migration 005)
    - Campos: `id` (UUID PK), `expense_id` (FK → expenses ON DELETE CASCADE), `mes` (INTEGER 1-12), `ano` (INTEGER 2020-2100), `valor` (NUMERIC nullable), `descricao` (VARCHAR nullable), `categoria` (TEXT nullable), `quinzena` (TEXT nullable), `dia_vencimento` (INTEGER nullable), `created_at` (TIMESTAMPTZ)
    - Constraint UNIQUE em `(expense_id, mes, ano)`
    - Índices em `expense_id` e `(expense_id, mes, ano)`
    - RLS policy seguindo padrão existente (via join com expenses → user_profiles)
    - _Bug_Condition: isBugCondition(input) onde input.expense.recorrente = true AND fieldsChanged.length > 0_
    - _Expected_Behavior: Override mensal armazena valores customizados por mês/ano_
    - _Preservation: Tabela não afeta fluxos existentes — apenas adiciona capacidade nova_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Adicionar tipo `ExpenseOverride` em `src/types/index.ts`
    - Adicionar interface `ExpenseOverride` com campos da nova tabela
    - Campos: `id`, `expense_id`, `mes`, `ano`, `valor?`, `descricao?`, `categoria?`, `quinzena?`, `dia_vencimento?`, `created_at`
    - Adicionar tipo `EditScope = 'only_this_month' | 'this_and_future'`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Atualizar serviço de despesas em `src/services/expenses.service.ts`
    - Adicionar função `getMonthlyOverrides(expenseIds: string[], month: number, year: number)` — busca overrides mensais (similar a `getMonthlyPayments`)
    - Adicionar função `upsertExpenseOverride(expenseId: string, month: number, year: number, data: Partial<ExpenseFormData>)` — cria/atualiza override mensal
    - Adicionar função `updateExpenseWithScope(id: string, data: Partial<ExpenseFormData>, scope: EditScope, month: number, year: number)`:
      - `scope = 'only_this_month'`: chama `upsertExpenseOverride` (registro base inalterado)
      - `scope = 'this_and_future'`: chama `updateExpense` existente (atualiza registro base)
    - Atualizar `listExpenses` para mesclar overrides mensais com registros base de despesas recorrentes (chamar `getMonthlyOverrides` e sobrescrever campos preenchidos)
    - _Bug_Condition: isBugCondition(input) onde input.expense.recorrente = true_
    - _Expected_Behavior: updateExpenseWithScope('only_this_month') cria override sem alterar base; updateExpenseWithScope('this_and_future') atualiza base_
    - _Preservation: updateExpense original continua existindo para despesas não recorrentes; listExpenses sem overrides retorna valores base_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.4 Atualizar store de despesas em `src/stores/expenses.store.ts`
    - Atualizar `updateExpense` para aceitar parâmetros opcionais de escopo (`scope?: EditScope`, `month?: number`, `year?: number`)
    - Quando `scope` é fornecido, chamar `updateExpenseWithScope` do serviço
    - Quando `scope` não é fornecido (despesa não recorrente), manter comportamento atual com `updateExpenseService`
    - Após update com escopo, re-fetch despesas para refletir overrides na listagem
    - _Bug_Condition: Store deve rotear para updateExpenseWithScope quando despesa é recorrente_
    - _Preservation: Chamadas sem scope continuam usando updateExpenseService diretamente_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.5 Adicionar diálogo de escopo e atualizar `TransactionsPage.tsx`
    - **USAR o componente Modal existente** de `src/components/ui/Modal.tsx` — NÃO criar novo componente
    - **USAR inline styles** seguindo o padrão do projeto (mesmo estilo de DashboardPage.tsx e TransactionsPage.tsx)
    - Adicionar estado `showScopeModal` e `pendingEditData` no TransactionsPage
    - No `handleEditSubmit`: se despesa é recorrente (`editRecorrente = true`), salvar dados pendentes e abrir modal de escopo ao invés de salvar diretamente
    - Modal de escopo com título "Escopo da Alteração" contendo:
      - Texto explicativo: "Esta é uma despesa recorrente. Como deseja aplicar a alteração?"
      - Botão "Apenas este mês" — estilo outline (border + background transparente)
      - Botão "Este mês e todos os futuros" — estilo primário (background #2563eb)
      - Botão "Cancelar" — estilo texto (sem background)
    - Ao escolher escopo: chamar `useExpensesStore.updateExpense` com `scope`, `selectedMonth`, `selectedYear`
    - Se despesa NÃO é recorrente: manter comportamento atual (salvar diretamente)
    - **Substituir acesso direto ao Supabase** no `handleEditSubmit` pelo store centralizado
    - _Bug_Condition: handleEditSubmit verifica recorrente antes de salvar_
    - _Expected_Behavior: Diálogo de escopo exibido para despesas recorrentes; escolha aplicada corretamente_
    - _Preservation: Despesas não recorrentes continuam salvando diretamente sem diálogo_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [ ] 3.6 Verificar que teste exploratório da bug condition agora passa
    - **Property 1: Expected Behavior** - Edição de Despesa Recorrente Com Escopo
    - **IMPORTANT**: Re-executar o MESMO teste da task 1 — NÃO escrever novo teste
    - O teste da task 1 codifica o comportamento esperado
    - Quando este teste passar, confirma que o comportamento esperado está satisfeito
    - Executar teste exploratório da bug condition da task 1
    - **EXPECTED OUTCOME**: Teste PASSA (confirma que o bug foi corrigido)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.7 Verificar que testes de preservação continuam passando
    - **Property 2: Preservation** - Comportamento Inalterado Após Fix
    - **IMPORTANT**: Re-executar os MESMOS testes da task 2 — NÃO escrever novos testes
    - Executar testes de preservação da task 2
    - **EXPECTED OUTCOME**: Testes PASSAM (confirma que não houve regressão)
    - Confirmar que todos os testes continuam passando após o fix

- [ ] 4. Checkpoint — Garantir que todos os testes passam
  - Executar `vitest run` para rodar toda a suite de testes
  - Verificar que todos os testes passam (exploratórios, preservação e existentes)
  - Perguntar ao usuário se há dúvidas ou ajustes necessários
