# Plano de Implementação: Plan. Financeiro

## Visão Geral

Reconstrução completa do Plan. Financeiro como aplicação React + TypeScript + Vite com Supabase como backend. A implementação segue uma abordagem incremental: primeiro a infraestrutura e tipos base, depois os módulos de dados e serviços, em seguida as stores Zustand, e por fim as páginas e componentes visuais — finalizando com integração e testes.

## Tarefas

- [x] 1. Configurar estrutura do projeto e dependências
  - Inicializar projeto Vite com template React + TypeScript
  - Instalar dependências: `react-router-dom`, `zustand`, `@supabase/supabase-js`, `zod`, `recharts`, `tailwindcss`, `vitest`, `fast-check`, `@testing-library/react`
  - Configurar Tailwind CSS com variáveis CSS para tema claro/escuro em `src/index.css`
  - Criar estrutura de diretórios conforme design: `components/`, `pages/`, `services/`, `stores/`, `schemas/`, `types/`, `lib/`, `hooks/`
  - Configurar Vitest em `vitest.config.ts`
  - _Requisitos: 11.1, 11.2, 11.3_

- [x] 2. Definir tipos TypeScript e schemas Zod
  - [x] 2.1 Criar tipos base em `src/types/index.ts`
    - Definir interfaces: `UserProfile`, `Expense`, `ThirdPartyExpense`, `InvestmentAccount`, `InvestmentTransaction`, `ExtraIncome`
    - Definir tipos auxiliares: `ExpenseStatus`, `ExpenseCategory`, `Quinzena`, `ExpenseFilters`
    - Definir tipos de resultado: `AuthResult`, `PersonTotal`
    - _Requisitos: 4.7, 5.2, 6.2, 11.1_

  - [x] 2.2 Criar schemas Zod em `src/schemas/`
    - Implementar `expense.schema.ts` com validação de descrição, valor positivo, categoria, quinzena, data e status
    - Implementar `investment.schema.ts` com validação de conta (nome, tipo, cor hex) e transação (descrição, valor, tipo, data)
    - Implementar `third-party.schema.ts` com validação incluindo `person_name` obrigatório
    - Implementar `profile.schema.ts` com validação de nome, e-mail, telefone, salários e distribuição por quinzena
    - _Requisitos: 4.6, 5.2, 6.2, 2.2, 2.3, 2.4_

  - [ ]* 2.3 Escrever teste de propriedade para validação de despesa (rejeição de entrada inválida)
    - **Propriedade 8: Validação rejeita entrada inválida de despesa**
    - Gerar entradas com campos obrigatórios vazios ou inválidos usando fast-check e verificar que o schema Zod falha com erros nos campos corretos
    - **Valida: Requisito 4.6**

  - [ ]* 2.4 Escrever teste de propriedade para criação de despesa round-trip
    - **Propriedade 6: Criação de despesa round-trip**
    - Gerar entradas válidas com fast-check, validar com schema Zod, e verificar que o parse retorna os mesmos dados da entrada
    - **Valida: Requisito 4.3**

- [x] 3. Configurar cliente Supabase e utilitários
  - [x] 3.1 Criar cliente Supabase em `src/lib/supabase.ts`
    - Configurar `createClient` com variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
    - Exportar instância tipada do cliente
    - _Requisitos: 9.1, 9.2_

  - [x] 3.2 Criar utilitários em `src/lib/`
    - Implementar `format.ts` com funções de formatação de moeda brasileira (R$) e datas
    - Implementar `quinzena.ts` com lógica de cálculo de quinzenas (dia 15, último dia útil) e filtros por período
    - _Requisitos: 3.4, 3.5_

  - [x] 3.3 Criar scripts SQL para tabelas e RLS
    - Criar arquivo `supabase/migrations/001_initial_schema.sql` com as 6 tabelas: `user_profiles`, `expenses`, `third_party_expenses`, `investment_accounts`, `investment_transactions`, `extra_incomes`
    - Incluir constraints (CHECK, NOT NULL, FK), índices e políticas RLS conforme design
    - _Requisitos: 9.1, 1.5_

- [x] 4. Checkpoint — Verificar estrutura base
  - Garantir que todas as dependências estão instaladas, tipos compilam sem erros, schemas Zod estão corretos e o projeto builda com sucesso.

