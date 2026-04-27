import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Card } from '../../components/ui/Card'
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

  // Assume a fixed income for display (could come from profile)
  const income = 0 // Will be loaded from profile in a real scenario
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

      <div className="flex flex-col gap-4 p-4">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 p-5">
          <p className="text-sm text-primary-fg/70">Saldo Real</p>
          <p className="mt-1 text-2xl font-bold text-primary-fg">
            {formatCurrency(saldoReal)}
          </p>
          <p className="mt-2 text-xs text-primary-fg/60">
            Receita - Despesas pessoais
          </p>
        </Card>

        {/* Mini cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-text2">Receita</p>
            <p className="mt-1 text-lg font-semibold text-green">
              {formatCurrency(income)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text2">Despesas</p>
            <p className="mt-1 text-lg font-semibold text-red">
              {formatCurrency(totalExpenses)}
            </p>
          </Card>
        </div>

        {/* Third party total */}
        {thirdPartyTotal > 0 && (
          <Card className="p-4">
            <p className="text-xs text-text2">Gastos com Terceiros</p>
            <p className="mt-1 text-lg font-semibold text-orange">
              {formatCurrency(thirdPartyTotal)}
            </p>
          </Card>
        )}

        {/* Quinzena filter pills */}
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setQuinzenaFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                quinzenaFilter === f.value
                  ? 'bg-primary text-primary-fg'
                  : 'bg-bg2 text-text2'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Paid/Pending stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-text2">Pago</p>
            <p className="mt-1 text-lg font-semibold text-green">
              {formatCurrency(paidTotal)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text2">Pendente</p>
            <p className="mt-1 text-lg font-semibold text-orange">
              {formatCurrency(pendingTotal)}
            </p>
          </Card>
        </div>

        {/* Category list */}
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text2">Por Categoria</h2>
          {Array.from(categoryGroups.entries()).map(([category, items]) => {
            const catTotal = items.reduce((sum, e) => sum + e.valor, 0)
            const isExpanded = expandedCategory === category

            return (
              <Card key={category} className="overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedCategory(isExpanded ? null : category)
                  }
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{category}</p>
                    <p className="text-xs text-text2">{items.length} item(ns)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">
                      {formatCurrency(catTotal)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-text2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {items.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between border-b border-border/50 px-4 py-3 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm text-text">{expense.descricao}</p>
                          <p className="text-xs text-text2">
                            {expense.status === 'paid' ? '✓ Pago' : '○ Pendente'}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-text">
                          {formatCurrency(expense.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}

          {categoryGroups.size === 0 && (
            <p className="py-8 text-center text-sm text-text2">
              Nenhuma despesa encontrada
            </p>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
