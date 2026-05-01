# Documento de Requisitos — Perfil de Pagamento Mensal

## Introdução

O aplicativo de planejamento financeiro atualmente é construído em torno do conceito de "quinzena" (dois pagamentos por mês). Usuários que recebem uma vez por mês (ciclo mensal) precisam de uma experiência adaptada: sem seletores de quinzena, sem filtros de quinzena, e com um fluxo de onboarding simplificado que pergunta apenas o dia do pagamento e o salário total. Esta feature adapta todas as telas e camadas de dados para suportar plenamente o perfil mensal.

## Glossário

- **App**: O aplicativo de planejamento financeiro (React + TypeScript + Supabase).
- **Usuário_Mensal**: Usuário cujo `ciclo_tipo` no perfil é `'mensal'`.
- **Usuário_Quinzenal**: Usuário cujo `ciclo_tipo` no perfil é `'15_ultimo'` ou `'5_20'`.
- **Onboarding**: Fluxo de configuração inicial do perfil do usuário após o cadastro.
- **Dashboard**: Tela principal que exibe saldo, despesas e ganhos extras do mês.
- **Tela_Despesas**: Página de listagem e gerenciamento de despesas (`TransactionsPage`).
- **Tela_Ganhos_Extras**: Seção dentro do modal de edição de saldo no Dashboard para adicionar/editar ganhos extras.
- **Seletor_Quinzena**: Campo de seleção (select ou pills) que permite escolher entre quinzena 1 e quinzena 2.
- **Filtro_Quinzena**: Conjunto de botões (pills) no Dashboard e na Tela_Despesas que filtra itens por quinzena.
- **Campo_Dia_Pagamento**: Campo numérico (1–31) que armazena o dia do mês em que o Usuário_Mensal recebe o salário.
- **Schema_Despesa**: Schema Zod que valida os dados de criação/edição de despesas (`expenseSchema`).
- **Schema_Ganho_Extra**: Schema Zod que valida os dados de ganhos extras (`extraIncomeSchema`).
- **Tabela_Perfil**: Tabela `user_profiles` no Supabase.
- **Tabela_Despesas**: Tabela `expenses` no Supabase.
- **Tabela_Ganhos_Extras**: Tabela `extra_incomes` no Supabase.

## Requisitos

### Requisito 1: Armazenamento do dia de pagamento mensal

**User Story:** Como um Usuário_Mensal, eu quero que o sistema armazene o dia do mês em que recebo meu salário, para que o app saiba quando minha renda entra.

#### Critérios de Aceitação

1. THE Tabela_Perfil SHALL have a nullable integer column `dia_pagamento_mensal` with values between 1 and 31.
2. WHILE the `ciclo_tipo` is `'mensal'`, THE App SHALL store the payment day in the `dia_pagamento_mensal` column of the Tabela_Perfil.
3. WHILE the `ciclo_tipo` is `'15_ultimo'` or `'5_20'`, THE App SHALL keep `dia_pagamento_mensal` as NULL in the Tabela_Perfil.

### Requisito 2: Campo quinzena opcional para despesas de Usuário_Mensal

**User Story:** Como um Usuário_Mensal, eu quero que minhas despesas não exijam uma quinzena, para que eu não precise preencher um campo irrelevante.

#### Critérios de Aceitação

1. THE Tabela_Despesas SHALL allow the `quinzena` column to be NULL.
2. WHILE the user is a Usuário_Mensal, THE Schema_Despesa SHALL accept `quinzena` as optional (undefined or null).
3. WHILE the user is a Usuário_Quinzenal, THE Schema_Despesa SHALL require `quinzena` with value `'1'` or `'2'`.
4. WHEN a Usuário_Mensal creates a new expense, THE App SHALL insert the expense with `quinzena` set to NULL in the Tabela_Despesas.

### Requisito 3: Campo quinzena opcional para ganhos extras de Usuário_Mensal

**User Story:** Como um Usuário_Mensal, eu quero que meus ganhos extras não exijam uma quinzena, para que o cadastro seja simples.

#### Critérios de Aceitação

1. THE Tabela_Ganhos_Extras SHALL allow the `quinzena` column to be NULL.
2. WHILE the user is a Usuário_Mensal, THE Schema_Ganho_Extra SHALL accept `quinzena` as optional (undefined or null).
3. WHILE the user is a Usuário_Quinzenal, THE Schema_Ganho_Extra SHALL require `quinzena` with value `'1'` or `'2'`.
4. WHEN a Usuário_Mensal creates a new extra income, THE App SHALL insert the extra income with `quinzena` set to NULL in the Tabela_Ganhos_Extras.

### Requisito 4: Onboarding adaptado para ciclo mensal

**User Story:** Como um novo usuário que recebe mensalmente, eu quero que o onboarding me pergunte apenas o dia do pagamento e o salário total, para que eu não veja campos de quinzena irrelevantes.

#### Critérios de Aceitação

