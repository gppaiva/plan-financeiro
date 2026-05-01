import { useCallback } from 'react'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface MonthYearSelectorProps {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export function MonthYearSelector({ month, year, onChange }: MonthYearSelectorProps) {
  const goBack = useCallback(() => {
    if (month === 1) {
      onChange(12, year - 1)
    } else {
      onChange(month - 1, year)
    }
  }, [month, year, onChange])

  const goForward = useCallback(() => {
    if (month === 12) {
      onChange(1, year + 1)
    } else {
      onChange(month + 1, year)
    }
  }, [month, year, onChange])

  const arrowBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text2)',
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '12px 20px',
      }}
    >
      <button
        onClick={goBack}
        style={arrowBtnStyle}
        aria-label="Mês anterior"
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text)',
          minWidth: 140,
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {MONTH_NAMES[month - 1]} {year}
      </span>

      <button
        onClick={goForward}
        style={arrowBtnStyle}
        aria-label="Próximo mês"
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}
