# Plano de Implementação: Ganhos Extras Mensais

## Visão Geral

Implementação do CRUD completo de ganhos extras mensais no planejador financeiro, seguindo os padrões existentes do projeto (service com Zod, store Zustand com rollback otimista, componentes React). A tabela `extra_incomes` já existe no Supabase com RLS configurado. A implementação é incremental: schema → service → store → componentes UI → integração no dashboard.

## Tasks

- [x] 1. Criar schema Zod e service de ganhos extras
  - [x] 1.1 Criar `src/schemas/extra-income.schema.ts` com o schema Zod `extraIncomeSchema`
    - Definir campos `descricao` (string, min 1, max 255) e `valor` (number, positive)
    - Exportar o tipo `ExtraIncomeFormData` inferido do schema
    - Seguir o padrão de `src/schemas/expense.schema.ts`
    - _Requisitos: 2.4, 2.5_

  - [ ]* 1.2 Escrever teste de propriedade para validação do schema
    - **Propriedade 1: Validação do schema aceita dados válidos e rejeita inválidos**
    - **Valida: Requisitos 2.4, 2.5**
    - Criar `src/schemas/extra-income.schema.test.ts`
    - Usar `fast-check` para gerar strings de 1-255 chars e números positivos (aceitar)
    - Usar `fast-check` para gerar strings vazias, strings > 255 chars, valores ≤ 0 (rejeitar)

  - [x] 1.3 Criar `src/services/extra-income.service.ts` com as funções CRUD
    - Implementar `listExtraIncomes(userId, month, year)` filtrando por intervalo de datas do mês
    - Implementar `createExtraIncome(userId, data, month, year)` com validação Zod e `data` como primeiro dia do mês
    - Implementar `updateExtraIncome(id, data)` atualizando descrição e valor
    - Implementar `deleteExtraIncome(id)` removendo o registro
    - Seguir o padrão de `src/services/expenses.service.ts` (uso do supabase client, throw Error)
    - _Requisitos: 1.1, 1.4, 2.2, 3.2, 4.2, 7.1_

  - [ ]* 1.4 Escrever testes unitários para o service
    - Criar `src/services/extra-income.service.test.ts`
    - Mockar o Supabase client para verificar chamadas corretas (insert com user_id, select com filtro de data, update, delete)
    - Testar que erros do Supabase são propagados como Error
    - _Requisitos: 1.1, 2.2, 3.2, 4.2, 7.1_

- [x] 2. Checkpoint - Verificar schema e service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Criar store Zustand de ganhos extras
  - [x] 3.1 Criar `src/stores/extra-income.store.ts` com `useExtraIncomeStore`
    - Definir estado: `extraIncomes: ExtraIncome[]`, `loading: boolean`
    - Implementar `fetchExtraIncomes(userId, month, year)` com loading state
    - Implementar `addExtraIncome(userId, data, month, year)` adicionando ao estado após sucesso
    - Implementar `updateExtraIncome(id, data)` com atualização otimista e rollback em caso de erro
    - Implementar `removeExtraIncome(id)` com remoção otimista e rollback em caso de erro
    - Seguir o padrão de `src/stores/expenses.store.ts` (create do zustand, optimistic update, rollback)
    - _Requisitos: 1.1, 2.3, 3.3, 4.3, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.2 Escrever teste de propriedade: adicionar aumenta a lista
    - **Propriedade 2: Adicionar ganho extra aumenta a lista**
    - **Valida: Requisitos 2.3**
    - Criar `src/stores/extra-income.store.test.ts`
    - Verificar que após adição, lista contém o novo item e comprimento é +1

  - [ ]* 3.3 Escrever teste de propriedade: remover diminui a lista
    - **Propriedade 3: Remover ganho extra diminui a lista**
    - **Valida: Requisitos 4.3**
    - Verificar que após remoção, lista não contém o item e comprimento é -1

  - [ ]* 3.4 Escrever teste de propriedade: atualizar reflete alterações
    - **Propriedade 4: Atualizar ganho extra reflete as alterações**
    - **Valida: Requisitos 3.3**
    - Verificar que após atualização, item tem novos valores e demais itens inalterados

  - [ ]* 3.5 Escrever teste de propriedade: rollback na atualização
    - **Propriedade 6: Rollback no store após falha na atualização**
    - **Valida: Requisitos 6.2**
    - Mockar service para falhar e verificar que store reverte ao estado anterior

  - [ ]* 3.6 Escrever teste de propriedade: rollback na exclusão
    - **Propriedade 7: Rollback no store após falha na exclusão**
    - **Valida: Requisitos 6.3**
    - Mockar service para falhar e verificar que store restaura o item removido

