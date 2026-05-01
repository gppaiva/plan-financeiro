import { useEffect, useState, useCallback, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { MonthYearSelector } from '../../components/ui/MonthYearSelector'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useExpensesStore } from '../../stores/expenses.store'
import { useProfile } from '../../hooks/useProfile'
import { expenseSchema, createExpenseSchema } from '../../schemas/expense.schema'
import { formatCurrency, formatDate } from '../../lib/format'
import { isMensal } from '../../lib/quinzena'
import { EXPENSE_CATEGORIES } from '../../types'
import type { Expense, EditScope } from '../../types'

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

export function TransactionsPage() {
  const { profile, profileId } = useProfile()
  const mensal = isMensal(profile?.ciclo_tipo)
  const { expenses, loading, fetchExpenses, addExpense, updateExpense, toggleExpenseStatus, removeExpense } =
    useExpensesStore()
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Quinzena filter
  const [quinzenaFilter, setQuinzenaFilter] = useState<'all' | '1' | '2'>('all')

  // Scope modal state for recurring expense edits
  const [showScopeModal, setShowScopeModal] = useState(false)
  const [pendingEditData, setPendingEditData] = useState<{
    id: string
    data: {
      descricao: string
      valor: number
      categoria: Expense['categoria']
      quinzena: Expense['quinzena']
      data_vencimento: string
      recorrente: boolean
      data_final: string | null
    }
  } | null>(null)
  const [scopeLoading, setScopeLoading] = useState(false)

  // Dynamic quinzena options based on user's ciclo_tipo
  const quinzenaOptions = useMemo(() => {
    const ciclo = profile?.ciclo_tipo || '15_ultimo'
    if (ciclo === '5_20') {
      return [
        { value: '1', label: '5º dia útil' },
        { value: '2', label: 'Dia 20' },
      ]
    }
    return [
      { value: '1', label: 'Dia 15' },
      { value: '2', label: 'Último dia útil' },
    ]
  }, [profile])

  // Month/Year selector state
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const handleMonthChange = useCallback((month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }, [])

  // Edit form state
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editCategoria, setEditCategoria] = useState<string>(EXPENSE_CATEGORIES[0])
  const [editQuinzena, setEditQuinzena] = useState('1')
  const [editDataVencimento, setEditDataVencimento] = useState('')
  const [editRecorrente, setEditRecorrente] = useState(false)
  const [editDiaVencimento, setEditDiaVencimento] = useState('10')
  const [editDataFinal, setEditDataFinal] = useState('')

  // Add form state
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState<string>(EXPENSE_CATEGORIES[0])
  const [quinzena, setQuinzena] = useState('1')
  const [dataVencimento, setDataVencimento] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [recorrente, setRecorrente] = useState(false)
  const [diaVencimento, setDiaVencimento] = useState('10')
  const [dataFinal, setDataFinal] = useState('')

  useEffect(() => {
    if (profileId) {
      fetchExpenses(profileId, { month: selectedMonth, year: selectedYear })
    }
  }, [profileId, selectedMonth, selectedYear, fetchExpenses])

  const filteredExpenses = useMemo(() => {
    if (quinzenaFilter === 'all') return expenses
    return expenses.filter((e) => e.quinzena === quinzenaFilter)
  }, [expenses, quinzenaFilter])

  const quinzenaFilters = useMemo(() => {
    const ciclo = profile?.ciclo_tipo || '15_ultimo'
    const q1 = ciclo === '5_20' ? '5º dia útil' : 'Dia 15'
    const q2 = ciclo === '5_20' ? 'Dia 20' : 'Último dia útil'
    return [
      { label: 'Todas', value: 'all' as const },
      { label: q1, value: '1' as const },
      { label: q2, value: '2' as const },
    ]
  }, [profile])

  const openEditModal = useCallback((expense: Expense) => {
    setEditingExpenseId(expense.id)
    setEditDescricao(expense.descricao)
    setEditValor(String(expense.valor))
    setEditCategoria(expense.categoria)
    setEditQuinzena(expense.quinzena ?? '1')
    setEditDataVencimento(expense.data_vencimento)
    setEditRecorrente(expense.recorrente)
    setEditDiaVencimento(expense.data_vencimento ? expense.data_vencimento.split('-')[2]?.replace(/^0/, '') || '10' : '10')
    setEditDataFinal(expense.data_final || '')
    setShowEditModal(true)
  }, [])

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpenseId) return

    // For recurring expenses, build data_vencimento from the day selector
    let finalDataVencimento = editDataVencimento
    if (editRecorrente) {
      const day = String(parseInt(editDiaVencimento) || 10).padStart(2, '0')
      const originalDate = editDataVencimento || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const [origYear, origMonth] = originalDate.split('-')
      finalDataVencimento = `${origYear}-${origMonth}-${day}`
    }

    const editData = {
      descricao: editDescricao,
      valor: parseFloat(editValor) || 0,
      categoria: editCategoria as Expense['categoria'],
      quinzena: mensal ? null : editQuinzena as Expense['quinzena'],
      data_vencimento: finalDataVencimento,
      recorrente: editRecorrente,
      data_final: editRecorrente && editDataFinal ? editDataFinal : null,
    }

    if (editRecorrente) {
      // Recurring expense: save pending data and open scope modal
      setPendingEditData({ id: editingExpenseId, data: editData })
      setShowEditModal(false)
      setShowScopeModal(true)
    } else {
      // Non-recurring expense: save directly via store
      setSubmitting(true)
      try {
        await updateExpense(editingExpenseId, editData)
        showToast('Despesa atualizada!', 'success')
        setShowEditModal(false)
        setEditingExpenseId(null)
      } catch {
        showToast('Erro ao atualizar despesa', 'error')
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleScopeChoice = async (scope: EditScope) => {
    if (!pendingEditData) return

    setScopeLoading(true)
    try {
      await updateExpense(pendingEditData.id, pendingEditData.data, scope, selectedMonth, selectedYear)
      showToast('Despesa atualizada!', 'success')
      setShowScopeModal(false)
      setPendingEditData(null)
      setEditingExpenseId(null)
    } catch {
      showToast('Erro ao atualizar despesa', 'error')
    } finally {
      setScopeLoading(false)
    }
  }

  const handleScopeCancel = () => {
    setShowScopeModal(false)
    setPendingEditData(null)
    // Re-open the edit modal so the user can continue editing
    setShowEditModal(true)
  }

  const handleDeleteFromEdit = async () => {
    if (!editingExpenseId) return
    const confirmed = window.confirm('Tem certeza que deseja excluir esta despesa?')
    if (!confirmed) return

    try {
      await removeExpense(editingExpenseId)
      showToast('Despesa excluída', 'success')
      setShowEditModal(false)
      setEditingExpenseId(null)
    } catch {
      showToast('Erro ao excluir despesa', 'error')
    }
  }

  const resetForm = () => {
    setDescricao('')
    setValor('')
    setCategoria(EXPENSE_CATEGORIES[0])
    setQuinzena('1')
    setDataVencimento(new Date().toISOString().split('T')[0])
    setRecorrente(false)
    setDiaVencimento('10')
    setDataFinal('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return

    const finalDate = recorrente
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
      : dataVencimento

    const cicloTipo = profile?.ciclo_tipo || '15_ultimo'
    const schema = createExpenseSchema(cicloTipo)
    const parsed = schema.safeParse({
      descricao,
      valor: parseFloat(valor) || 0,
      categoria,
      ...(mensal ? {} : { quinzena }),
      data_vencimento: finalDate,
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
      await addExpense(profileId, { ...parsed.data, data_final: recorrente && dataFinal ? dataFinal : undefined } as never)
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
      await toggleExpenseStatus(id, selectedMonth, selectedYear)
    } catch {
      showToast('Erro ao atualizar status', 'error')
    }
  }

  const inputWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1.5px solid var(--border)',
    borderRadius: 14,
    padding: '14px 16px',
    background: 'var(--card-bg)',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 15,
    color: 'var(--text)',
    background: 'transparent',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    marginBottom: 8,
  }
  const selectStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid var(--border)',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    color: 'var(--text)',
    background: 'var(--card-bg)',
    outline: 'none',
    appearance: 'none' as const,
  }

  return (
    <PageContainer>
      <Header title="Despesas" />

      <MonthYearSelector
        month={selectedMonth}
        year={selectedYear}
        onChange={handleMonthChange}
      />

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

        {/* Quinzena filter pills */}
        {!mensal && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {quinzenaFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setQuinzenaFilter(f.value)}
              style={{
                borderRadius: 20,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: quinzenaFilter === f.value ? '#2563eb' : 'var(--bg2)',
                color: quinzenaFilter === f.value ? '#fff' : 'var(--text2)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}

        {/* Expense list */}
        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
            Carregando...
          </p>
        ) : filteredExpenses.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
            Nenhuma transação encontrada
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                onClick={() => openEditModal(expense)}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                  {/* Category emoji */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--bg2)',
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
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                      {expense.descricao}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {formatDate(expense.data_vencimento)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--border)' }}>•</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {expense.categoria}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    {formatCurrency(expense.valor)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(expense.id)
                    }}
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

      {/* Edit Expense Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingExpenseId(null) }}
        title="Editar Despesa"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Descrição</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <input type="text" placeholder="Ex: Aluguel" value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Valor</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input type="number" placeholder="0,00" value={editValor} onChange={(e) => setEditValor(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Categoria</label>
            <select value={editCategoria} onChange={(e) => setEditCategoria(e.target.value)} style={selectStyle}>
              {EXPENSE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          {!mensal && (
          <div>
            <label style={labelStyle}>Quinzena</label>
            <select value={editQuinzena} onChange={(e) => setEditQuinzena(e.target.value)} style={selectStyle}>
              {quinzenaOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={editRecorrente} onChange={(e) => setEditRecorrente(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#2563eb' }} />
            Despesa fixa (recorrente)
          </label>
          {!editRecorrente ? (
            <div>
              <label style={labelStyle}>Data de vencimento</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input type="date" value={editDataVencimento} onChange={(e) => setEditDataVencimento(e.target.value)} style={inputStyle} />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Dia de vencimento</label>
                <div style={inputWrapStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <select value={editDiaVencimento} onChange={(e) => setEditDiaVencimento(e.target.value)} style={{ ...inputStyle, appearance: 'none' as const }}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>Dia {d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Data final (quando parar)</label>
                <div style={inputWrapStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input type="date" value={editDataFinal} onChange={(e) => setEditDataFinal(e.target.value)} style={inputStyle} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Deixe vazio para sem data final</p>
              </div>
            </>
          )}
          <button type="submit" disabled={submitting} style={{ width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            {submitting ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={handleDeleteFromEdit}
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              background: 'none',
              color: '#dc2626',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Excluir despesa
          </button>
        </form>
      </Modal>

      {/* Add Expense Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nova Despesa"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            <label style={labelStyle}>Descrição</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input
                type="number"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {!mensal && (
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
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              color: 'var(--text)',
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

          {!recorrente ? (
            <div>
              <label style={labelStyle}>Data de vencimento</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Dia de vencimento</label>
                <div style={inputWrapStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <select
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none' as const }}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>Dia {d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Data final (quando parar)</label>
                <div style={inputWrapStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input
                    type="date"
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                    style={inputStyle}
                    placeholder="Opcional"
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Deixe vazio para sem data final</p>
              </div>
            </>
          )}

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

      {/* Scope Selection Modal for Recurring Expenses */}
      <Modal
        isOpen={showScopeModal}
        onClose={handleScopeCancel}
        title="Escopo da Alteração"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
            Esta é uma despesa recorrente. Como deseja aplicar a alteração?
          </p>
          <button
            type="button"
            disabled={scopeLoading}
            onClick={() => handleScopeChoice('only_this_month')}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 14,
              border: '1.5px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text2)',
              fontSize: 15,
              fontWeight: 600,
              cursor: scopeLoading ? 'not-allowed' : 'pointer',
              opacity: scopeLoading ? 0.6 : 1,
            }}
          >
            Apenas este mês
          </button>
          <button
            type="button"
            disabled={scopeLoading}
            onClick={() => handleScopeChoice('this_and_future')}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: scopeLoading ? 'not-allowed' : 'pointer',
              opacity: scopeLoading ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            Este mês e todos os futuros
          </button>
          <button
            type="button"
            onClick={handleScopeCancel}
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              background: 'none',
              color: 'var(--text2)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </PageContainer>
  )
}
