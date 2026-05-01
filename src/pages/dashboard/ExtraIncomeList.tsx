import { formatCurrency } from '../../lib/format'
import type { ExtraIncome } from '../../types'

interface ExtraIncomeListProps {
  incomes: ExtraIncome[]
  onEdit: (income: ExtraIncome) => void
  onDelete: (income: ExtraIncome) => void
}

export function ExtraIncomeList({ incomes, onEdit, onDelete }: ExtraIncomeListProps) {
  const total = incomes.reduce((sum, income) => sum + income.valor, 0)

  if (incomes.length === 0) {
    return (
      <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
        Nenhum ganho extra cadastrado
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {incomes.map((income) => (
        <div
          key={income.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {income.descricao}
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#16a34a', margin: '4px 0 0' }}>
              {formatCurrency(income.valor)}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, flexShrink: 0 }}>
            {/* Edit button */}
            <button
              type="button"
              onClick={() => onEdit(income)}
              aria-label={`Editar ${income.descricao}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDelete(income)}
              aria-label={`Excluir ${income.descricao}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* Total */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#f1f5f9',
          borderRadius: 12,
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>
          Total de extras
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#16a34a' }}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}