- [x] 4. Checkpoint - Verificar store e propriedades
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Criar componentes UI de ganhos extras
  - [x] 5.1 Criar `src/pages/dashboard/ExtraIncomeFormModal.tsx`
    - Implementar modal de criação/edição usando o componente `Modal` existente
    - Campos: descrição (Input) e valor (input monetário com formatação R$)
    - Validação inline com `extraIncomeSchema` e exibição de erros nos campos
    - Modo criação (campos vazios) e edição (campos preenchidos via `initialData`)
    - Botão de salvar com estado de loading
    - Usar `aria-invalid` e `aria-describedby` para acessibilidade
    - _Requisitos: 2.1, 2.4, 2.5, 2.6, 3.1_

  - [x] 5.2 Criar `src/pages/dashboard/ExtraIncomeList.tsx`
    - Renderizar lista de ganhos extras com descrição e valor formatado (R$)
    - Botões de editar e excluir em cada item
    - Mensagem "Nenhum ganho extra cadastrado" quando lista vazia
    - Exibir total de ganhos extras do mês
    - _Requisitos: 1.2, 1.3_

  - [x] 5.3 Criar `src/pages/dashboard/ExtraIncomeSection.tsx`
    - Componente container que recebe `profileId`, `month`, `year`
    - Renderiza cabeçalho "Ganhos Extras" com botão de adicionar (+)
    - Renderiza `ExtraIncomeList` e gerencia modais (formulário e confirmação de exclusão)
    - Usa `useExtraIncomeStore` para buscar e gerenciar ganhos extras
    - Exibe toast de sucesso/erro via `useToast`
    - Modal de confirmação de exclusão antes de remover
    - _Requisitos: 1.1, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4_

- [x] 6. Checkpoint - Verificar componentes UI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrar ganhos extras no Dashboard
  - [x] 7.1 Integrar `ExtraIncomeSection` no `DashboardPage`
    - Importar e renderizar `ExtraIncomeSection` no `DashboardPage` passando `profileId`, `selectedMonth`, `selectedYear`
    - Posicionar a seção após o card de saldo e antes dos filtros de quinzena
    - _Requisitos: 1.1, 1.4_

  - [x] 7.2 Atualizar cálculo do saldo real no `DashboardPage`
    - Importar `useExtraIncomeStore` no `DashboardPage`
    - Calcular `saldoReal = income + totalExtraIncomes - totalExpenses`
    - Adicionar mini-card "Extras" no card de saldo (mesmo padrão visual de "Ganho" e "Despesas")
    - Garantir que o saldo recalcula quando ganhos extras mudam (via store reativo)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 7.3 Escrever teste de propriedade: cálculo do saldo real
    - **Propriedade 5: Cálculo do saldo real**
    - **Valida: Requisitos 5.1**
    - Criar `src/lib/balance.test.ts` com função pura de cálculo
    - Verificar que `saldo = salário + Σ(extras) - Σ(despesas)` para quaisquer valores válidos

- [x] 8. Checkpoint final - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e casos de borda
- A tabela `extra_incomes` já existe no Supabase — nenhuma migração necessária
- O tipo `ExtraIncome` já está definido em `src/types/index.ts`
- O projeto já possui `fast-check` e `vitest` configurados
