# Escopo de Edição de Despesa Recorrente — Design do Bugfix

## Overview

Ao editar uma despesa recorrente, o sistema atualiza diretamente o registro único na tabela `expenses`, fazendo com que a alteração se reflita em todos os meses — passados e futuros. O fix consiste em: (1) criar uma tabela `expense_overrides` para armazenar valores customizados por mês, (2) exibir um diálogo de escopo ("apenas este mês" vs. "este mês e todos os futuros") quando o usuário edita uma despesa recorrente, e (3) ajustar a listagem para mesclar overrides mensais com o registro base.

## Glossary

- **Bug_Condition (C)**: O usuário edita campos de uma despesa onde `recorrente = true` — o sistema aplica a mudança globalmente sem perguntar o escopo
- **Property (P)**: Ao editar uma despesa recorrente, o sistema deve exibir um diálogo de escopo e aplicar a alteração conforme a escolha do usuário (apenas mês atual ou mês atual + futuros)
- **Preservation**: Edição de despesas não recorrentes, visualização de despesas, toggle de status, criação e exclusão devem continuar funcionando exatamente como antes
- **`expenses` table**: Tabela principal que armazena despesas. Despesas recorrentes possuem `recorrente = true` e um único registro que representa todos os meses
- **`expense_payments` table**: Tabela existente que armazena status de pagamento mensal para despesas recorrentes (padrão já estabelecido para overrides mensais)
- **`expense_overrides` table**: Nova tabela que armazenará valores customizados (valor, descrição, categoria, etc.) por mês/ano para despesas recorrentes
- **Registro base**: O registro na tabela `expenses` que define os valores padrão da despesa recorrente
- **Override mensal**: Registro na tabela `expense_overrides` que sobrescreve campos do registro base para um mês/ano específico

## Bug Details

### Bug Condition

O bug ocorre quando o usuário edita qualquer campo de uma despesa recorrente. A função `handleEditSubmit` em `TransactionsPage.tsx` executa um `supabase.from('expenses').update(...)` diretamente no registro base, alterando os valores para todos os meses simultaneamente. Não existe nenhum diálogo perguntando ao usuário sobre o escopo da alteração, nem mecanismo para armazenar valores diferentes por mês.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ExpenseEditInput { expense: Expense, fieldsChanged: string[] }
  OUTPUT: boolean
  
  RETURN input.expense.recorrente = true
         AND input.fieldsChanged.length > 0
         AND input.fieldsChanged intersects ['valor', 'descricao', 'categoria', 'quinzena', 'data_vencimento']
