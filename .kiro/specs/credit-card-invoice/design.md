# Design: Importação de Fatura de Cartão de Crédito

## Visão Geral

Esta feature adiciona a capacidade de importar faturas de cartão de crédito a partir de arquivos CSV (formato C6, separador `;`) e opcionalmente ZIP (contendo o CSV). O fluxo principal é:

1. Usuário clica em "Cadastrar Fatura" na tela de despesas
2. Modal abre com campo de upload (`.csv` ou `.zip`), data de vencimento e quinzena
3. O sistema faz parsing do CSV, exibe resumo (banco, qtd itens, total)
4. Usuário confirma e o sistema cria uma despesa "Cartão" + itens na tabela `invoice_items`
5. Ao clicar na despesa "Cartão", abre modal de detalhe com lista de itens editáveis

A arquitetura segue os padrões existentes: parser puro em `src/lib/`, schema Zod em `src/schemas/`, service Supabase em `src/services/`, store Zustand em `src/stores/`, e UI com inline styles + Modal existente.

## Arquitetura

```mermaid
flowchart TD
    A[TransactionsPage] -->|clique "Cadastrar Fatura"| B[InvoiceImportModal]
    B -->|upload .csv/.zip| C{Tipo de arquivo?}
    C -->|.csv| D[parseC6Csv]
    C -->|.zip| E[JSZip extract]
    E -->|CSV extraído| D
    D -->|InvoiceItem[]| F[Resumo no Modal]
    F -->|confirma| G[invoice.service.ts]
    G -->|insert expense + items| H[(Supabase)]
    
    A -->|clique despesa Cartão| I[InvoiceDetailModal]
    I -->|fetch items| J[invoice.service.ts]
    J -->|invoice_items| I
    I -->|edita valor item| K[invoice.service.ts.updateItem]
    K -->|recalcula total| H
```

### Camadas

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Parser | `src/lib/invoice-csv-parser.ts` | Parsing/pretty-printing CSV C6, extração ZIP via JSZip |
| Schema | `src/schemas/invoice.schema.ts` | Validação Zod dos itens e do formulário de importação |
| Service | `src/services/invoice.service.ts` | CRUD Supabase: criar fatura+itens, listar itens, atualizar item, recalcular total |
| Store | `src/stores/expenses.store.ts` | Extensão do store existente (sem novo store) |
| UI | `src/pages/transactions/InvoiceImportModal.tsx` | Modal de upload e confirmação |
| UI | `src/pages/transactions/InvoiceDetailModal.tsx` | Modal de detalhe/edição dos itens |
| Migration | `supabase/migrations/010_invoice_items.sql` | Tabela `invoice_items` + RLS + índices |

## Componentes e Interfaces

### 1. Parser CSV C6 (`src/lib/invoice-csv-parser.ts`)

```typescript
/** Representa um item extraído do CSV C6 */
export interface C6InvoiceItem {
  dataCompra: string       // ISO format YYYY-MM-DD
  nomeCartao: string       // "GUSTAVO PAIVA"
  finalCartao: string      // "0083"
  categoriaC6: string      // Categoria original do C6
  descricao: string        // "NOVA BABY TRIGO"
  parcela: string          // "Única", "1/3", etc.
  valorUsd: number         // Valor em US$ (0 para compras nacionais)
  cotacao: number          // Cotação em R$ (0 para compras nacionais)
  valorBrl: number         // Valor em R$ (sempre positivo após filtro)
}

/** Resultado do parsing */
export interface C6ParseResult {
  items: C6InvoiceItem[]
  totalBrl: number
  banco: string            // "C6"
}

/** Resultado do parsing com possíveis erros */
export type C6ParseOutcome =
  | { success: true; data: C6ParseResult }
  | { success: false; error: string }

/**
 * Faz parsing do conteúdo CSV no formato C6.
 * - Separador: ponto-e-vírgula
 * - Ignora cabeçalho (primeira linha)
 * - Exclui linhas com valor negativo (pagamentos/créditos)
 * - Ignora linhas com formato inválido
 */
export function parseC6Csv(content: string): C6ParseOutcome

/**
 * Converte uma lista de C6InvoiceItem de volta para o formato CSV C6.
 * Usado para validação round-trip.
 */
export function prettyPrintC6Csv(items: C6InvoiceItem[]): string

/**
 * Extrai o conteúdo CSV de um arquivo ZIP usando JSZip.
 * Procura o primeiro arquivo .csv dentro do ZIP.
 */
export async function extractCsvFromZip(zipData: ArrayBuffer): Promise<string>
```

