import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { MonthYearSelector } from '../../components/ui/MonthYearSelector'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useExpensesStore } from '../../stores/expenses.store'
import { useThirdPartyStore } from '../../stores/third-party.store'
import { useProfile, clearProfileCache } from '../../hooks/useProfile'
import { updateProfile } from '../../services/profile.service'
import { filterByQuinzena, calculatePaidTotal, calculatePendingTotal } from '../../lib/quinzena'
import { formatCurrency, parseCurrency, formatCurrencyInput } from '../../lib/format'
import type { Quinzena, Expense, ExpenseCategory } from '../../types'

type QuinzenaFilter = 'all' | Quinzena

export function DashboardPage() {
  const { user, profile, profileId } = useProfile()
  const { expenses, fetchExpenses } = useExpensesStore()
  const { expenses: thirdPartyExpenses, fetchExpenses: fetchThirdParty } = useThirdPartyStore()
  const [quinzenaFilter, setQuinzenaFilter] = useState<QuinzenaFilter>('all')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Edit income modal
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [editQ1, setEditQ1] = useState('')
  const [editQ1Num, setEditQ1Num] = useState(0)
  const [editQ2, setEditQ2] = useState('')
  const [editQ2Num, setEditQ2Num] = useState(0)
  const [savingIncome, setSavingIncome] = useState(false)
  const { showToast } = useToast()

  const openIncomeModal = useCallback(() => {
    const q1 = profile?.quinzena_1_valor ?? 0
    const q2 = profile?.quinzena_2_valor ?? 0
    setEditQ1Num(q1)
    setEditQ1(formatCurrencyInput(q1))
    setEditQ2Num(q2)
    setEditQ2(formatCurrencyInput(q2))
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
      // Update quinzena values directly via supabase
      const { supabase } = await import('../../lib/supabase')
      await supabase
        .from('user_profiles')
        .update({ quinzena_1_valor: editQ1Num, quinzena_2_valor: editQ2Num, salario_liquido: totalSalario })
        .eq('auth_user_id', user.id)
      clearProfileCache()
      showToast('Renda atualizada!', 'success')
      setShowIncomeModal(false)
      // Re-fetch by navigating (soft reload)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 300)
    } catch {
      showToast('Erro ao atualizar renda', 'error')
    } finally {
      setSavingIncome(false)
    }
  }

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const handleMonthChange = useCallback((month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }, [])

  useEffect(() => {
    if (profileId) {
      fetchExpenses(profileId, { month: selectedMonth, year: selectedYear })
      fetchThirdParty(profileId)
    }
  }, [profileId, selectedMonth, selectedYear, fetchExpenses, fetchThirdParty])

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

  const income = profile?.salario_liquido ?? 0
  const saldoReal = income - totalExpenses

  const categoryGroups = useMemo(() => {
    const groups = new Map<ExpenseCategory, Expense[]>()
    for (const expense of filteredExpenses) {
      const list = groups.get(expense.categoria) || []
      list.push(expense)
      groups.set(expense.categoria, list)
    }
    return groups
  }, [filteredExpenses])

  const filters: { label: string; value: QuinzenaFilter }[] = [
    { label: 'Mês Completo', value: 'all' },
    { label: 'Dia 15', value: '1' },
    { label: 'Último dia útil', value: '2' },
  ]

  const miniCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 10,
    flex: 1,
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
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
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
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                {formatCurrency(totalExpenses)}
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
        <div style={{ display: 'flex', gap: 8 }}>
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setQuinzenaFilter(f.value)}
              style={{
                borderRadius: 20,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: quinzenaFilter === f.value ? '#2563eb' : '#f1f5f9',
                color: quinzenaFilter === f.value ? '#fff' : '#64748b',
                transition: 'all 0.2s',
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
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Pago</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#16a34a', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(paidTotal)}
            </p>
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Pendente</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#ea580c', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(pendingTotal)}
            </p>
          </div>
        </div>

        {/* Category list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#64748b', margin: 0 }}>
            Por Categoria
          </h2>
          {Array.from(categoryGroups.entries()).map(([category, items]) => {
            const catTotal = items.reduce((sum, e) => sum + e.valor, 0)
            const isExpanded = expandedCategory === category

            return (
              <div
                key={category}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
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
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', margin: 0 }}>
                      {category}
                    </p>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, margin: '2px 0 0' }}>
                      {items.length} item(ns)
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                      {formatCurrency(catTotal)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
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
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 14, color: '#334155', margin: 0 }}>
                            {expense.descricao}
                          </p>
                          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, margin: '2px 0 0' }}>
                            {expense.status === 'paid' ? '✓ Pago' : '○ Pendente'}
                          </p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
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
            <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
              Nenhuma despesa encontrada
            </p>
          )}
        </div>
      </div>

      {/* Edit Income Modal */}
      <Modal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        title="Editar Renda"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            O saldo é calculado pela soma das quinzenas.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#1e293b', marginBottom: 8 }}>
              Dia 15
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
              <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={editQ1}
                onChange={(e) => { setEditQ1(e.target.value); setEditQ1Num(parseCurrency(e.target.value)) }}
                onBlur={() => setEditQ1(formatCurrencyInput(editQ1Num))}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1e293b', background: 'transparent' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#1e293b', marginBottom: 8 }}>
              Último dia útil
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
              <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={editQ2}
                onChange={(e) => { setEditQ2(e.target.value); setEditQ2Num(parseCurrency(e.target.value)) }}
                onBlur={() => setEditQ2(formatCurrencyInput(editQ2Num))}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1e293b', background: 'transparent' }}
              />
            </div>
          </div>

          {/* Total preview */}
          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#64748b' }}>Total mensal</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{formatCurrency(editQ1Num + editQ2Num)}</span>
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
