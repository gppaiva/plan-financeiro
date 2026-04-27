import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Card } from '../../components/ui/Card'
import { CategoryPieChart } from '../../components/charts/CategoryPieChart'
import { MonthlyEvolutionChart } from '../../components/charts/MonthlyEvolutionChart'
import { useExpensesStore } from '../../stores/expenses.store'
import { useAuthStore } from '../../stores/auth.store'
import { getCategoryBreakdown, getMonthlyEvolution } from '../../services/reports.service'
import { formatCurrency } from '../../lib/format'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const { expenses, fetchExpenses } = useExpensesStore()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [evolutionData, setEvolutionData] = useState<
    { month: string; receita: number; despesa: number }[]
  >([])

  useEffect(() => {
    if (user) {
      fetchExpenses(user.id, { month: selectedMonth, year: selectedYear })
    }
  }, [user, selectedMonth, selectedYear, fetchExpenses])

  useEffect(() => {
    if (user) {
      getMonthlyEvolution(user.id, selectedYear, 0).then((data) => {
        setEvolutionData(
          data.map((d) => ({
            month: String(d.month).padStart(2, '0'),
            receita: d.receita,
            despesa: d.despesa,
          })),
        )
      }).catch(() => {
        // Silently handle error
      })
    }
  }, [user, selectedYear])

  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(expenses),
    [expenses],
  )

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <PageContainer>
      <Header title="Relatórios" />

      <div className="flex flex-col gap-4 p-4">
        {/* Period filter */}
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="flex-1 rounded-xl border border-border bg-bg2 px-3 py-2 text-sm text-text"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-border bg-bg2 px-3 py-2 text-sm text-text"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Category Pie Chart */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">
            Despesas por Categoria
          </h2>
          <CategoryPieChart data={categoryBreakdown} />
        </Card>

        {/* Monthly Evolution Chart */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">
            Evolução Mensal
          </h2>
          <MonthlyEvolutionChart data={evolutionData} />
        </Card>

        {/* Category percentage list */}
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-text">
              Detalhamento por Categoria
            </h2>
          </div>
          {categoryBreakdown.length === 0 ? (
            <p className="p-4 text-center text-sm text-text2">
              Nenhum dado disponível
            </p>
          ) : (
            categoryBreakdown.map((item) => (
              <div
                key={item.categoria}
                className="flex items-center justify-between border-b border-border/50 px-4 py-3 last:border-b-0"
              >
                <div className="flex-1">
                  <p className="text-sm text-text">{item.categoria}</p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${item.percentual}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-medium text-text">
                    {formatCurrency(item.total)}
                  </p>
                  <p className="text-xs text-text2">
                    {item.percentual.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </PageContainer>
  )
}