**Decisões de design:**
- O parser é uma função pura (sem side effects), facilitando testes unitários e property-based testing.
- Valores negativos são filtrados no parsing (representam pagamentos/créditos no extrato C6).
- Linhas com formato inválido são silenciosamente ignoradas (requisito 9.1).
- A extração ZIP é separada do parsing CSV para manter responsabilidades claras.
- Descrições no CSV podem conter espaços extras — o parser faz `trim()` em todos os campos string.
- Valores numéricos usam vírgula como separador decimal no CSV (ex: `18,58`), convertidos para `number`.

### 2. Schema Zod (`src/schemas/invoice.schema.ts`)

```typescript
import { z } from 'zod'

/** Schema para um item de fatura (validação no momento da importação) */
export const invoiceItemSchema = z.object({
  dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  descricao: z.string().min(1).max(255),
  categoriaC6: z.string().max(100),
  parcela: z.string().max(50),
  valorBrl: z.number().positive('Valor deve ser positivo'),
})

/** Schema para o formulário de importação */
export const invoiceImportSchema = z.object({
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida'),
  quinzena: z.enum(['1', '2']).nullish(),
})

export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>
export type InvoiceImportFormData = z.infer<typeof invoiceImportSchema>
```

### 3. Service (`src/services/invoice.service.ts`)

```typescript
import type { Expense } from '../types'

/** Tipo do item de fatura como retornado do banco */
export interface InvoiceItem {
  id: string
  expense_id: string
  data_compra: string
  descricao: string
  categoria_c6: string
  parcela: string
  valor: number
  created_at: string
}

/**
 * Cria uma fatura (expense categoria "Cartão") e seus itens em uma única operação.
 * Usa transação via Supabase RPC ou inserts sequenciais com rollback manual.
 */
export async function createInvoice(
  userId: string,
  data: {
    descricao: string
    dataVencimento: string
    quinzena: string | null
    items: Array<{
      data_compra: string
      descricao: string
      categoria_c6: string
      parcela: string
      valor: number
    }>
  }
): Promise<Expense>

/**
 * Lista os itens de fatura vinculados a uma despesa.
 */
export async function listInvoiceItems(expenseId: string): Promise<InvoiceItem[]>

/**
 * Atualiza o valor de um item de fatura e recalcula o total da despesa.
 */
export async function updateInvoiceItem(
  itemId: string,
  expenseId: string,
  newValor: number
): Promise<{ item: InvoiceItem; newTotal: number }>

/**
 * Verifica se uma despesa possui itens de fatura vinculados.
 */
export async function hasInvoiceItems(expenseId: string): Promise<boolean>
```

**Decisões de design:**
- `createInvoice` insere a expense primeiro, depois os items em batch. Se o batch falhar, deleta a expense (rollback manual). Supabase JS client não suporta transações nativas, então usamos essa abordagem.
- `updateInvoiceItem` atualiza o item e depois faz um `SELECT SUM(valor)` para recalcular o total, atualizando a expense em seguida.
- `hasInvoiceItems` é usado pela TransactionsPage para decidir qual modal abrir ao clicar numa despesa "Cartão".

### 4. Componentes UI

#### InvoiceImportModal (`src/pages/transactions/InvoiceImportModal.tsx`)

Props:
```typescript
interface InvoiceImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void  // callback para refresh da lista
  profileId: string
  cicloTipo: string
}
```

Estados internos:
- `file: File | null` — arquivo selecionado
- `parseResult: C6ParseResult | null` — resultado do parsing
- `parseError: string | null` — erro de parsing
- `dataVencimento: string` — data de vencimento informada
- `quinzena: string` — quinzena selecionada
- `submitting: boolean` — estado de loading

Fluxo:
1. Usuário seleciona arquivo (.csv ou .zip)
2. Se .zip → `extractCsvFromZip()` → texto CSV
3. Texto CSV → `parseC6Csv()` → resultado
4. Exibe resumo: banco, qtd itens, total
5. Usuário preenche data de vencimento (e quinzena se aplicável)
6. Clica "Importar" → `createInvoice()` → toast sucesso → `onSuccess()`

#### InvoiceDetailModal (`src/pages/transactions/InvoiceDetailModal.tsx`)

Props:
```typescript
interface InvoiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  expense: Expense
  onExpenseUpdated: (updated: Expense) => void
}
```

Estados internos:
- `items: InvoiceItem[]` — lista de itens
- `loading: boolean`
- `editingItemId: string | null` — item sendo editado
- `editValor: string` — valor em edição

