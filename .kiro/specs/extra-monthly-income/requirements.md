# Documento de Requisitos: Ganhos Extras Mensais

## Introdução

Esta feature permite ao usuário adicionar um ou mais ganhos extras no mês (ex.: 13° salário, férias, bonificações, PLR, hora extra, etc.), onde o valor é somado apenas ao saldo do mês atual. Diferente do salário fixo configurado no onboarding, os ganhos extras são entradas pontuais vinculadas a um mês/ano específico, permitindo ao usuário ter uma visão precisa do saldo real disponível naquele período.

## Glossário

- **Sistema**: A aplicação Plan. Financeiro como um todo
- **Dashboard**: Página principal que exibe saldo, receitas e despesas do mês selecionado
- **Ganho_Extra**: Uma entrada de rendimento extra pontual, com descrição, valor e data, vinculada a um mês específico (tabela `extra_incomes` no Supabase)
- **Saldo_Real**: Valor calculado como: salário líquido + soma dos ganhos extras do mês - despesas pessoais do mês
- **Formulário_Ganho_Extra**: Modal ou formulário para criação e edição de um ganho extra
- **Lista_Ganhos_Extras**: Componente que exibe todos os ganhos extras do mês selecionado
- **Serviço_Ganho_Extra**: Camada de serviço responsável pelas operações CRUD na tabela `extra_incomes` via Supabase
- **Store_Ganho_Extra**: Store Zustand que gerencia o estado local dos ganhos extras
- **Mês_Selecionado**: O mês e ano atualmente selecionado pelo usuário no seletor de mês/ano do dashboard

## Requisitos

### Requisito 1: Listar ganhos extras do mês

**User Story:** Como usuário, eu quero visualizar todos os meus ganhos extras do mês selecionado, para que eu saiba quais rendimentos adicionais tenho naquele período.

#### Critérios de Aceitação

1. WHEN o usuário navega para o Dashboard, THE Serviço_Ganho_Extra SHALL buscar todos os registros de Ganho_Extra cujo campo `data` pertence ao Mês_Selecionado
2. WHEN o Serviço_Ganho_Extra retorna os registros, THE Lista_Ganhos_Extras SHALL exibir cada Ganho_Extra com sua descrição e valor formatado em reais (R$)
3. WHEN não existem ganhos extras para o Mês_Selecionado, THE Lista_Ganhos_Extras SHALL exibir uma mensagem indicando que não há ganhos extras cadastrados
4. WHEN o usuário altera o Mês_Selecionado, THE Serviço_Ganho_Extra SHALL buscar os ganhos extras correspondentes ao novo mês e ano selecionados

### Requisito 2: Adicionar ganho extra

**User Story:** Como usuário, eu quero adicionar um ganho extra ao mês, para que o valor seja considerado no meu saldo disponível.

#### Critérios de Aceitação

1. WHEN o usuário aciona o botão de adicionar ganho extra, THE Sistema SHALL exibir o Formulário_Ganho_Extra com campos para descrição e valor
2. WHEN o usuário preenche o Formulário_Ganho_Extra com dados válidos e confirma, THE Serviço_Ganho_Extra SHALL criar um novo registro de Ganho_Extra com a data correspondente ao Mês_Selecionado
3. WHEN o Serviço_Ganho_Extra cria o registro com sucesso, THE Store_Ganho_Extra SHALL adicionar o novo Ganho_Extra à lista local e THE Sistema SHALL exibir uma mensagem de sucesso
4. THE Formulário_Ganho_Extra SHALL validar que a descrição possui entre 1 e 255 caracteres
5. THE Formulário_Ganho_Extra SHALL validar que o valor é um número positivo maior que zero
6. IF o usuário submete o Formulário_Ganho_Extra com dados inválidos, THEN THE Formulário_Ganho_Extra SHALL exibir mensagens de erro nos campos correspondentes

### Requisito 3: Editar ganho extra

**User Story:** Como usuário, eu quero editar um ganho extra existente, para que eu possa corrigir a descrição ou o valor caso tenha cometido um erro.

#### Critérios de Aceitação

