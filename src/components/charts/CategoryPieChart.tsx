import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface CategoryData {
  categoria: string
  total: number
  percentual: number
}

interface CategoryPieChartProps {
  data: CategoryData[]
}

const COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#ea580c', // orange
  '#d4183d', // red
  '#8b5cf6', // purple
  '#0891b2', // cyan
  '#ca8a04', // yellow
  '#64748b', // slate
  '#ec4899', // pink
]

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text2">
        Nenhum dado disponível
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoria"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            aria-label="Gráfico de despesas por categoria"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(Number(value))
            }
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2" role="list" aria-label="Legenda do gráfico">
        {data.map((item, index) => (
          <div key={item.categoria} className="flex items-center gap-1.5" role="listitem">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
              aria-hidden="true"
            />
            <span className="text-xs text-text2">
              {item.categoria} ({item.percentual.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