Fluxo:
1. Ao abrir, faz `listInvoiceItems(expense.id)`
2. Exibe lista com data, descrição, categoria, parcela, valor
3. Ao clicar num item, permite editar o valor inline
4. Ao confirmar edição → `updateInvoiceItem()` → atualiza lista e total

### 5. Integração com TransactionsPage

A `TransactionsPage` precisa de ajustes mínimos:

1. Adicionar botão "Cadastrar Fatura" abaixo do botão "Adicionar"
2. Ao clicar numa despesa "Cartão", verificar se tem `invoice_items`:
   - Se sim → abrir `InvoiceDetailModal`
   - Se não → abrir modal de edição padrão (comportamento atual)
3. Importar e renderizar os novos modais

**Decisão:** Usamos `hasInvoiceItems()` com cache local (um `Set<string>` de expense IDs que têm itens) para evitar chamadas extras ao banco a cada clique. O cache é populado no `fetchExpenses`.

## Modelos de Dados

### Tabela `invoice_items`

```sql
CREATE TABLE invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id    UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  data_compra   DATE NOT NULL,
  descricao     VARCHAR(255) NOT NULL,
  categoria_c6  VARCHAR(100) NOT NULL DEFAULT '',
  parcela       VARCHAR(50) NOT NULL DEFAULT 'Única',
  valor         NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_expense_id ON invoice_items(expense_id);
```

### RLS Policies

```sql
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Acesso via join com expenses → user_profiles
CREATE POLICY "Users can view own invoice items"
  ON invoice_items FOR SELECT
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own invoice items"
  ON invoice_items FOR INSERT
  WITH CHECK (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update own invoice items"
  ON invoice_items FOR UPDATE
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ))
  WITH CHECK (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own invoice items"
  ON invoice_items FOR DELETE
  USING (expense_id IN (
    SELECT e.id FROM expenses e
    JOIN user_profiles up ON up.id = e.user_id
    WHERE up.auth_user_id = auth.uid()
  ));
```

### TypeScript Types (adição em `src/types/index.ts`)

```typescript
export interface InvoiceItem {
  id: string
  expense_id: string
  data_compra: string
  descricao: string
  categoria_c6: string
  parcela: string
  valor: number
  created_at: string
}
```


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Property 1: Round-trip do parser CSV C6

*Para qualquer* lista válida de `C6InvoiceItem`, fazer pretty-print para CSV e depois parsing de volta deve produzir uma lista equivalente de objetos. Ou seja: `parse(prettyPrint(items))` deve ser equivalente a `items` para todos os campos (dataCompra, descricao, categoriaC6, parcela, valorBrl).

**Validates: Requirements 3.2, 3.3, 3.4, 3.7, 3.8**

### Property 2: Valores negativos são excluídos pelo parser

*Para qualquer* conteúdo CSV C6 válido contendo uma mistura de linhas com valores positivos e negativos, o resultado do parsing deve conter apenas itens com `valorBrl > 0`. Nenhum item com valor negativo ou zero deve aparecer no resultado.

**Validates: Requirements 3.5**

### Property 3: Invariante do total da fatura

*Para qualquer* lista de itens de fatura com valores positivos, o valor total da fatura (expense.valor) deve ser exatamente igual à soma de todos os `valor` dos itens vinculados. Esta propriedade deve ser mantida tanto na criação inicial quanto após qualquer edição de valor de um item individual.

**Validates: Requirements 4.1, 6.3**

### Property 4: Preservação da contagem de itens

*Para qualquer* resultado de parsing com N itens válidos, a operação de criação da fatura deve produzir exatamente N registros na tabela `invoice_items`, cada um correspondendo a um item do parsing.

**Validates: Requirements 4.3**

### Property 5: Ordenação dos itens por data

*Para qualquer* lista de itens de fatura, ao exibir no Detalhe_Fatura, os itens devem estar ordenados por `data_compra` em ordem crescente. Para quaisquer dois itens adjacentes na lista exibida, a data do primeiro deve ser menor ou igual à data do segundo.

**Validates: Requirements 5.4**

### Property 6: Rejeição de valores não-positivos na edição

*Para qualquer* número que seja zero ou negativo, a tentativa de atualizar o valor de um Item_Fatura com esse número deve ser rejeitada. O valor original do item deve permanecer inalterado.

**Validates: Requirements 6.5**

### Property 7: Resiliência do parser a linhas inválidas

