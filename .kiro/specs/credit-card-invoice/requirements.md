# Documento de Requisitos: Importação de Fatura de Cartão de Crédito

## Introdução

Esta feature permite ao usuário importar faturas de cartão de crédito a partir de arquivos CSV do banco C6. O sistema faz o parsing do CSV (separador ponto-e-vírgula), extrai o nome do banco, data de vencimento e lista de compras, e cria uma única despesa na categoria "Cartão" com o valor total da fatura. Dentro dessa despesa, os itens individuais da fatura ficam armazenados como sub-itens em uma tabela dedicada. O usuário pode visualizar os itens ao clicar na despesa, editar valores individuais, e o total da despesa é recalculado automaticamente. Esta é a Fase 1 — fases futuras adicionarão suporte a PDF (Bradesco e C6) com senhas.

## Glossário

- **Sistema**: A aplicação Plan. Financeiro como um todo
- **Parser_CSV**: Módulo responsável por ler e interpretar o conteúdo de um arquivo CSV no formato C6 (separador ponto-e-vírgula)
- **Fatura**: Uma despesa do tipo "Cartão" que representa o total de uma fatura de cartão de crédito importada
- **Item_Fatura**: Um registro individual de compra extraído do CSV, armazenado como sub-item de uma Fatura na tabela `invoice_items`
- **Formulário_Fatura**: Modal para upload do arquivo CSV e confirmação da importação
- **Detalhe_Fatura**: Tela/modal que exibe a lista de itens individuais de uma Fatura
- **Serviço_Fatura**: Camada de serviço responsável pelas operações de criação da Fatura e seus itens via Supabase
- **Store_Despesas**: Store Zustand existente (`expenses.store`) que gerencia o estado local das despesas
- **CSV_C6**: Formato de arquivo CSV exportado pelo banco C6, com separador ponto-e-vírgula e colunas: Data de Compra, Nome no Cartão, Final do Cartão, Categoria, Descrição, Parcela, Valor (em US$), Cotação (em R$), Valor (em R$)
- **Valor_BRL**: Coluna "Valor (em R$)" do CSV_C6, última coluna de cada linha

## Requisitos

### Requisito 1: Botão de cadastro de fatura

**User Story:** Como usuário, eu quero ter um botão "Cadastrar Fatura" na tela de despesas, para que eu possa iniciar o processo de importação de uma fatura de cartão.

#### Critérios de Aceitação

1. THE Sistema SHALL exibir um botão "Cadastrar Fatura" na tela de despesas, visualmente distinto do botão "Adicionar" existente
2. WHEN o usuário aciona o botão "Cadastrar Fatura", THE Sistema SHALL exibir o Formulário_Fatura em um modal

### Requisito 2: Upload e leitura do arquivo CSV

**User Story:** Como usuário, eu quero fazer upload de um arquivo CSV da fatura do C6, para que o sistema extraia automaticamente os dados das minhas compras.

#### Critérios de Aceitação

1. THE Formulário_Fatura SHALL exibir um campo de upload que aceita arquivos com extensão `.csv`
2. WHEN o usuário seleciona um arquivo CSV válido, THE Parser_CSV SHALL ler o conteúdo do arquivo utilizando a codificação correta (UTF-8 ou Latin-1)
3. WHEN o Parser_CSV lê o arquivo com sucesso, THE Formulário_Fatura SHALL exibir um resumo com: nome do banco (C6), quantidade de itens encontrados e valor total da fatura
4. IF o arquivo selecionado não possui extensão `.csv`, THEN THE Sistema SHALL exibir uma mensagem de erro informando que apenas arquivos CSV são aceitos
5. IF o conteúdo do arquivo não corresponde ao formato CSV_C6 esperado, THEN THE Parser_CSV SHALL retornar um erro descritivo indicando que o formato é inválido

### Requisito 3: Parsing do CSV no formato C6

**User Story:** Como usuário, eu quero que o sistema interprete corretamente o CSV do C6, para que todas as minhas compras sejam extraídas com os dados corretos.