1. WHEN o usuário aciona a edição de um Ganho_Extra existente, THE Sistema SHALL exibir o Formulário_Ganho_Extra preenchido com os dados atuais do registro
2. WHEN o usuário altera os dados e confirma, THE Serviço_Ganho_Extra SHALL atualizar o registro de Ganho_Extra no banco de dados
3. WHEN o Serviço_Ganho_Extra atualiza o registro com sucesso, THE Store_Ganho_Extra SHALL atualizar o Ganho_Extra na lista local e THE Sistema SHALL exibir uma mensagem de sucesso

### Requisito 4: Excluir ganho extra

**User Story:** Como usuário, eu quero excluir um ganho extra, para que valores incorretos ou que não se aplicam mais sejam removidos do meu saldo.

#### Critérios de Aceitação

1. WHEN o usuário aciona a exclusão de um Ganho_Extra, THE Sistema SHALL solicitar confirmação antes de prosseguir
2. WHEN o usuário confirma a exclusão, THE Serviço_Ganho_Extra SHALL remover o registro de Ganho_Extra do banco de dados
3. WHEN o Serviço_Ganho_Extra remove o registro com sucesso, THE Store_Ganho_Extra SHALL remover o Ganho_Extra da lista local e THE Sistema SHALL exibir uma mensagem de sucesso
4. WHEN o usuário cancela a exclusão, THE Sistema SHALL manter o Ganho_Extra inalterado

### Requisito 5: Cálculo do saldo com ganhos extras

**User Story:** Como usuário, eu quero que meus ganhos extras sejam somados ao meu saldo do mês, para que eu tenha uma visão precisa do dinheiro disponível.

#### Critérios de Aceitação

1. THE Dashboard SHALL calcular o Saldo_Real como: salário líquido + soma de todos os Ganho_Extra do Mês_Selecionado - soma de todas as despesas pessoais do Mês_Selecionado
2. WHEN um Ganho_Extra é adicionado, editado ou excluído, THE Dashboard SHALL recalcular o Saldo_Real imediatamente
3. THE Dashboard SHALL exibir o total de ganhos extras do mês como um item separado no card de saldo, permitindo ao usuário distinguir entre salário fixo e rendimentos extras
4. WHEN o Mês_Selecionado é alterado, THE Dashboard SHALL recalcular o Saldo_Real utilizando os ganhos extras do novo mês

### Requisito 6: Tratamento de erros

**User Story:** Como usuário, eu quero ser informado quando ocorrer um erro nas operações com ganhos extras, para que eu saiba que a ação não foi concluída.

#### Critérios de Aceitação

1. IF o Serviço_Ganho_Extra falha ao criar um Ganho_Extra, THEN THE Sistema SHALL exibir uma mensagem de erro via toast e THE Store_Ganho_Extra SHALL manter o estado anterior inalterado
2. IF o Serviço_Ganho_Extra falha ao atualizar um Ganho_Extra, THEN THE Sistema SHALL exibir uma mensagem de erro via toast e THE Store_Ganho_Extra SHALL reverter o Ganho_Extra ao estado anterior
3. IF o Serviço_Ganho_Extra falha ao excluir um Ganho_Extra, THEN THE Sistema SHALL exibir uma mensagem de erro via toast e THE Store_Ganho_Extra SHALL restaurar o Ganho_Extra na lista local
4. IF o Serviço_Ganho_Extra falha ao buscar os ganhos extras, THEN THE Sistema SHALL exibir uma mensagem de erro via toast e THE Lista_Ganhos_Extras SHALL exibir o estado anterior ou uma mensagem de erro

### Requisito 7: Segurança e isolamento de dados

**User Story:** Como usuário, eu quero que apenas eu tenha acesso aos meus ganhos extras, para que meus dados financeiros estejam protegidos.

#### Critérios de Aceitação

1. THE Serviço_Ganho_Extra SHALL enviar o `user_id` do perfil autenticado em todas as operações de criação de Ganho_Extra
2. THE Sistema SHALL utilizar as políticas RLS (Row Level Security) existentes na tabela `extra_incomes` para garantir que cada usuário acesse apenas seus próprios registros
