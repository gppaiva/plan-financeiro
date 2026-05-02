# Plan Financeiro — Notas de Sessão

## Sobre o Projeto

- **App**: Planejador financeiro pessoal (Plan Financeiro)
- **Stack**: React + TypeScript + Vite + Supabase + Zustand + Zod + Tailwind CSS
- **Deploy**: Vercel (auto-deploy do branch `main`)
- **Repo**: https://github.com/gppaiva/plan-financeiro
- **Desenvolvedor**: Gustavo Paiva
- **Versão atual**: 1.0.4 (auto-incrementa a cada push via `scripts/bump-version.js`)

## Arquitetura

- **Frontend**: React com inline styles (não Tailwind classes na maioria dos componentes)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Estado**: Zustand stores com optimistic updates e rollback
- **Validação**: Zod schemas (com factories condicionais para mensal/quinzenal)
- **Tema**: CSS variables em `src/index.css`, toggle via `useThemeStore`, padrão escuro
- **Versionamento**: `src/version.ts` + `scripts/bump-version.js` + hook Kiro `bump-version`

## Estrutura de Specs

- `.kiro/specs/financial-planner/` — spec original do projeto completo (tasks.md)
- `.kiro/specs/extra-monthly-income/` — feature de ganhos extras mensais
- `.kiro/specs/recurring-expense-edit-scope/` — bugfix de escopo de edição de despesa recorrente
- `.kiro/specs/monthly-payment-profile/` — feature de perfil de pagamento mensal

## Migrations SQL (ordem)

1. `001_initial_schema.sql` — 6 tabelas base + RLS
2. `002_add_quinzena_values.sql` — valores de quinzena no perfil
3. `003_add_ciclo_tipo.sql` — campo ciclo_tipo no perfil
4. `004_add_data_final.sql` — data final para despesas recorrentes
5. `005_expense_payments.sql` — tabela expense_payments para status mensal de recorrentes
6. `006_extra_incomes_quinzena.sql` — coluna quinzena em extra_incomes
7. `007_expense_overrides.sql` — tabela expense_overrides para edição com escopo
8. `008_monthly_profile.sql` — dia_pagamento_mensal + quinzena nullable em expenses e extra_incomes

## Features Implementadas Nesta Sessão

### 1. Ganhos Extras Mensais (extra-monthly-income)
- CRUD completo de ganhos extras (13°, férias, PLR, etc.)
- Integrado dentro do modal "Editar Saldo do Mês" no dashboard
- Cada ganho extra é vinculado a uma quinzena (para usuários quinzenais)
- Saldo recalcula: salário + extras - despesas
- Mini-card "Extras" no card de saldo azul
- Arquivos: schema, service, store, componentes inline no DashboardPage
- Tabela: `extra_incomes` (já existia, adicionamos coluna `quinzena`)

### 2. Escopo de Edição de Despesa Recorrente (recurring-expense-edit-scope)
- Ao editar despesa recorrente, pergunta: "Apenas este mês" ou "Este mês e todos os futuros"
- "Apenas este mês" → cria override na tabela `expense_overrides`
- "Este mês e todos os futuros" → atualiza registro base
- Despesas não recorrentes continuam salvando direto
- Modal de escopo usando componente Modal existente com inline styles
- Tabela: `expense_overrides` (nova)

### 3. Perfil de Pagamento Mensal (monthly-payment-profile)
- Suporte completo para usuários que recebem 1x por mês
- Onboarding: pergunta dia do pagamento (1-31), esconde campos de quinzena
- Dashboard: esconde filtros de quinzena, usa salário completo
- Despesas: esconde seletor de quinzena nos modais
- Extras: esconde seletor de quinzena
- Schema factories: `createExpenseSchema(cicloTipo)` e `createExtraIncomeSchema(cicloTipo)`
- Helper: `isMensal(cicloTipo)` em `src/lib/quinzena.ts`
- Quinzena agora nullable nas tabelas expenses e extra_incomes