#### Critérios de Aceitação

1. THE Parser_CSV SHALL utilizar ponto-e-vírgula (`;`) como separador de colunas
2. THE Parser_CSV SHALL extrair de cada linha: data de compra (coluna "Data de Compra"), descrição (coluna "Descrição"), categoria C6 (coluna "Categoria"), parcela (coluna "Parcela") e valor em reais (coluna "Valor (em R$)")
3. THE Parser_CSV SHALL interpretar datas no formato DD/MM/YYYY e converter para o formato ISO (YYYY-MM-DD)
4. THE Parser_CSV SHALL interpretar valores numéricos que utilizam vírgula como separador decimal
5. WHEN o Valor_BRL de uma linha é negativo, THE Parser_CSV SHALL excluir essa linha do resultado, pois representa um pagamento ou crédito
6. THE Parser_CSV SHALL ignorar a primeira linha do arquivo (cabeçalho)
7. THE Pretty_Printer SHALL formatar objetos de Item_Fatura de volta para linhas CSV válidas no formato C6
8. FOR ALL listas válidas de Item_Fatura, parsing seguido de pretty-printing seguido de parsing SHALL produzir uma lista equivalente de objetos (propriedade round-trip)

### Requisito 4: Criação da despesa de fatura

**User Story:** Como usuário, eu quero que o sistema crie uma despesa na categoria "Cartão" com o total da fatura, para que ela apareça na minha lista de despesas do mês.

#### Critérios de Aceitação

1. WHEN o usuário confirma a importação no Formulário_Fatura, THE Serviço_Fatura SHALL criar uma nova despesa na tabela `expenses` com categoria "Cartão", descrição contendo o nome do banco e referência da fatura, e valor igual à soma dos Valor_BRL positivos
2. THE Serviço_Fatura SHALL definir a `data_vencimento` da Fatura com base na data de vencimento informada pelo usuário no Formulário_Fatura
3. WHEN a despesa é criada com sucesso, THE Serviço_Fatura SHALL criar um registro de Item_Fatura na tabela `invoice_items` para cada compra extraída do CSV, vinculado ao `expense_id` da Fatura criada
4. WHEN todos os registros são criados com sucesso, THE Store_Despesas SHALL adicionar a nova Fatura à lista local e THE Sistema SHALL exibir uma mensagem de sucesso
5. THE Serviço_Fatura SHALL executar a criação da despesa e dos itens em uma única operação, garantindo que ambos sejam criados ou nenhum seja persistido

### Requisito 5: Visualização dos itens da fatura

**User Story:** Como usuário, eu quero ver os itens individuais de uma fatura de cartão ao clicar nela, para que eu saiba exatamente o que compõe o valor total.

#### Critérios de Aceitação

1. WHEN o usuário clica em uma despesa da categoria "Cartão" que possui itens de fatura vinculados, THE Sistema SHALL exibir o Detalhe_Fatura em vez do modal de edição padrão
2. THE Detalhe_Fatura SHALL exibir a lista de todos os Item_Fatura vinculados à Fatura, mostrando para cada item: data de compra, descrição, categoria C6, parcela e valor em reais
3. THE Detalhe_Fatura SHALL exibir o valor total da Fatura no topo ou rodapé da lista
4. THE Detalhe_Fatura SHALL ordenar os itens por data de compra em ordem crescente

### Requisito 6: Edição de valores individuais dos itens

**User Story:** Como usuário, eu quero poder editar o valor de um item individual da fatura, para que eu possa corrigir valores ou ajustar divisões de compras compartilhadas.

#### Critérios de Aceitação

