import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { MonthYearSelector } from '../../components/ui/MonthYearSelector'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useExpensesStore } from '../../stores/expenses.store'
import { useThirdPartyStore } from '../../stores/third-party.store'
import { useExtraIncomeStore } from '../../stores/extra-income.store'
import { useProfile, clearProfileCache } from '../../hooks/useProfile'
import { updateProfile } from '../../services/profile.service'
import { filterByQuinzena, calculatePaidTotal, calculatePendingTotal } from '../../lib/quinzena'
import { formatCurrency, parseCurrency, formatCurrencyInput } from '../../lib/format'
import { extraIncomeSchema } from '../../schemas/extra-income.schema'
import type { Quinzena, Expense, ExpenseCategory, ExtraIncome } from '../../types'

type QuinzenaFilter = 'all' | Quinzena

export function DashboardPage() {
  const { user, profile, profileId } = useProfile()
  const { expenses, fetchExpenses } = useExpensesStore()
  const { expenses: thirdPartyExpenses, fetchExpenses: fetchThirdParty } = useThirdPartyStore()
  const {
    extraIncomes,
    loading: extraIncomesLoading,
    fetchExtraIncomes,
    addExtraIncome,
    updateExtraIncome,
    removeExtraIncome,
  } = useExtraIncomeStore()
  const [quinzenaFilter, setQuinzenaFilter] = useState<QuinzenaFilter>('all')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  // Edit income modal
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [editQ1, setEditQ1] = useState('')
  const [editQ1Num, setEditQ1Num] = useState(0)
  const [editQ2, setEditQ2] = useState('')
  const [editQ2Num, setEditQ2Num] = useState(0)
  const [savingIncome, setSavingIncome] = useState(false)
  const { showToast } = useToast()

  // Extra income inline form state (inside income modal)
  const [extraDesc, setExtraDesc] = useState('')
  const [extraValorDisplay, setExtraValorDisplay] = useState('')
  const [extraQuinzena, setExtraQuinzena] = useState<'1' | '2'>('1')
  const [extraErrors, setExtraErrors] = useState<{ descricao?: string; valor?: string; quinzena?: string }>({})
  const [addingExtra, setAddingExtra] = useState(false)
  const [editingExtra, setEditingExtra] = useState<ExtraIncome | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<ExtraIncome | null>(null)
  const [deletingExtra, setDeletingExtra] = useState(false)

  const openIncomeModal = useCallback(() => {
    const q1 = profile?.quinzena_1_valor ?? 0
    const q2 = profile?.quinzena_2_valor ?? 0
    setEditQ1Num(q1)
    setEditQ1(formatCurrencyInput(q1))
    setEditQ2Num(q2)
    setEditQ2(formatCurrencyInput(q2))
    setExtraDesc('')
    setExtraValorDisplay('')
    setExtraQuinzena('1')
    setExtraErrors({})
    setEditingExtra(null)
    setShowDeleteConfirm(null)
    setShowIncomeModal(true)
  }, [profile])

  const handleUpdateIncome = async () => {
    if (!user || !profile) return
    setSavingIncome(true)
    try {
      const totalSalario = editQ1Num + editQ2Num
      await updateProfile(user.id, {
        salario_liquido: totalSalario,
      })
      const { supabase } = await import('../../lib/supabase')
      await supabase
        .from('user_profiles')
        .update({ quinzena_1_valor: editQ1Num, quinzena_2_valor: editQ2Num, salario_liquido: totalSalario })
        .eq('auth_user_id', user.id)
      clearProfileCache()
      showToast('Renda atualizada!', 'success')
      setShowIncomeModal(false)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 300)
    } catch {
      showToast('Erro ao atualizar renda', 'error')
    } finally {
      setSavingIncome(false)
    }
  }

  // Extra income handlers
  const handleStartEditExtra = useCallback((income: ExtraIncome) => {
    setEditingExtra(income)
    setExtraDesc(income.descricao)
    setExtraValorDisplay(formatCurrencyInput(income.valor))
    setExtraQuinzena(income.quinzena)
    setExtraErrors({})
  }, [])

  const handleCancelEditExtra = useCallback(() => {
    setEditingExtra(null)
    setExtraDesc('')
    setExtraValorDisplay('')
    setExtraQuinzena('1')
    setExtraErrors({})
  }, [])

  const handleSaveExtra = useCallback(async () => {
    const valorNum = parseCurrency(extraValorDisplay)
    const result = extraIncomeSchema.safeParse({ descricao: extraDesc, valor: valorNum, quinzena: extraQuinzena })
    if (!result.success) {
      const fieldErrors: { descricao?: string; valor?: string; quinzena?: string } = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string
        if (field === 'descricao' || field === 'valor' || field === 'quinzena') fieldErrors[field] = issue.message
      }
      setExtraErrors(fieldErrors)
      return
    }
    setExtraErrors({})
    setAddingExtra(true)
    try {
      if (editingExtra) {
        await updateExtraIncome(editingExtra.id, result.data)
        showToast('Ganho extra atualizado!', 'success')
      } else {
        if (!profileId) return
        await addExtraIncome(profileId, result.data, selectedMonth, selectedYear)
        showToast('Ganho extra adicionado!', 'success')
      }
      setExtraDesc('')
      setExtraValorDisplay('')
      setExtraQuinzena('1')
      setEditingExtra(null)
    } catch {
      showToast(editingExtra ? 'Erro ao atualizar ganho extra' : 'Erro ao adicionar ganho extra', 'error')
    } finally {
      setAddingExtra(false)
    }
  }, [extraDesc, extraValorDisplay, extraQuinzena, editingExtra, profileId, selectedMonth, selectedYear, addExtraIncome, updateExtraIncome, showToast])

  const handleDeleteExtra = useCallback(async () => {
    if (!showDeleteConfirm) return
    setDeletingExtra(true)
    try {
      await removeExtraIncome(showDeleteConfirm.id)
      showToast('Ganho extra excluído!', 'success')
      setShowDeleteConfirm(null)
    } catch {
      showToast('Erro ao excluir ganho extra', 'error')
    } finally {
      setDeletingExtra(false)
    }
  }, [showDeleteConfirm, removeExtraIncome, showToast])

  const handleMonthChange = useCallback((month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }, [])

  useEffect(() => {
    if (profileId) {
      fetchExpenses(profileId, { month: selectedMonth, year: selectedYear })
      fetchThirdParty(profileId)
      fetchExtraIncomes(profileId, selectedMonth, selectedYear).catch(() => {
        showToast('Erro ao buscar ganhos extras', 'error')
      })
    }
  }, [profileId, selectedMonth, selectedYear, fetchExpenses, fetchThirdParty, fetchExtraIncomes, showToast])

  const filteredExpenses = useMemo(
    () => filterByQuinzena(expenses, quinzenaFilter),
    [expenses, quinzenaFilter],
  )

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.valor, 0),
    [filteredExpenses],
  )

  const thirdPartyTotal = useMemo(
    () => thirdPartyExpenses.reduce((sum, e) => sum + e.valor, 0),
    [thirdPartyExpenses],
  )

  const paidTotal = useMemo(() => calculatePaidTotal(filteredExpenses), [filteredExpenses])
  const pendingTotal = useMemo(() => calculatePendingTotal(filteredExpenses), [filteredExpenses])

  const incomeTotal = profile?.salario_liquido ?? 0
  const income = useMemo(() => {
    if (quinzenaFilter === '1') return profile?.quinzena_1_valor ?? 0
    if (quinzenaFilter === '2') return profile?.quinzena_2_valor ?? 0
    return incomeTotal
  }, [quinzenaFilter, profile, incomeTotal])
  const totalExtraIncomes = useMemo(
    () => {
      if (quinzenaFilter === 'all') return extraIncomes.reduce((sum, e) => sum + e.valor, 0)
      return extraIncomes.filter((e) => e.quinzena === quinzenaFilter).reduce((sum, e) => sum + e.valor, 0)
    },
    [extraIncomes, quinzenaFilter],
  )
  const saldoReal = income + totalExtraIncomes - totalExpenses

  const categoryGroups = useMemo(() => {
    const groups = new Map<ExpenseCategory, Expense[]>()
    for (const expense of filteredExpenses) {
      const list = groups.get(expense.categoria) || []
      list.push(expense)
      groups.set(expense.categoria, list)
    }
    return groups
  }, [filteredExpenses])

  const ciclo = profile?.ciclo_tipo || '15_ultimo'
  const q1Label = ciclo === '5_20' ? '5º dia útil' : 'Dia 15'
  const q2Label = ciclo === '5_20' ? 'Dia 20' : 'Último dia útil'

  const filters: { label: string; value: QuinzenaFilter }[] = [
    { label: 'Mês Completo', value: 'all' },
    { label: q1Label, value: '1' },
    { label: q2Label, value: '2' },
  ]

  const miniCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '8px 10px',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }

  return (
    <PageContainer>
      <Header title="Dashboard" />

      <MonthYearSelector
        month={selectedMonth}
        year={selectedYear}
        onChange={handleMonthChange}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Balance Card - Blue gradient */}
        <div
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
            borderRadius: 20,
            padding: 24,
            color: '#fff',
            position: 'relative',
          }}
        >
          {/* Edit icon top-right */}
          <button
            type="button"
            onClick={openIncomeModal}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 8,
              padding: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Editar saldo"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            Saldo Real Disponível
          </p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 16px' }}>
            {formatCurrency(saldoReal)}
          </p>

          {/* Mini cards inside gradient: Ganho + Despesas */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={miniCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Ganho</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatCurrency(income)}
              </p>
            </div>

            <div style={miniCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="7" y1="7" x2="17" y2="17" />
                  <polyline points="17 7 17 17 7 17" />
                </svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Despesas</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatCurrency(totalExpenses)}
              </p>
            </div>

            <div style={miniCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Extras</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatCurrency(totalExtraIncomes)}
              </p>
            </div>
          </div>

          {/* Third party mini card (full width, only if > 0) */}
          {thirdPartyTotal > 0 && (
            <div style={{ ...miniCardStyle, flex: 'none', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                  Terceiros (excl. saldo)
                </span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                {formatCurrency(thirdPartyTotal)}
              </p>
            </div>
          )}
        </div>

        {/* Quinzena filter pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {filters.map((f) => (
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

        {/* Paid/Pending stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 16,
              border: '1px solid var(--border)',
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>Pago</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#16a34a', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(paidTotal)}
            </p>
          </div>
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 16,
              border: '1px solid var(--border)',
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>Pendente</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#ea580c', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(pendingTotal)}
            </p>
          </div>
        </div>

        {/* Category list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', margin: 0 }}>
            Por Categoria
          </h2>
          {Array.from(categoryGroups.entries()).map(([category, items]) => {
            const catTotal = items.reduce((sum, e) => sum + e.valor, 0)
            const isExpanded = expandedCategory === category

            return (
              <div
                key={category}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() =>
                    setExpandedCategory(isExpanded ? null : category)
                  }
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                      {category}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, margin: '2px 0 0' }}>
                      {items.length} item(ns)
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {formatCurrency(catTotal)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text2)"
                      strokeWidth="2"
                      aria-hidden="true"
                      style={{
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div>
                    {items.map((expense) => (
                      <div
                        key={expense.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 14, color: 'var(--text)', margin: 0 }}>
                            {expense.descricao}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, margin: '2px 0 0' }}>
                            {expense.status === 'paid' ? '✓ Pago' : '○ Pendente'}
                          </p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                          {formatCurrency(expense.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {categoryGroups.size === 0 && (
            <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
              Nenhuma despesa encontrada
            </p>
          )}
        </div>
      </div>

      {/* Edit Income Modal */}
      <Modal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        title="Editar Saldo do Mês"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
            Ajuste os valores das quinzenas e adicione ganhos extras para este mês.
          </p>

          {/* Quinzena 1 */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
              {q1Label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', background: 'var(--card-bg)' }}>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={editQ1}
                onChange={(e) => { setEditQ1(e.target.value); setEditQ1Num(parseCurrency(e.target.value)) }}
                onBlur={() => setEditQ1(formatCurrencyInput(editQ1Num))}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)', background: 'transparent' }}
              />
            </div>
          </div>

          {/* Quinzena 2 */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
              {q2Label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', background: 'var(--card-bg)' }}>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={editQ2}
                onChange={(e) => { setEditQ2(e.target.value); setEditQ2Num(parseCurrency(e.target.value)) }}
                onBlur={() => setEditQ2(formatCurrencyInput(editQ2Num))}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)', background: 'transparent' }}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Extra Incomes Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                Ganhos Extras do Mês
              </label>
            </div>

            {/* Existing extra incomes list */}
            {extraIncomesLoading ? (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', padding: '8px 0' }}>Carregando...</p>
            ) : extraIncomes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {extraIncomes.map((ei) => (
                  <div key={ei.id}>
                    {showDeleteConfirm?.id === ei.id ? (
                      /* Delete confirmation inline */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca' }}>
                        <span style={{ fontSize: 13, color: '#991b1b' }}>Excluir "{ei.descricao}"?</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(null)}
                            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteExtra}
                            disabled={deletingExtra}
                            style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 500, cursor: deletingExtra ? 'not-allowed' : 'pointer', opacity: deletingExtra ? 0.6 : 1 }}
                          >
                            {deletingExtra ? '...' : 'Sim'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal item row */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ei.descricao}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a', margin: 0 }}>
                              {formatCurrency(ei.valor)}
                            </p>
                            <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 6, padding: '1px 6px' }}>
                              Q{ei.quinzena}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditExtra(ei)}
                            aria-label={`Editar ${ei.descricao}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(ei)}
                            aria-label={`Excluir ${ei.descricao}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 12px', textAlign: 'center' }}>
                Nenhum ganho extra neste mês
              </p>
            )}

            {/* Add/Edit extra income inline form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1.5px dashed var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', margin: 0 }}>
                {editingExtra ? 'Editar ganho extra' : 'Adicionar ganho extra'}
              </p>
              <input
                type="text"
                placeholder="Ex: 13° salário, férias, PLR"
                value={extraDesc}
                onChange={(e) => setExtraDesc(e.target.value)}
                style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)', background: 'var(--card-bg)', outline: 'none', borderColor: extraErrors.descricao ? '#ef4444' : 'var(--border)' }}
              />
              {extraErrors.descricao && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{extraErrors.descricao}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid', borderColor: extraErrors.valor ? '#ef4444' : 'var(--border)', borderRadius: 10, padding: '10px 14px', background: 'var(--card-bg)' }}>
                <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={extraValorDisplay}
                  onChange={(e) => setExtraValorDisplay(e.target.value.replace(/[^\d.,]/g, ''))}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', background: 'transparent' }}
                />
              </div>
              {extraErrors.valor && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{extraErrors.valor}</p>
              )}
              {/* Quinzena selector */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setExtraQuinzena('1')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 10,
                    border: '1.5px solid',
                    borderColor: extraQuinzena === '1' ? '#2563eb' : 'var(--border)',
                    background: extraQuinzena === '1' ? '#eff6ff' : 'var(--card-bg)',
                    color: extraQuinzena === '1' ? '#2563eb' : 'var(--text2)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {q1Label}
                </button>
                <button
                  type="button"
                  onClick={() => setExtraQuinzena('2')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 10,
                    border: '1.5px solid',
                    borderColor: extraQuinzena === '2' ? '#2563eb' : 'var(--border)',
                    background: extraQuinzena === '2' ? '#eff6ff' : 'var(--card-bg)',
                    color: extraQuinzena === '2' ? '#2563eb' : 'var(--text2)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {q2Label}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingExtra && (
                  <button
                    type="button"
                    onClick={handleCancelEditExtra}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveExtra}
                  disabled={addingExtra}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: '#16a34a',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: addingExtra ? 'not-allowed' : 'pointer',
                    opacity: addingExtra ? 0.6 : 1,
                  }}
                >
                  {addingExtra ? 'Salvando...' : editingExtra ? 'Atualizar' : '+ Adicionar'}
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Total preview */}
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Total mensal</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(editQ1Num + editQ2Num + totalExtraIncomes)}</span>
          </div>

          <button
            type="button"
            onClick={handleUpdateIncome}
            disabled={savingIncome}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: savingIncome ? 'not-allowed' : 'pointer',
              opacity: savingIncome ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {savingIncome ? 'Salvando...' : 'Atualizar'}
          </button>
        </div>
      </Modal>
    </PageContainer>
  )
}