### 4. Filtro de Quinzena por Aba
- Dashboard: filtros "Mês Completo", "Dia 15", "Último dia útil" (escondidos para mensal)
- Despesas: filtros "Todas", "Dia 15", "Último dia útil" (escondidos para mensal)
- Saldo recalcula baseado na quinzena selecionada (usa quinzena_1_valor ou quinzena_2_valor)

### 5. Categoria como Primeiro Campo
- No modal "Nova Despesa", categoria é o primeiro campo selecionado

### 6. Dark Mode Completo
- Todas as telas convertidas de cores hardcoded para CSS variables
- Tema escuro como padrão (`isDark: true`, `data-theme="dark"` no HTML)
- Removida lógica que detectava preferência do sistema e sobrescrevia o tema
- Arquivos afetados: DashboardPage, TransactionsPage, ReportsPage, ThirdPartyPage, InvestmentsPage, AuthPage, OnboardingPage, Modal, Header, TabBar, PageContainer, MonthYearSelector, ExtraIncomeList

### 7. Logo
- `src/assets/logologinNew.png` — logo completo na tela de login
- `src/assets/logoapenasNew.png` — ícone pequeno no header e onboarding

### 8. Menu Lateral (Settings)
- Botão de engrenagem no header (substituiu botão de sair)
- Drawer lateral pela direita com: "Sobre" e "Sair"
- "Sobre" mostra versão dinâmica do app

### 9. Remoção do Login com Google
- Botão "Entrar com Google" removido (precisa configuração no Supabase/Google Cloud)
- Divider "ou" removido

### 10. Layout Fixes
- Mini-cards no card de saldo: font-size reduzido, overflow hidden, text-overflow ellipsis
- Filtros de quinzena centralizados
- Alinhamento geral corrigido

## Decisões de Design Importantes

- **Inline styles**: O projeto usa inline styles em vez de Tailwind classes na maioria dos componentes. Manter esse padrão.
- **CSS variables**: Todas as cores devem usar `var(--bg)`, `var(--card-bg)`, `var(--text)`, `var(--text2)`, `var(--border)`. Cores de acento (azul, verde, vermelho, laranja) ficam hardcoded.
- **Componentes existentes**: Usar Modal, Input, Button, Toast existentes. Não criar novos componentes de UI.
- **`useProfile()` como fonte de verdade**: O `ciclo_tipo` do perfil determina o que mostrar/esconder em todas as telas.
- **Schemas condicionais**: Usar `createExpenseSchema(cicloTipo)` e `createExtraIncomeSchema(cicloTipo)` para validação.

## Preferências do Usuário (Gustavo)

- Prefere tema escuro
- Quer dinâmica e agilidade — implementar direto sem muita cerimônia
- Não quer novos designs/styles — usar os componentes e padrões existentes
- Quer push direto no main (sem PRs formais)
- Quer versionamento automático (patch increment a cada push)
- Comunicação em português brasileiro

## Como Recuperar Contexto em Nova Sessão

Ao iniciar nova sessão, pedir para ler:
1. Este arquivo (`.kiro/SESSION_NOTES.md`)
2. `.kiro/specs/financial-planner/tasks.md` — estado geral do projeto
3. `src/version.ts` — versão atual
4. `package.json` — dependências e scripts

### 13. Autenticação Biométrica (WebAuthn)
- Desbloqueio por Face ID / Touch ID / Windows Hello
- Após primeiro login, pergunta se quer ativar biometria
- Nas próximas aberturas, mostra tela de desbloqueio biométrico
- Fallback "Usar senha" faz logout e volta pro login normal
- Toggle no menu lateral (engrenagem) para ativar/desativar
- Arquivo: `src/lib/biometric.ts` (serviço WebAuthn)
- Lock screen no `App.tsx` (BiometricLockScreen component)
- Requer HTTPS em produção (funciona em localhost para dev)

