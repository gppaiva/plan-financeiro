import { useEffect, useState } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useExpensesStore } from '../../stores/expenses.store'
import { useAuthStore } from '../../stores/auth.store'
import { expenseSchema } from '../../schemas/expense.schema'
import { formatCurrency, formatDate } from '../../lib/format'
import { EXPENSE_CATEGORIES } from '../../types'

const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))
const quinzenaOptions = [
  { value: '1', label: 'Dia 15' },
  { value: '2', label: 'Último dia útil' },
]

export function TransactionsPage() {
  const user = useAuthStore((s) => s.user)
  const { expenses, loading, fetchExpenses, addExpense, toggleExpenseStatus } =
    useExpensesStore()
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState<string>(EXPENSE_CATEGORIES[0])
  const [quinzena, setQuinzena] = useState('1')
  const [dataVencimento, setDataVencimento] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [recorrente, setRecorrente] = useState(false)

  useEffect(() => {
    if (user) {
      const now = new Date()
      fetchExpenses(user.id, { month: now.getMonth() + 1, year: now.getFullYear() })
    }
  }, [user, fetchExpenses])

  const resetForm = () => {
    setDescricao('')
    setValor('')
    setCategoria(EXPENSE_CATEGORIES[0])
    setQuinzena('1')
    setDataVencimento(new Date().toISOString().split('T')[0])
    setRecorrente(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const parsed = expenseSchema.safeParse({
      descricao,
      valor: parseFloat(valor) || 0,
      categoria,
      quinzena,
      data_vencimento: dataVencimento,
      status: 'pending' as const,
      recorrente,
    })

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      showToast(firstError.message, 'error')
      return
    }

    setSubmitting(true)
    try {
      await addExpense(user.id, parsed.data)
      showToast('Despesa adicionada!', 'success')
      setShowModal(false)
      resetForm()
    } catch {
      showToast('Erro ao adicionar despesa', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleExpenseStatus(id)
    } catch {
      showToast('Erro ao atualizar status', 'error')
    }
  }

  return (
    <PageContainer>
      <Header title="Transações" />

      <div className="flex flex-col gap-4 p-4">
        {/* Add button */}
        <Button onClick={() => setShowModal(true)}>Adicionar</Button>

        {/* Expense list */}
        {loading ? (
          <p className="py-8 text-center text-sm text-text2">Carregando...</p>
        ) : expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-text2">
            Nenhuma transação encontrada
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((expense) => (
              <Card key={expense.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">
                      {expense.descricao}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-text2">
                        {formatDate(expense.data_vencimento)}
                      </span>
                      <span className="text-xs text-text2">•</span>
                      <span className="text-xs text-text2">
                        {expense.categoria}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-text">
                      {formatCurrency(expense.valor)}
                    </p>
                    <button
                      onClick={() => handleToggle(expense.id)}
                      className={`mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        expense.status === 'paid'
                          ? 'bg-green/10 text-green'
                          : 'bg-orange/10 text-orange'
                      }`}
                    >
                      {expense.status === 'paid' ? 'Desfazer' : 'Pagar'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nova Despesa"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Descrição"
            placeholder="Ex: Aluguel"
            value={descricao}
            onChange={setDescricao}
          />
          <Input
            label="Valor"
            type="number"
            placeholder="0,00"
            value={valor}
            onChange={setValor}
          />
          <Select
            label="Categoria"
            options={categoryOptions}
            value={categoria}
            onChange={setCategoria}
          />
          <Select
            label="Quinzena"
            options={quinzenaOptions}
            value={quinzena}
            onChange={setQuinzena}
          />
          <Input
            label="Data de vencimento"
            type="date"
            value={dataVencimento}
            onChange={setDataVencimento}
          />
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Despesa fixa (recorrente)
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </Modal>
    </PageContainer>
  )
}
