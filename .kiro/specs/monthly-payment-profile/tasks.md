# Plano de Implementação: Perfil de Pagamento Mensal

## Visão Geral

Adaptar o aplicativo de planejamento financeiro para suportar plenamente usuários com ciclo de pagamento mensal (`ciclo_tipo = 'mensal'`). A implementação é incremental: migração SQL → tipos → schemas condicionais → utilitários → onboarding → dashboard → tela de despesas. Todas as adaptações usam componentes existentes com inline styles, sem novos padrões.

## Tasks

- [x] 1. Migração SQL e tipos TypeScript
  - [x] 1.1 Criar migração `supabase/migrations/008_monthly_profile.sql`
    - Adicionar coluna `dia_pagamento_mensal` (INTEGER, nullable, CHECK 1–31) em `user_profiles`
    - Alterar `expenses.quinzena` para nullable (DROP NOT NULL, ajustar CHECK para aceitar NULL)
    - Alterar `extra_incomes.quinzena` para nullable (DROP NOT NULL, ajustar CHECK para aceitar NULL)
    - Usar `DROP CONSTRAINT IF EXISTS` para idempotência
    - _Requisitos: 1.1, 2.1, 3.1_

  - [x] 1.2 Atualizar tipos em `src/types/index.ts`
    - Adicionar `dia_pagamento_mensal: number | null` em `UserProfile`
    - Alterar `quinzena` de `Quinzena` para `Quinzena | null` em `Expense`
    - Alterar `quinzena` de `Quinzena` para `Quinzena | null` em `ExtraIncome`
    - _Requisitos: 1.1, 2.1, 2.4, 3.1_

- [ ] 2. Schemas condicionais e utilitários
  - [x] 2.1 Criar schema factory em `src/schemas/expense.schema.ts`
    - Adicionar função `createExpenseSchema(cicloTipo: string)` que retorna schema com `quinzena` obrigatória (quinzenal) ou nullish (mensal)
    - Manter `expenseSchema` existente como `createExpenseSchema('15_ultimo')` para compatibilidade
    - _Requisitos: 2.2, 2.3_

  - [x] 2.2 Criar schema factory em `src/schemas/extra-income.schema.ts`
    - Adicionar função `createExtraIncomeSchema(cicloTipo: string)` que retorna schema com `quinzena` obrigatória (quinzenal) ou nullish (mensal)
    - Manter `extraIncomeSchema` existente como `createExtraIncomeSchema('15_ultimo')` para compatibilidade
    - _Requisitos: 3.2, 3.3_

  - [x] 2.3 Atualizar `filterByQuinzena` em `src/lib/quinzena.ts`
    - Alterar tipo genérico para aceitar `quinzena: Quinzena | null`
    - Adicionar helper `isMensal(cicloTipo: string | undefined): boolean`
    - Items com `quinzena === null` são incluídos em `'all'` e excluídos em filtros específicos
    - _Requisitos: 7.3_

  - [ ]* 2.4 Escrever teste de propriedade para schema de despesa condicional
    - **Propriedade 1: Expense schema quinzena conditionality**
    - **Valida: Requisitos 2.2, 2.3, 6.4**
    - Gerar dados de despesa aleatórios e cicloTipo aleatório, validar que quinzena é obrigatória/opcional conforme o ciclo

  - [ ]* 2.5 Escrever teste de propriedade para schema de ganho extra condicional
    - **Propriedade 2: Extra income schema quinzena conditionality**
    - **Valida: Requisitos 3.2, 3.3**
    - Gerar dados de ganho extra aleatórios e cicloTipo aleatório, validar que quinzena é obrigatória/opcional conforme o ciclo

  - [ ]* 2.6 Escrever teste de propriedade para filterByQuinzena com null
    - **Propriedade 3: filterByQuinzena handles null quinzena**
    - **Valida: Requisitos 7.3**
    - Gerar listas aleatórias de items com quinzena null/'1'/'2', aplicar filtros, verificar inclusão/exclusão correta