1. WHEN the user selects "Mensal" in step 1 of the Onboarding, THE Onboarding SHALL display a Campo_Dia_Pagamento asking which day of the month the user gets paid.
2. WHEN the user selects "Mensal" in step 1, THE Onboarding SHALL hide the quinzena cycle sub-options ("Dia 15 e Último dia útil" and "5º dia útil e Dia 20") in step 1.
3. WHEN the user selects "Mensal" and proceeds to step 2, THE Onboarding SHALL display only the "Salário bruto" and "Salário líquido" fields.
4. WHEN the user selects "Mensal" and proceeds to step 2, THE Onboarding SHALL hide the "Valor quinzena 1" and "Valor quinzena 2" fields.
5. WHEN the user finishes the Onboarding with "Mensal" selected, THE App SHALL save `ciclo_tipo` as `'mensal'`, `dia_pagamento_mensal` as the selected day, `quinzena_1_valor` as 0, and `quinzena_2_valor` as 0 in the Tabela_Perfil.
6. WHEN the user finishes the Onboarding with "Mensal" selected, THE App SHALL save `salario_liquido` as the total net salary entered in the Tabela_Perfil.

### Requisito 5: Dashboard adaptado para Usuário_Mensal

**User Story:** Como um Usuário_Mensal, eu quero que o Dashboard mostre apenas o mês completo sem filtros de quinzena, para que a interface reflita meu ciclo de pagamento.

#### Critérios de Aceitação

1. WHILE the user is a Usuário_Mensal, THE Dashboard SHALL hide the Filtro_Quinzena pills (the buttons "Dia 15" / "Último dia útil" or "5º dia útil" / "Dia 20").
2. WHILE the user is a Usuário_Mensal, THE Dashboard SHALL display only the "Mês Completo" view without filter options.
3. WHILE the user is a Usuário_Mensal, THE Dashboard SHALL display the full `salario_liquido` as the income value in the balance card.
4. WHILE the user is a Usuário_Mensal, THE Dashboard income edit modal SHALL display a single "Salário líquido" field instead of two quinzena value fields.
5. WHILE the user is a Usuário_Mensal, THE Dashboard income edit modal SHALL hide the Seletor_Quinzena in the extra income inline form.
6. WHILE the user is a Usuário_Mensal, THE Dashboard extra income list SHALL hide the quinzena badge ("Q1" / "Q2") on each item.

### Requisito 6: Tela de Despesas adaptada para Usuário_Mensal

**User Story:** Como um Usuário_Mensal, eu quero que a tela de despesas não mostre campos ou filtros de quinzena, para que eu gerencie minhas despesas sem conceitos irrelevantes.

#### Critérios de Aceitação

1. WHILE the user is a Usuário_Mensal, THE Tela_Despesas SHALL hide the Filtro_Quinzena pills.
2. WHILE the user is a Usuário_Mensal, THE Tela_Despesas add expense modal SHALL hide the Seletor_Quinzena field.
3. WHILE the user is a Usuário_Mensal, THE Tela_Despesas edit expense modal SHALL hide the Seletor_Quinzena field.
4. WHILE the user is a Usuário_Mensal, WHEN a new expense is submitted, THE Tela_Despesas SHALL omit the `quinzena` field from the form data sent to the service layer.

### Requisito 7: Consultas de despesas compatíveis com perfil mensal

**User Story:** Como um Usuário_Mensal, eu quero que todas as minhas despesas apareçam sem filtro de quinzena, para que eu veja o panorama completo do mês.

#### Critérios de Aceitação

1. WHILE the user is a Usuário_Mensal, THE App SHALL fetch expenses without applying any quinzena filter in the query to the Tabela_Despesas.
2. WHILE the user is a Usuário_Mensal, THE App SHALL include expenses with `quinzena` NULL in all listing results.
3. THE `filterByQuinzena` utility function SHALL handle items where `quinzena` is NULL by including them when the filter is `'all'` and excluding them when the filter is a specific quinzena value.

### Requisito 8: Consultas de ganhos extras compatíveis com perfil mensal

**User Story:** Como um Usuário_Mensal, eu quero que todos os meus ganhos extras apareçam sem filtro de quinzena, para que eu veja o total correto.

#### Critérios de Aceitação

1. WHILE the user is a Usuário_Mensal, THE Dashboard SHALL sum all extra incomes regardless of `quinzena` value when calculating `totalExtraIncomes`.
2. WHILE the user is a Usuário_Mensal, THE App SHALL include extra incomes with `quinzena` NULL in all listing results.

### Requisito 9: Cálculo de saldo correto para Usuário_Mensal

**User Story:** Como um Usuário_Mensal, eu quero que o saldo real disponível seja calculado corretamente usando meu salário mensal completo, para que eu tenha uma visão precisa das minhas finanças.

#### Critérios de Aceitação

1. WHILE the user is a Usuário_Mensal, THE Dashboard SHALL calculate `saldoReal` as `salario_liquido + totalExtraIncomes - totalExpenses`.
2. WHILE the user is a Usuário_Mensal, THE Dashboard SHALL use the full `salario_liquido` value as income, ignoring `quinzena_1_valor` and `quinzena_2_valor`.

### Requisito 10: Tratamento de erros no Campo_Dia_Pagamento

**User Story:** Como um novo usuário, eu quero que o sistema valide o dia de pagamento informado, para que eu não cadastre um valor inválido.

#### Critérios de Aceitação

1. IF the user enters a value less than 1 or greater than 31 in the Campo_Dia_Pagamento, THEN THE Onboarding SHALL display a validation error message "Dia deve ser entre 1 e 31".
2. IF the user selects "Mensal" but does not provide a day in the Campo_Dia_Pagamento, THEN THE Onboarding SHALL prevent advancing to the next step.