*Para qualquer* conteúdo CSV que contenha uma mistura de linhas válidas no formato C6 e linhas com formato inválido (campos faltando, tipos errados, etc.), o parser deve retornar apenas os itens das linhas válidas, ignorando as inválidas. O número de itens retornados deve ser igual ao número de linhas válidas no input.

**Validates: Requirements 9.1**

## Tratamento de Erros

| Cenário | Origem | Ação |
|---------|--------|------|
| Arquivo não é .csv nem .zip | UI (InvoiceImportModal) | Toast de erro: "Apenas arquivos CSV e ZIP são aceitos" |
| Arquivo CSV vazio | Parser | Retorna `{ success: false, error: "Arquivo vazio" }` |
| CSV sem linhas válidas | Parser | Retorna `{ success: false, error: "Nenhuma compra encontrada no arquivo" }` |
| Formato CSV não corresponde ao C6 | Parser | Retorna `{ success: false, error: "Formato de arquivo inválido..." }` |
| ZIP sem arquivo .csv dentro | extractCsvFromZip | Throw error: "Nenhum arquivo CSV encontrado no ZIP" |
| ZIP corrompido ou inválido | JSZip | Throw error capturado no modal, toast de erro |
| Falha ao criar expense no Supabase | Service | Throw error, modal exibe toast de erro |
| Falha ao criar items após expense | Service | Deleta expense criada (rollback), throw error |
| Falha ao atualizar item | Service | Throw error, toast de erro, estado anterior mantido |
| Data de vencimento não preenchida | UI (validação Zod) | Botão "Importar" desabilitado, mensagem de validação |
| Valor editado ≤ 0 | UI + Schema | Validação Zod rejeita, mensagem de erro inline |

**Estratégia de rollback:** Como o Supabase JS client não suporta transações nativas, o `createInvoice` usa uma abordagem de rollback manual:
1. Insere a expense
2. Tenta inserir os items em batch
3. Se o batch falhar, deleta a expense criada
4. Propaga o erro para o caller

## Estratégia de Testes

### Testes Unitários (Vitest)

| Módulo | Arquivo de Teste | O que testa |
|--------|-----------------|-------------|
| Parser CSV | `src/lib/invoice-csv-parser.test.ts` | Parsing de CSV válido, campos extraídos corretamente, tratamento de encoding, linhas inválidas ignoradas, arquivo vazio, sem linhas válidas |
| Schema | `src/schemas/invoice.schema.test.ts` | Validação de itens válidos/inválidos, validação do formulário de importação |
| Format helpers | Existentes em `src/lib/format.test.ts` | Já cobertos |

### Testes Property-Based (fast-check)

A biblioteca `fast-check` já está instalada no projeto (`devDependencies`).

| Property | Arquivo | Configuração |
|----------|---------|-------------|
| Property 1: Round-trip parser | `src/lib/invoice-csv-parser.test.ts` | 100+ iterações, gera listas aleatórias de C6InvoiceItem |
| Property 2: Valores negativos filtrados | `src/lib/invoice-csv-parser.test.ts` | 100+ iterações, gera CSV com mix de valores positivos/negativos |
| Property 3: Invariante do total | `src/lib/invoice-csv-parser.test.ts` | 100+ iterações, gera listas de valores e verifica soma |
| Property 5: Ordenação por data | `src/lib/invoice-csv-parser.test.ts` | 100+ iterações, gera listas de itens com datas aleatórias |
| Property 7: Resiliência a linhas inválidas | `src/lib/invoice-csv-parser.test.ts` | 100+ iterações, gera CSV com mix de linhas válidas/inválidas |

**Nota:** Properties 4 e 6 são melhor testadas como testes de integração (envolvem Supabase) e testes unitários com exemplos específicos, respectivamente.

Cada teste property-based deve incluir um comentário referenciando a propriedade do design:
```typescript
// Feature: credit-card-invoice, Property 1: Round-trip do parser CSV C6
```

### Testes de Integração

| Cenário | O que testa |
|---------|-------------|
| Criar fatura completa | Service cria expense + items, verifica contagem e total |
| Atualizar item e recalcular | Service atualiza item, verifica novo total na expense |
| Rollback em falha | Service falha nos items, verifica que expense foi deletada |
| RLS policies | Usuário A não acessa items do usuário B |

### Dependência Externa

- **JSZip**: Biblioteca para extração de arquivos ZIP no browser. Já amplamente utilizada, sem riscos de segurança conhecidos. Será adicionada como dependência de produção (`dependencies`).
