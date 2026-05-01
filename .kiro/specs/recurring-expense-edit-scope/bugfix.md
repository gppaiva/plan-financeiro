# Documento de Requisitos do Bugfix

## Introdução

Ao editar o valor (ou outros campos) de uma despesa fixa (recorrente), o sistema atualmente atualiza o registro único no banco de dados, o que faz com que a alteração se reflita em **todos os meses** — passados e futuros. O comportamento desejado é que o sistema pergunte ao usuário se a alteração deve ser aplicada apenas ao mês atual ou a todos os meses futuros, preservando o histórico de meses anteriores.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o usuário edita o valor de uma despesa recorrente THEN o sistema atualiza diretamente o registro na tabela `expenses`, alterando o valor para todos os meses (passados e futuros) sem perguntar ao usuário sobre o escopo da alteração

1.2 WHEN o usuário edita qualquer campo de uma despesa recorrente THEN o sistema não apresenta nenhuma opção de escopo (apenas mês atual vs. meses futuros), aplicando a mudança globalmente

1.3 WHEN o valor de uma despesa recorrente é alterado THEN o histórico de meses anteriores é perdido, pois o valor antigo é sobrescrito no registro único

### Expected Behavior (Correct)

2.1 WHEN o usuário edita o valor de uma despesa recorrente THEN o sistema SHALL exibir um diálogo perguntando se a alteração deve ser aplicada "apenas este mês" ou "este mês e todos os futuros"

2.2 WHEN o usuário escolhe "apenas este mês" THEN o sistema SHALL salvar o valor alterado apenas para o mês selecionado, sem modificar o registro base da despesa recorrente, preservando o valor original para os demais meses

2.3 WHEN o usuário escolhe "este mês e todos os futuros" THEN o sistema SHALL atualizar o registro base da despesa recorrente com o novo valor, afetando o mês atual e todos os meses futuros, mas preservando valores customizados de meses anteriores

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o usuário edita uma despesa NÃO recorrente THEN o sistema SHALL CONTINUE TO atualizar o registro diretamente sem exibir diálogo de escopo

3.2 WHEN o usuário visualiza despesas recorrentes em um mês sem valor customizado THEN o sistema SHALL CONTINUE TO exibir o valor base do registro da despesa

3.3 WHEN o usuário altera o status (pago/pendente) de uma despesa recorrente THEN o sistema SHALL CONTINUE TO usar a tabela `expense_payments` para controle mensal sem exibir diálogo de escopo

3.4 WHEN o usuário exclui uma despesa recorrente THEN o sistema SHALL CONTINUE TO excluir o registro base e todos os dados associados

3.5 WHEN o usuário cria uma nova despesa recorrente THEN o sistema SHALL CONTINUE TO criar o registro normalmente sem perguntar sobre escopo

---

## Bug Condition (Derivação Formal)

**Bug Condition Function** — Identifica inputs que disparam o bug:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ExpenseEditInput
  OUTPUT: boolean
  
  // O bug ocorre quando se edita uma despesa que é recorrente
  RETURN X.expense.recorrente = true AND X.fieldsChanged contains 'valor'
END FUNCTION
```

**Property Specification** — Define o comportamento correto para inputs com bug:
```pascal
// Property: Fix Checking - Edição de despesa recorrente com escopo
FOR ALL X WHERE isBugCondition(X) DO
  result ← editExpense'(X)
  ASSERT result.promptedUser = true
  ASSERT result.scopeChosen IN {'only_this_month', 'this_and_future'}
  IF result.scopeChosen = 'only_this_month' THEN
    ASSERT baseRecord(X.expense).valor = X.originalValor  // registro base inalterado
    ASSERT monthlyOverride(X.expense, X.month, X.year).valor = X.newValor
  ELSE
    ASSERT baseRecord(X.expense).valor = X.newValor  // registro base atualizado
  END IF
END FOR
```

**Preservation Goal** — Comportamento preservado para inputs sem bug:
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT editExpense(X) = editExpense'(X)
END FOR
```
