import { useEffect, useState } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useExpensesStore } from '../../stores/expenses.store'
import { useAuthStore } from '../../stores/auth.store'
import { expenseSchema } from '../../schemas/expense.schema'
import { formatCurrency, formatDate } from '../../lib/format'
import { EXPENSE_CATEGORIES } from '../../types'

const categoryEmojis: Record<string, string> = {
  'Alimentação': '🍔',
  'Transporte': '🚗',
  'Educação': '📚',
  'Lazer': '🎮',
  'Saúde': '💊',
  'Moradia': '🏠',
  'Cartão': '💳',
  'Utilidades': '💡',
  'Outros': '📦',
}

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

  const inputWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    padding: '14px 16px',
    background: '#fff',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 15,
    color: '#1e293b',
    background: 'transparent',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#1e293b',
    marginBottom: 8,
  }
  const selectStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
    appearance: 'none' as const,
  }

  return (
    <PageContainer>
      <Header title="Transações" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Add button */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Adicionar
        </button>

        {/* Expense list */}
        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
            Carregando...
          </p>
        ) : expenses.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
            Nenhuma transação encontrada
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                  {/* Category emoji */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {categoryEmojis[expense.categoria] || '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', margin: 0 }}>
                      {expense.descricao}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {formatDate(expense.data_vencimento)}
                      </span>
                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>•</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {expense.categoria}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    {formatCurrency(expense.valor)}
                  </p>
                  <button
                    onClick={() => handleToggle(expense.id)}
                    style={{
                      marginTop: 6,
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: expense.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'rgba(234,88,12,0.1)',
                      color: expense.status === 'paid' ? '#16a34a' : '#ea580c',
                    }}
                  >
                    {expense.status === 'paid' ? 'Desfazer' : 'Pagar'}
                  </button>
                </div>
              </div>
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Descrição</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <input
                type="text"
                placeholder="Ex: Aluguel"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Valor</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input
                type="number"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={selectStyle}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Quinzena</label>
            <select
              value={quinzena}
              onChange={(e) => setQuinzena(e.target.value)}
              style={selectStyle}
            >
              {quinzenaOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Data de vencimento</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#2563eb' }}
            />
            Despesa fixa (recorrente)
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </Modal>
    </PageContainer>
  )
}