1. WHEN o usuário aciona a edição de um Item_Fatura no Detalhe_Fatura, THE Sistema SHALL permitir a alteração do campo valor do item
2. WHEN o usuário confirma a edição de um Item_Fatura, THE Serviço_Fatura SHALL atualizar o registro do Item_Fatura na tabela `invoice_items`
3. WHEN um Item_Fatura é atualizado com sucesso, THE Sistema SHALL recalcular o valor total da Fatura como a soma de todos os Valor_BRL dos itens vinculados
4. WHEN o valor total da Fatura é recalculado, THE Serviço_Fatura SHALL atualizar o campo `valor` da despesa correspondente na tabela `expenses`
5. THE Sistema SHALL validar que o valor editado de um Item_Fatura é um número positivo maior que zero

### Requisito 7: Estrutura de dados dos itens de fatura

**User Story:** Como desenvolvedor, eu quero uma tabela dedicada para armazenar os itens individuais de cada fatura, para que os dados fiquem organizados e consultáveis.

#### Critérios de Aceitação

1. THE Sistema SHALL utilizar uma tabela `invoice_items` com os campos: id (UUID), expense_id (FK para expenses), data_compra (DATE), descricao (VARCHAR 255), categoria_c6 (VARCHAR 100), parcela (VARCHAR 50), valor (NUMERIC 12,2), created_at (TIMESTAMPTZ)
2. THE tabela `invoice_items` SHALL ter uma foreign key para a tabela `expenses` com ON DELETE CASCADE, garantindo que a exclusão de uma Fatura remova todos os seus itens
3. THE tabela `invoice_items` SHALL ter RLS habilitado, com políticas que permitam acesso apenas ao usuário dono da despesa vinculada
4. THE tabela `invoice_items` SHALL ter um índice no campo `expense_id` para otimizar consultas de itens por fatura

### Requisito 8: Formulário de importação com data de vencimento

**User Story:** Como usuário, eu quero informar a data de vencimento da fatura durante a importação, para que a despesa seja registrada no mês correto.

#### Critérios de Aceitação

1. THE Formulário_Fatura SHALL exibir um campo de data de vencimento que o usuário deve preencher
2. THE Formulário_Fatura SHALL exibir um campo de quinzena (para usuários quinzenais) ou omitir o campo (para usuários mensais), seguindo o padrão existente do formulário de despesas
3. THE Formulário_Fatura SHALL validar que a data de vencimento está preenchida antes de permitir a confirmação
4. WHEN o usuário confirma a importação, THE Serviço_Fatura SHALL utilizar a data de vencimento informada como `data_vencimento` da Fatura criada

### Requisito 9: Tratamento de erros na importação

**User Story:** Como usuário, eu quero ser informado quando ocorrer um erro durante a importação da fatura, para que eu saiba que a operação não foi concluída.

#### Critérios de Aceitação

1. IF o Parser_CSV encontra linhas com formato inesperado no meio do arquivo, THEN THE Parser_CSV SHALL ignorar essas linhas e continuar o parsing das demais
2. IF o Parser_CSV não encontra nenhuma linha válida de compra no arquivo, THEN THE Sistema SHALL exibir uma mensagem de erro informando que nenhuma compra foi encontrada no arquivo
3. IF o Serviço_Fatura falha ao criar a Fatura ou os itens no banco de dados, THEN THE Sistema SHALL exibir uma mensagem de erro via toast e THE Store_Despesas SHALL manter o estado anterior inalterado
4. IF o arquivo CSV está vazio, THEN THE Sistema SHALL exibir uma mensagem de erro informando que o arquivo está vazio

### Requisito 10: Segurança e isolamento de dados

**User Story:** Como usuário, eu quero que apenas eu tenha acesso às minhas faturas e itens importados, para que meus dados financeiros estejam protegidos.

#### Critérios de Aceitação

1. THE Serviço_Fatura SHALL enviar o `user_id` do perfil autenticado ao criar a Fatura na tabela `expenses`
2. THE Sistema SHALL utilizar as políticas RLS existentes na tabela `expenses` para garantir que cada usuário acesse apenas suas próprias faturas
3. THE tabela `invoice_items` SHALL ter políticas RLS que restrinjam o acesso aos itens cujo `expense_id` pertence a uma despesa do usuário autenticado