### 14. Instruções de Instalação no Celular
- Botão "Instalar no celular" na tela de login
- Modal com passo a passo para iPhone (Safari) e Android (Chrome)
- 4 passos numerados para cada plataforma com instruções claras

### 15. Login por Username ou Email
- Campo de login aceita email OU nome de usuário
- Se não tem `@`, busca o email via RPC `get_email_by_username` (SECURITY DEFINER, bypassa RLS)
- Username salvo no cadastro (auth metadata + user_profiles.username)
- Migration 009: coluna `username` (UNIQUE) + função RPC pública
- Onboarding salva username do metadata no perfil

### 16. Importação de Fatura de Cartão de Crédito (Fase 1 — CSV C6)
- Botão "Cadastrar Fatura" na aba de despesas
- Upload de CSV ou ZIP (extrai CSV de dentro via JSZip)
- Parser C6: separador `;`, datas DD/MM/YYYY, exclui valores negativos
- Cria UMA despesa "Cartão" com total + itens individuais na tabela `invoice_items`
- Ao clicar na despesa "Cartão", abre detalhe com lista de itens
- Edição inline de valores individuais com recálculo do total
- Migration 010: tabela `invoice_items` com FK CASCADE, RLS, índices
- Arquivos: invoice-csv-parser.ts, invoice.schema.ts, invoice.service.ts, InvoiceImportModal.tsx, InvoiceDetailModal.tsx
- Dependência: JSZip para extração de ZIP
- Fase 2 (futura): parsing de PDF (Bradesco + C6) com suporte a senha

### 17. ZIP com Senha — @zip.js/zip.js
- Substituiu JSZip por `@zip.js/zip.js` que suporta ZIP protegido com senha
- Campo de senha aparece automaticamente quando ZIP é criptografado
- Botão "Desbloquear" tenta extrair com a senha informada
- Mensagem "Senha incorreta" se errar

### 18. Detalhe da Fatura — Fluxo de Abertura
- Clicar na despesa "Cartão" abre o modal de edição normal (como qualquer despesa)
- No modal de edição, campo de valor fica desabilitado e aparece botão "Ver transações da fatura"
- Clicar no botão abre o InvoiceDetailModal com a lista de transações

### 19. Direcionar Gasto para Terceiro (a partir da fatura)
- Cada item da fatura tem botão "Direcionar gasto"
- Formulário inline: nome da pessoa + campo de valor (pré-preenchido com valor total)
- Pode direcionar valor parcial ou total
- Valor direcionado é subtraído do item da fatura
- Se valor fica 0, item é removido da fatura
- Total da fatura recalcula automaticamente
- Migration 011: coluna `source_invoice_item_id` em `third_party_expenses` (FK → invoice_items)

### 20. Retorno de Valor ao Excluir Terceiro
- Ao excluir despesa de terceiro que veio de uma fatura, o valor retorna ao item original
- Verifica `source_invoice_item_id` antes de deletar
- Soma o valor de volta no invoice_item e recalcula total da fatura

### 21. Merge de Fatura no Re-upload
- Se fizer upload da mesma fatura (mesmo banco + data de vencimento), sistema complementa
- Compara itens por `data_compra + descricao + valor`
- Adiciona só os novos, ignora duplicados
- Recalcula total com os novos itens
- Se todos já existem, mostra "Nenhuma transação nova encontrada"

### 22. Correção de Parsing de Valores CSV
- Parser agora detecta automaticamente formato decimal (ponto ou vírgula)
- `50.00` → ponto é decimal (formato C6)
- `1.234,56` → ponto é milhar, vírgula é decimal (formato brasileiro)

### Versão Atual: 1.0.24

### Migrations Pendentes (rodar no Supabase)
- `010_invoice_items.sql` — tabela de itens de fatura
- `011_third_party_invoice_link.sql` — link terceiro → item de fatura