- [x] 5. Implementar camada de serviços
  - [x] 5.1 Implementar `src/services/auth.service.ts`
    - Implementar `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signOut`, `getSession`, `onAuthStateChange`
    - Usar cliente Supabase para todas as operações de autenticação
    - _Requisitos: 1.1, 1.2, 1.3, 1.6_

  - [x] 5.2 Implementar `src/services/profile.service.ts`
    - Implementar `get`, `create`, `update`, `hasCompletedOnboarding`
    - Queries na tabela `user_profiles` filtradas por `auth_user_id`
    - _Requisitos: 2.6, 9.1, 9.2_

  - [x] 5.3 Implementar `src/services/expenses.service.ts`
    - Implementar `list` (com filtros por quinzena e período), `create`, `update`, `delete`, `toggleStatus`
    - Validar dados com schema Zod antes de enviar ao Supabase
    - _Requisitos: 4.1, 4.3, 4.5, 9.2_

  - [x] 5.4 Implementar `src/services/third-party.service.ts`
    - Implementar `list`, `create`, `update`, `delete`, `toggleStatus`, `getTotalByPerson`
    - Incluir agrupamento por `person_name` no `getTotalByPerson`
    - _Requisitos: 5.1, 5.2, 5.4, 5.5_

  - [x] 5.5 Implementar `src/services/investments.service.ts`
    - Implementar `listAccounts`, `createAccount`, `listTransactions`, `addDeposit`, `addWithdrawal`, `getAccountBalance`, `getTotalInvested`
    - Calcular saldo como soma de depósitos menos soma de resgates
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.6 Implementar `src/services/reports.service.ts`
    - Implementar funções para agregar despesas por categoria, calcular percentuais e evolução mensal
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

- [x] 6. Implementar stores Zustand
  - [x] 6.1 Implementar `src/stores/auth.store.ts`
    - Estado: `user`, `session`, `loading`
    - Actions: `setUser`, `setSession`, `setLoading`
    - _Requisitos: 1.1, 1.5_

  - [x] 6.2 Implementar `src/stores/theme.store.ts`
    - Estado: `isDark`
    - Actions: `toggle`, `setTheme`
    - Persistir preferência via `profile.service` e aplicar variáveis CSS no `document.documentElement`
    - _Requisitos: 8.1, 8.2, 8.3_

  - [x] 6.3 Implementar `src/stores/expenses.store.ts`
    - Estado: `expenses`, `loading`
    - Actions: `fetchExpenses`, `addExpense`, `toggleExpenseStatus`, `removeExpense`
    - Rollback do estado em caso de erro na persistência
    - _Requisitos: 4.1, 4.3, 4.5, 9.4_

  - [x] 6.4 Implementar `src/stores/third-party.store.ts`
    - Estado: `expenses`, `loading`
    - Actions: `fetchExpenses`, `addExpense`, `toggleStatus`, `removeExpense`
    - Rollback do estado em caso de erro na persistência
    - _Requisitos: 5.1, 5.4, 5.5, 9.4_

  - [x] 6.5 Implementar `src/stores/investments.store.ts`
    - Estado: `accounts`, `transactions`, `loading`
    - Actions: `fetchAccounts`, `createAccount`, `addDeposit`, `addWithdrawal`, `fetchTransactions`
    - Rollback do estado em caso de erro na persistência
    - _Requisitos: 6.1, 6.3, 6.4, 6.6, 9.4_

  - [x] 6.6 Implementar `src/stores/onboarding.store.ts`
    - Estado: `step`, `data` (dados de cada etapa)
    - Actions: `nextStep`, `prevStep`, `setStepData`, `complete`
    - Preservar dados ao navegar entre etapas
    - _Requisitos: 2.1, 2.7, 2.8_

  - [ ]* 6.7 Escrever teste de propriedade para toggle de status (involução)
    - **Propriedade 7: Toggle de status é uma involução**
    - Gerar despesas com status aleatório, aplicar toggle uma vez (verificar inversão) e duas vezes (verificar retorno ao original)
    - **Valida: Requisitos 4.5, 5.5**

  - [ ]* 6.8 Escrever teste de propriedade para preservação de estado em erro de persistência
    - **Propriedade 13: Estado preservado em caso de erro de persistência**
    - Simular falha no serviço, executar operação no store, e verificar que o estado permanece inalterado
    - **Valida: Requisito 9.4**

- [x] 7. Checkpoint — Verificar camada de dados
  - Garantir que todos os serviços e stores compilam, testes de propriedade passam, e a integração serviço→store funciona corretamente.

- [ ] 8. Implementar componentes UI base
  - [x] 8.1 Criar componentes base em `src/components/ui/`
    - Implementar `Button`, `Input`, `Card`, `Modal`, `Toast`, `Badge`, `Select`
    - Usar Tailwind CSS com suporte a tema claro/escuro via variáveis CSS
    - Garantir acessibilidade (aria-labels, roles, foco visível)
    - _Requisitos: 8.2, 10.1, 10.2_

  - [x] 8.2 Criar componentes de layout em `src/components/layout/`
    - Implementar `Header` com botão de tema e nome do usuário
    - Implementar `TabBar` (barra de navegação inferior) com 5 abas: Início, Transações, Terceiros, Investimentos, Relatórios
    - Implementar `PageContainer` com container de 390px base e responsividade
    - _Requisitos: 8.1, 10.1, 10.2, 10.3_

  - [x] 8.3 Criar componentes de gráficos em `src/components/charts/`
    - Implementar `CategoryPieChart` usando Recharts para gráfico de pizza por categoria
    - Implementar `MonthlyEvolutionChart` usando Recharts para gráfico de barras de evolução mensal
    - _Requisitos: 7.1, 7.2_

