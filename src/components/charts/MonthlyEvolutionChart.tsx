import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface MonthlyData {
  month: string
  receita: number
  despesa: number
}

interface MonthlyEvolutionChartProps {
  data: MonthlyData[]
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
}

function formatMonth(month: string): string {
  // Supports "01", "1", "2025-01", etc.
  const parts = month.split('-')
  const m = parts.length > 1 ? parts[1] : parts[0]
  return MONTH_LABELS[m.padStart(2, '0')] ?? month
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function MonthlyEvolutionChart({ data }: MonthlyEvolutionChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text2">
        Nenhum dado disponível
      </p>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    monthLabel: formatMonth(d.month),
  }))

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
        aria-label="Gráfico de evolução mensal de receitas e despesas"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fontSize: 12, fill: 'var(--text2)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text2)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => currencyFormatter.format(v)}
        />
        <Tooltip
          formatter={(value: number) => currencyFormatter.format(value)}
          contentStyle={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
          }}
        />
        <Legend
          formatter={(value: string) =>
            value === 'receita' ? 'Receita' : 'Despesa'
          }
        />
        <Bar dataKey="receita" fill="var(--green)" radius={[4, 4, 0, 0]} name="receita" />
        <Bar dataKey="despesa" fill="var(--red)" radius={[4, 4, 0, 0]} name="despesa" />
      </BarChart>
    </ResponsiveContainer>
  )
}
