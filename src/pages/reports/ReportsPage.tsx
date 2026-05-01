import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { CategoryPieChart } from '../../components/charts/CategoryPieChart'
import { MonthlyEvolutionChart } from '../../components/charts/MonthlyEvolutionChart'
import { useExpensesStore } from '../../stores/expenses.store'
import { useProfile } from '../../hooks/useProfile'
import { getCategoryBreakdown, getMonthlyEvolution } from '../../services/reports.service'
import { formatCurrency } from '../../lib/format'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function ReportsPage() {
  const { profileId } = useProfile()
  const { expenses, fetchExpenses } = useExpensesStore()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [evolutionData, setEvolutionData] = useState<
    { month: string; receita: number; despesa: number }[]
  >([])

  useEffect(() => {
    if (profileId) {
      fetchExpenses(profileId, { month: selectedMonth, year: selectedYear })
    }
  }, [profileId, selectedMonth, selectedYear, fetchExpenses])

  useEffect(() => {
    if (profileId) {
      getMonthlyEvolution(profileId, selectedYear, 0).then((data) => {
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
  }, [profileId, selectedYear])

  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(expenses),
    [expenses],
  )

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  const selectStyle: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid var(--border)',
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    background: 'var(--card-bg)',
    outline: 'none',
    appearance: 'none' as const,
  }

  return (
    <PageContainer>
      <Header title="Relatórios" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Period filter */}
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ ...selectStyle, flex: 1 }}
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
            style={selectStyle}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Category Pie Chart */}
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>
            Despesas por Categoria
          </h2>
          <CategoryPieChart data={categoryBreakdown} />
        </div>

        {/* Monthly Evolution Chart */}
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>
            Evolução Mensal
          </h2>
          <MonthlyEvolutionChart data={evolutionData} />
        </div>

        {/* Category percentage list */}
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Detalhamento por Categoria
            </h2>
          </div>
          {categoryBreakdown.length === 0 ? (
            <p style={{ padding: '24px 20px', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
              Nenhum dado disponível
            </p>
          ) : (
            categoryBreakdown.map((item, index) => (
              <div
                key={item.categoria}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: index < categoryBreakdown.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, color: 'var(--text)', margin: 0 }}>{item.categoria}</p>
                  <div
                    style={{
                      marginTop: 8,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--border)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 3,
                        background: '#2563eb',
                        width: `${item.percentual}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginLeft: 16, textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                    {formatCurrency(item.total)}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, margin: '2px 0 0' }}>
                    {item.percentual.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  )
}