- [ ] 9. Implementar roteamento e autenticação
  - [x] 9.1 Configurar React Router em `src/App.tsx`
    - Definir rotas: `/` (auth), `/onboarding`, `/dashboard`, `/transactions`, `/third-party`, `/investments`, `/reports`
    - Criar componente `ProtectedRoute` que verifica sessão e redireciona para login se não autenticado
    - Criar componente `AuthRoute` que redireciona para dashboard se já autenticado
    - _Requisitos: 1.5, 1.1_

  - [x] 9.2 Implementar `src/pages/auth/AuthPage.tsx`
    - Formulário de login com e-mail/senha
    - Formulário de cadastro com nome, e-mail, senha
    - Botão de login com Google
    - Alternância entre modo login e cadastro
    - Mensagens de erro genéricas para credenciais inválidas
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 9.3 Escrever teste de propriedade para rotas protegidas
    - **Propriedade 1: Rotas protegidas redirecionam usuários não autenticados**
    - Para qualquer rota protegida, verificar que sem sessão o componente redireciona para login
    - **Valida: Requisito 1.5**

- [ ] 10. Implementar Onboarding
  - [x] 10.1 Implementar `src/pages/onboarding/OnboardingPage.tsx`
    - Wizard de 4 etapas com barra de progresso
    - Etapa 1: Dados pessoais (nome, e-mail, telefone)
    - Etapa 2: Ciclo de pagamento (seleção de quinzena)
    - Etapa 3: Renda (salário bruto, líquido, distribuição por quinzena)
    - Etapa 4: Rendimentos extras (hora extra, PLR, bonificações)
    - Navegação avançar/voltar preservando dados entre etapas
    - Ao finalizar, salvar perfil via `profile.service` e redirecionar para dashboard
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 10.2 Escrever teste de propriedade para navegação de volta no onboarding
    - **Propriedade 2: Navegação de volta no onboarding preserva dados**
    - Gerar dados aleatórios para etapas, avançar e voltar, verificar que dados são preservados
    - **Valida: Requisito 2.8**

- [ ] 11. Implementar Dashboard
  - [x] 11.1 Implementar `src/pages/dashboard/DashboardPage.tsx`
    - Exibir `BalanceCard` com saldo real (receita - despesas pessoais, excluindo terceiros)
    - Exibir `StatsGrid` com cards de receita total, despesas totais e gastos com terceiros
    - Implementar filtro de quinzena (Mês Completo, Dia 15, Último dia útil)
    - Implementar `CategoryList` com agrupamento por categoria (total e contagem)
    - Implementar `CategoryDetail` com lista expandível de despesas por categoria
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 11.2 Escrever teste de propriedade para saldo pessoal excluindo terceiros
  - [ ]* 11.3 Escrever teste de propriedade para filtro de quinzena
  - [ ]* 11.4 Escrever teste de propriedade para agrupamento por categoria

- [ ] 12. Implementar Transações (Despesas)
  - [x] 12.1 Implementar `src/pages/transactions/TransactionsPage.tsx`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 12.2 Escrever testes unitários para TransactionsPage

- [ ] 13. Implementar Despesas com Terceiros
  - [x] 13.1 Implementar `src/pages/third-party/ThirdPartyPage.tsx`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 13.2 Escrever teste de propriedade para agrupamento por pessoa

- [ ] 14. Implementar Investimentos
  - [x] 14.1 Implementar `src/pages/investments/InvestmentsPage.tsx`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 14.2 Escrever teste de propriedade para saldo de investimento
  - [ ]* 14.3 Escrever teste de propriedade para total consolidado

- [x] 15. Checkpoint — Verificar páginas principais

- [ ] 16. Implementar Relatórios
  - [x] 16.1 Implementar `src/pages/reports/ReportsPage.tsx`
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 16.2 Escrever teste de propriedade para percentuais por categoria

- [ ] 17. Implementar tema claro/escuro e navegação com estado preservado
  - [x] 17.1 Integrar tema claro/escuro
    - _Requisitos: 8.1, 8.2, 8.3_
  - [x] 17.2 Implementar preservação de estado entre abas
    - _Requisitos: 10.3, 10.4_
  - [ ]* 17.3 Escrever teste de propriedade para preservação de estado da aba

- [ ] 18. Implementar tratamento de erros global
  - [x] 18.1 Implementar Error Boundary e sistema de toast
    - _Requisitos: 1.4, 9.4_

- [ ] 19. Integração final e wiring
  - [x] 19.1 Conectar todos os componentes
    - _Requisitos: 1.1, 1.5, 1.6, 2.6, 9.3_
  - [ ]* 19.2 Escrever testes de integração

- [x] 20. Checkpoint final — Garantir que todos os testes passam

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
