import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useThirdPartyStore } from '../../stores/third-party.store'
import { useAuthStore } from '../../stores/auth.store'
import { thirdPartyExpenseSchema } from '../../schemas/third-party.schema'
import { formatCurrency, formatDate } from '../../lib/format'
import type { ThirdPartyExpense } from '../../types'

export function ThirdPartyPage() {
  const user = useAuthStore((s) => s.user)
  const { expenses, loading, fetchExpenses, addExpense, toggleStatus } =
    useThirdPartyStore()
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [pessoa, setPessoa] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dataVencimento, setDataVencimento] = useState(
    new Date().toISOString().split('T')[0],
  )

  useEffect(() => {
    if (user) {
      fetchExpenses(user.id)
    }
  }, [user, fetchExpenses])

  // Group by person
  const groupedByPerson = useMemo(() => {
    const groups = new Map<string, ThirdPartyExpense[]>()
    for (const expense of expenses) {
      const list = groups.get(expense.pessoa) || []
      list.push(expense)
      groups.set(expense.pessoa, list)
    }
    return groups
  }, [expenses])

  const grandTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + e.valor, 0),
    [expenses],
  )

  const resetForm = () => {
    setPessoa('')
    setDescricao('')
    setValor('')
    setDataVencimento(new Date().toISOString().split('T')[0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const parsed = thirdPartyExpenseSchema.safeParse({
      pessoa,
      descricao,
      valor: parseFloat(valor) || 0,
      data_vencimento: dataVencimento,
      status: 'pending' as const,
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
      await toggleStatus(id)
    } catch {
      showToast('Erro ao atualizar status', 'error')
    }
  }

  return (
    <PageContainer>
      <Header title="Terceiros" />

      <div className="flex flex-col gap-4 p-4">
        {/* Add button */}
        <Button onClick={() => setShowModal(true)}>Adicionar</Button>

        {/* Grand total */}
        {grandTotal > 0 && (
          <Card className="p-4">
            <p className="text-xs text-text2">Total com Terceiros</p>
            <p className="mt-1 text-lg font-semibold text-orange">
              {formatCurrency(grandTotal)}
            </p>
          </Card>
        )}

        {/* Grouped list */}
        {loading ? (
          <p className="py-8 text-center text-sm text-text2">Carregando...</p>
        ) : groupedByPerson.size === 0 ? (
          <p className="py-8 text-center text-sm text-text2">
            Nenhuma despesa com terceiros
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from(groupedByPerson.entries()).map(([personName, items]) => {
              const personTotal = items.reduce((sum, e) => sum + e.valor, 0)

              return (
                <Card key={personName} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border p-4">
                    <p className="text-sm font-semibold text-text">{personName}</p>
                    <span className="text-sm font-semibold text-text">
                      {formatCurrency(personTotal)}
                    </span>
                  </div>
                  {items.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between border-b border-border/50 px-4 py-3 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm text-text">{expense.descricao}</p>
                        <p className="text-xs text-text2">
                          {formatDate(expense.data_vencimento)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">
                          {formatCurrency(expense.valor)}
                        </span>
                        <button
                          onClick={() => handleToggle(expense.id)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            expense.status === 'paid'
                              ? 'bg-green/10 text-green'
                              : 'bg-orange/10 text-orange'
                          }`}
                        >
                          {expense.status === 'paid' ? 'Desfazer' : 'Pagar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Third Party Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nova Despesa com Terceiro"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nome da pessoa"
            placeholder="Ex: João"
            value={pessoa}
            onChange={setPessoa}
          />
          <Input
            label="Descrição"
            placeholder="Ex: Almoço"
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
          <Input
            label="Data de vencimento"
            type="date"
            value={dataVencimento}
            onChange={setDataVencimento}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </Modal>
    </PageContainer>
  )
}
