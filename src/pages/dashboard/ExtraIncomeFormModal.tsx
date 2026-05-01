import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { extraIncomeSchema, type ExtraIncomeFormData } from '../../schemas/extra-income.schema'
import { parseCurrency, formatCurrencyInput } from '../../lib/format'
import type { ExtraIncome } from '../../types'

interface ExtraIncomeFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ExtraIncomeFormData) => Promise<void>
  initialData?: ExtraIncome | null
}

export function ExtraIncomeFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: ExtraIncomeFormModalProps) {
  const [descricao, setDescricao] = useState('')
  const [valorDisplay, setValorDisplay] = useState('')
  const [errors, setErrors] = useState<{ descricao?: string; valor?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  const isEditing = !!initialData

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDescricao(initialData.descricao)
        setValorDisplay(formatCurrencyInput(initialData.valor))
      } else {
        setDescricao('')
        setValorDisplay('')
      }
      setErrors({})
      setSubmitting(false)
    }
  }, [isOpen, initialData])

  const handleValorChange = useCallback((value: string) => {
    // Allow only digits, comma and dot for currency input
    const cleaned = value.replace(/[^\d.,]/g, '')
    setValorDisplay(cleaned)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const valorNumerico = parseCurrency(valorDisplay)

    const result = extraIncomeSchema.safeParse({
      descricao,
      valor: valorNumerico,
    })

    if (!result.success) {
      const fieldErrors: { descricao?: string; valor?: string } = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string
        if (field === 'descricao' || field === 'valor') {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      await onSubmit(result.data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Ganho Extra' : 'Novo Ganho Extra'}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <Input
          label="Descrição"
          id="extra-income-descricao"
          placeholder="Ex: 13° salário, férias, PLR"
          value={descricao}
          onChange={setDescricao}
          error={errors.descricao}
          aria-invalid={!!errors.descricao}
          aria-describedby={errors.descricao ? 'extra-income-descricao-error' : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="extra-income-valor"
            className="text-sm font-medium text-text2"
          >
            Valor
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text2/50"
              aria-hidden="true"
            >
              R$
            </span>
            <input
              id="extra-income-valor"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorDisplay}
              onChange={(e) => handleValorChange(e.target.value)}
              className={`w-full rounded-xl border bg-bg2 py-3 pr-4 pl-10 text-text placeholder:text-text2/50 outline-none transition-colors focus:border-primary ${errors.valor ? 'border-red' : 'border-border'}`}
              aria-invalid={!!errors.valor}
              aria-describedby={errors.valor ? 'extra-income-valor-error' : undefined}
            />
          </div>
          {errors.valor && (
            <p
              id="extra-income-valor-error"
              className="text-sm text-red"
              role="alert"
            >
              {errors.valor}
            </p>
          )}
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  )
}
