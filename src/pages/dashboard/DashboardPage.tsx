import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { useExpensesStore } from '../../stores/expenses.store'
import { useThirdPartyStore } from '../../stores/third-party.store'
import { useAuthStore } from '../../stores/auth.store'
import { filterByQuinzena, calculatePaidTotal, calculatePendingTotal } from '../../lib/quinzena'
import { formatCurrency } from '../../lib/format'
import type { Quinzena, Expense, ExpenseCategory } from '../../types'

type QuinzenaFilter = 'all' | Quinzena

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { expenses, fetchExpenses } = useExpensesStore()
  const { expenses: thirdPartyExpenses, fetchExpenses: fetchThirdParty } = useThirdPartyStore()
  const [quinzenaFilter, setQuinzenaFilter] = useState<QuinzenaFilter>('all')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      const now = new Date()
      fetchExpenses(user.id, { month: now.getMonth() + 1, year: now.getFullYear() })
      fetchThirdParty(user.id)
    }
  }, [user, fetchExpenses, fetchThirdParty])

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

  const income = 0
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

  return (
    <PageContainer>
      <Header title="Dashboard" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Balance Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)',
            borderRadius: 20,
            padding: 24,
            color: '#fff',
          }}
        >
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Saldo Real</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>
            {formatCurrency(saldoReal)}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8, margin: '8px 0 0' }}>
            Receita - Despesas pessoais
          </p>
        </div>

        {/* Mini cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Receita</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#16a34a', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(income)}
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
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Despesas</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#dc2626', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(totalExpenses)}
            </p>
          </div>
        </div>

        {/* Third party total */}
        {thirdPartyTotal > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: 16,
            }}
          >
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Gastos com Terceiros</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#ea580c', marginTop: 6, margin: '6px 0 0' }}>
              {formatCurrency(thirdPartyTotal)}
            </p>
          </div>
        )}

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
    </PageContainer>
  )
}