END FUNCTION
```

### Examples

- **Exemplo 1**: Usuário edita o valor do "Aluguel" (recorrente, R$2.000) para R$2.200 em Julho/2025. **Atual**: o valor muda para R$2.200 em todos os meses (Jan–Dez). **Esperado**: sistema pergunta o escopo; se "apenas este mês", Julho fica R$2.200 e os demais continuam R$2.000.
- **Exemplo 2**: Usuário edita a descrição de "Internet" (recorrente) de "Internet Fibra" para "Internet Fibra 500MB" em Agosto/2025. **Atual**: a descrição muda em todos os meses. **Esperado**: se "apenas este mês", apenas Agosto mostra o novo nome.
- **Exemplo 3**: Usuário edita o valor do "Streaming" (recorrente, R$55) para R$65 a partir de Setembro/2025 escolhendo "este mês e todos os futuros". **Atual**: não há essa opção. **Esperado**: o registro base é atualizado para R$65, mas meses anteriores com overrides preservam seus valores.
- **Exemplo 4 (edge case)**: Usuário edita uma despesa NÃO recorrente. **Esperado**: atualização direta sem diálogo de escopo (comportamento atual preservado).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Edição de despesas não recorrentes deve continuar atualizando o registro diretamente sem diálogo de escopo
- Visualização de despesas recorrentes em meses sem override deve continuar exibindo o valor base
- Toggle de status (pago/pendente) de despesas recorrentes deve continuar usando `expense_payments` sem diálogo de escopo
- Exclusão de despesas recorrentes deve continuar excluindo o registro base e dados associados
- Criação de novas despesas (recorrentes ou não) deve continuar funcionando normalmente
- Listagem e filtros de despesas devem continuar funcionando corretamente

**Scope:**
Todos os inputs que NÃO envolvem edição de campos de uma despesa recorrente devem ser completamente inalterados pelo fix. Isso inclui:
- Edição de despesas não recorrentes
- Toggle de status de pagamento
- Criação de novas despesas
- Exclusão de despesas
- Navegação entre meses
- Visualização e filtros

## Hypothesized Root Cause

Com base na análise do código, as causas raiz são:

1. **Ausência de diálogo de escopo**: A função `handleEditSubmit` em `TransactionsPage.tsx` não verifica se a despesa é recorrente antes de aplicar a edição. Não existe nenhum componente de diálogo que pergunte ao usuário sobre o escopo da alteração.

2. **Update direto no registro base**: O `handleEditSubmit` executa `supabase.from('expenses').update({...}).eq('id', editingExpenseId)` diretamente, o que altera o registro único que representa a despesa em todos os meses. Não há lógica condicional para tratar despesas recorrentes de forma diferente.

3. **Ausência de tabela de overrides**: Não existe uma tabela para armazenar valores customizados por mês/ano para despesas recorrentes. A tabela `expense_payments` resolve apenas o status de pagamento mensal, mas não campos como valor, descrição ou categoria.

4. **Listagem não considera overrides**: A função `listExpenses` em `expenses.service.ts` retorna o registro base para despesas recorrentes sem mesclar possíveis overrides mensais (que ainda não existem).

5. **Store bypassed**: O `handleEditSubmit` não usa `useExpensesStore.updateExpense()` — ele importa o Supabase diretamente e faz o update, o que dificulta a centralização da lógica de escopo.

## Correctness Properties

Property 1: Bug Condition - Diálogo de Escopo na Edição de Despesa Recorrente

_For any_ input onde a despesa editada é recorrente (`recorrente = true`) e pelo menos um campo editável foi alterado (valor, descrição, categoria, quinzena, dia de vencimento), a função de edição corrigida SHALL exibir um diálogo de escopo com as opções "apenas este mês" e "este mês e todos os futuros", e aplicar a alteração conforme a escolha: criando um override mensal na tabela `expense_overrides` para "apenas este mês", ou atualizando o registro base para "este mês e todos os futuros".

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Comportamento de Edição de Despesas Não Recorrentes

_For any_ input onde a despesa editada NÃO é recorrente (`recorrente = false`), ou onde a ação não é uma edição de campos (ex: toggle de status, exclusão, criação), a função corrigida SHALL produzir exatamente o mesmo resultado que a função original, preservando o comportamento de atualização direta sem diálogo de escopo.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assumindo que a análise de causa raiz está correta:

**1. Nova migração SQL — Tabela `expense_overrides`**

**File**: `supabase/migrations/007_expense_overrides.sql`

Criar tabela `expense_overrides` seguindo o padrão da `expense_payments`:
- Campos: `id`, `expense_id` (FK → expenses), `mes`, `ano`, campos sobrescrevíveis (`valor`, `descricao`, `categoria`, `quinzena`, `dia_vencimento`), `created_at`
- Constraint UNIQUE em `(expense_id, mes, ano)`
- RLS policies seguindo o padrão existente
- Todos os campos de override são nullable — apenas campos preenchidos sobrescrevem o registro base

**2. Novo tipo TypeScript — `ExpenseOverride`**

**File**: `src/types/index.ts`

Adicionar interface `ExpenseOverride` com os campos da nova tabela.

**3. Atualizar serviço de despesas**

**File**: `src/services/expenses.service.ts`

- Adicionar função `getMonthlyOverrides(expenseIds, month, year)` para buscar overrides mensais (similar a `getMonthlyPayments`)
- Adicionar função `upsertExpenseOverride(expenseId, month, year, data)` para criar/atualizar override mensal
- Atualizar `listExpenses` para mesclar overrides mensais com registros base de despesas recorrentes
- Adicionar função `updateExpenseWithScope(id, data, scope, month, year)` que encapsula a lógica de escopo:
  - `scope = 'only_this_month'`: chama `upsertExpenseOverride`
  - `scope = 'this_and_future'`: atualiza o registro base via `updateExpense`

**4. Atualizar store de despesas**

**File**: `src/stores/expenses.store.ts`

- Atualizar `updateExpense` para aceitar parâmetros de escopo (`scope`, `month`, `year`)
- Manter optimistic update compatível com ambos os cenários

**5. Criar componente de diálogo de escopo**

**File**: `src/components/ui/EditScopeDialog.tsx`

Novo componente modal que exibe duas opções:
- "Apenas este mês" — ícone de calendário com um dia marcado
- "Este mês e todos os futuros" — ícone de calendário com seta para frente
- Botões de ação e cancelar

**6. Atualizar TransactionsPage**

**File**: `src/pages/transactions/TransactionsPage.tsx`

- Após o submit do formulário de edição, verificar se a despesa é recorrente
- Se recorrente: exibir `EditScopeDialog` antes de salvar
- Se não recorrente: salvar diretamente (comportamento atual)
- Substituir o acesso direto ao Supabase pelo serviço/store centralizado
- Passar `selectedMonth` e `selectedYear` para a lógica de escopo

## Testing Strategy

### Validation Approach

A estratégia de testes segue duas fases: primeiro, demonstrar o bug no código não corrigido com counterexamples, depois verificar que o fix funciona corretamente e preserva o comportamento existente.

### Exploratory Bug Condition Checking

**Goal**: Demonstrar counterexamples que evidenciam o bug ANTES de implementar o fix. Confirmar ou refutar a análise de causa raiz.

**Test Plan**: Escrever testes que simulam a edição de uma despesa recorrente e verificam se o registro base é alterado diretamente (sem diálogo de escopo). Executar no código NÃO corrigido para observar falhas.

**Test Cases**:
1. **Edição de valor sem diálogo**: Simular edição do valor de uma despesa recorrente e verificar que nenhum diálogo de escopo é exibido (vai falhar no código não corrigido — confirmando o bug)
2. **Registro base alterado globalmente**: Após editar o valor, verificar que o registro base na tabela `expenses` foi alterado diretamente (vai falhar no código não corrigido — confirmando que não há override mensal)
3. **Ausência de override mensal**: Verificar que não existe registro em `expense_overrides` após a edição (vai falhar no código não corrigido — tabela nem existe)

**Expected Counterexamples**:
- O diálogo de escopo não é exibido ao editar despesa recorrente
- O registro base é atualizado diretamente, afetando todos os meses
- Possíveis causas: ausência de verificação `recorrente` no fluxo de edição, ausência de tabela de overrides, ausência de componente de diálogo

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a bug condition é verdadeira, a função corrigida produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := editExpenseFixed(input)
  ASSERT result.scopeDialogShown = true
  ASSERT result.scopeChosen IN {'only_this_month', 'this_and_future'}
  IF result.scopeChosen = 'only_this_month' THEN
    ASSERT baseRecord(input.expense).unchanged = true
    ASSERT overrideExists(input.expense.id, input.month, input.year) = true
    ASSERT override.valor = input.newValor
  ELSE
    ASSERT baseRecord(input.expense).valor = input.newValor
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a bug condition NÃO é verdadeira, a função corrigida produz o mesmo resultado que a função original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT editExpenseOriginal(input) = editExpenseFixed(input)
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos casos de teste automaticamente no domínio de inputs
- Captura edge cases que testes manuais podem perder
- Fornece garantias fortes de que o comportamento é inalterado para inputs não-buggy

**Test Plan**: Observar o comportamento no código NÃO corrigido para despesas não recorrentes e outras operações, depois escrever property-based tests capturando esse comportamento.

**Test Cases**:
1. **Edição de despesa não recorrente**: Verificar que a edição continua atualizando diretamente sem diálogo de escopo
2. **Toggle de status**: Verificar que o toggle de pago/pendente continua usando `expense_payments` sem diálogo
3. **Criação de despesa**: Verificar que criar despesas (recorrentes ou não) continua funcionando normalmente
4. **Exclusão de despesa**: Verificar que excluir despesas continua removendo o registro base
5. **Listagem sem override**: Verificar que despesas recorrentes sem override mensal exibem o valor base

### Unit Tests

- Testar `updateExpenseWithScope` com `scope = 'only_this_month'` — deve criar override e não alterar registro base
- Testar `updateExpenseWithScope` com `scope = 'this_and_future'` — deve atualizar registro base
- Testar `getMonthlyOverrides` — deve retornar overrides corretos para o mês/ano
- Testar `listExpenses` com overrides — deve mesclar valores do override com o registro base
- Testar `listExpenses` sem overrides — deve retornar valores do registro base (preservação)
- Testar `upsertExpenseOverride` — deve criar novo ou atualizar existente
- Testar edge case: editar despesa recorrente sem alterar nenhum campo (noop)

### Property-Based Tests

- Gerar estados aleatórios de despesas recorrentes e verificar que `updateExpenseWithScope('only_this_month')` nunca altera o registro base
- Gerar configurações aleatórias de overrides e verificar que `listExpenses` sempre prioriza override sobre registro base quando existe
- Gerar inputs de despesas não recorrentes e verificar que o fluxo de edição produz o mesmo resultado com e sem o fix

### Integration Tests

- Testar fluxo completo: editar despesa recorrente → diálogo de escopo → "apenas este mês" → verificar que mês atual tem novo valor e mês seguinte tem valor base
- Testar fluxo completo: editar despesa recorrente → diálogo de escopo → "este mês e todos os futuros" → verificar que registro base foi atualizado
- Testar que o diálogo de escopo NÃO aparece ao editar despesa não recorrente
- Testar navegação entre meses após criar override — verificar que cada mês exibe o valor correto