- [x] 3. Checkpoint - Verificar schemas e utilitários
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Adaptar Onboarding para ciclo mensal
  - [x] 4.1 Atualizar `src/pages/onboarding/OnboardingPage.tsx` — Step 1
    - Quando `ciclo === 'mensal'`: mostrar campo numérico "Dia do pagamento" (1–31) com validação
    - Esconder sub-opções de quinzena ("Dia 15 e Último dia útil", "5º dia útil e Dia 20") quando mensal
    - Desabilitar botão "Avançar" se mensal selecionado mas dia não informado ou fora do range 1–31
    - Exibir mensagem de erro "Dia deve ser entre 1 e 31" para valores inválidos
    - Usar inline styles existentes (inputWrapStyle, inputStyle, labelStyle)
    - _Requisitos: 4.1, 4.2, 10.1, 10.2_

  - [x] 4.2 Atualizar `src/pages/onboarding/OnboardingPage.tsx` — Step 2
    - Quando `ciclo === 'mensal'`: mostrar apenas "Salário bruto" e "Salário líquido"
    - Esconder campos "Valor quinzena 1" e "Valor quinzena 2" quando mensal
    - _Requisitos: 4.3, 4.4_

  - [x] 4.3 Atualizar `handleFinish` em `OnboardingPage.tsx`
    - Quando mensal: salvar `ciclo_tipo='mensal'`, `dia_pagamento_mensal=dia`, `quinzena_1_valor=0`, `quinzena_2_valor=0`, `salario_liquido` como salário total
    - Manter lógica existente para quinzenal inalterada
    - _Requisitos: 4.5, 4.6, 1.2, 1.3_

- [x] 5. Checkpoint - Verificar onboarding
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Adaptar Dashboard para Usuário Mensal
  - [x] 6.1 Atualizar `src/pages/dashboard/DashboardPage.tsx` — Filtros e cálculos
    - Quando `isMensal(profile?.ciclo_tipo)`: esconder pills de filtro de quinzena
    - Forçar `quinzenaFilter = 'all'` para mensal (sem possibilidade de filtrar por quinzena)
    - Income = `salario_liquido` direto para mensal (ignorar `quinzena_1_valor` e `quinzena_2_valor`)
    - `totalExtraIncomes` = soma de todos os extras sem filtro de quinzena para mensal
    - _Requisitos: 5.1, 5.2, 5.3, 8.1, 9.1, 9.2_

  - [x] 6.2 Atualizar modal de edição de renda no `DashboardPage.tsx`
    - Quando mensal: mostrar campo único "Salário líquido" em vez de dois campos de quinzena
    - Atualizar `handleUpdateIncome` para salvar `salario_liquido` direto quando mensal
    - _Requisitos: 5.4_

  - [x] 6.3 Atualizar seção de ganhos extras no `DashboardPage.tsx`
    - Quando mensal: esconder seletor de quinzena no formulário inline de extra income
    - Quando mensal: esconder badge "Q1"/"Q2" na lista de extras
    - _Requisitos: 5.5, 5.6, 8.2_

  - [ ]* 6.4 Escrever teste de propriedade para cálculo de saldoReal mensal
    - **Propriedade 5: saldoReal calculation for mensal users**
    - **Valida: Requisitos 5.3, 9.1, 9.2**
    - Gerar salário, extras e despesas aleatórios, verificar que `saldoReal = salario_liquido + sum(extras) - sum(despesas)`

- [x] 7. Checkpoint - Verificar dashboard
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Adaptar Tela de Despesas para Usuário Mensal
  - [x] 8.1 Atualizar `src/pages/transactions/TransactionsPage.tsx` — Filtros
    - Quando `isMensal(profile?.ciclo_tipo)`: esconder pills de filtro de quinzena
    - _Requisitos: 6.1_

  - [x] 8.2 Atualizar modais de adicionar/editar despesa em `TransactionsPage.tsx`
    - Quando mensal: esconder campo "Quinzena" nos modais de adicionar e editar
    - No submit: usar `createExpenseSchema(cicloTipo)` para validação
    - Quando mensal: omitir `quinzena` do form data (será null no DB)
    - _Requisitos: 6.2, 6.3, 6.4, 2.4_

  - [ ]* 8.3 Escrever teste de propriedade para validação de dia do pagamento
    - **Propriedade 6: Day validation rejects out-of-range values**
    - **Valida: Requisitos 10.1**
    - Gerar inteiros aleatórios, verificar aceitação (1–31) e rejeição (fora do range)

- [x] 9. Ajustes nos services para quinzena nullable
  - [x] 9.1 Atualizar `src/services/expenses.service.ts`
    - Garantir que `createExpense` aceita dados sem `quinzena` (null no DB) para mensal
    - Garantir que `listExpenses` não aplica filtro de quinzena quando não especificado
    - _Requisitos: 2.4, 7.1, 7.2_

  - [x] 9.2 Atualizar `src/services/extra-income.service.ts`
    - Garantir que `createExtraIncome` aceita dados sem `quinzena` (null no DB) para mensal
    - _Requisitos: 3.4, 8.2_

- [x] 10. Checkpoint final - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- O projeto já possui `fast-check` e `vitest` configurados
- Todas as adaptações de UI usam componentes existentes (Modal, Input, Select) com inline styles
- O `ciclo_tipo` do perfil via `useProfile()` é a fonte de verdade para decidir o que mostrar/esconder
- Dados existentes de usuários quinzenais permanecem intactos — a migração é aditiva
