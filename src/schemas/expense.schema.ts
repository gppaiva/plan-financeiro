import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '../types'

/**
 * Creates an expense validation schema based on the user's payment cycle type.
 * - For 'mensal': quinzena is optional (nullish)
 * - For quinzenal cycles ('15_ultimo', '5_20'): quinzena is required
 */
export function createExpenseSchema(cicloTipo: string) {
  const base = {
    descricao: z
      .string()
      .min(1, 'Descrição é obrigatória')
      .max(255, 'Descrição deve ter no máximo 255 caracteres'),
    valor: z
      .number()
      .positive('Valor deve ser positivo'),
    categoria: z.enum(EXPENSE_CATEGORIES, {
      error: 'Categoria inválida',
    }),
    data_vencimento: z
      .string()
      .min(1, 'Data de vencimento é obrigatória')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD'),
    status: z.enum(['paid', 'pending'], {
      error: 'Status deve ser "paid" ou "pending"',
    }),
    recorrente: z.boolean().optional().default(false),
  }

  if (cicloTipo === 'mensal') {
    return z.object({
      ...base,
      quinzena: z.enum(['1', '2']).nullish(),
    })
  }

  return z.object({
    ...base,
    quinzena: z.enum(['1', '2'], {
      error: 'Quinzena deve ser 1 ou 2',
    }),
  })
}

// Keep existing expenseSchema for backward compatibility
export const expenseSchema = createExpenseSchema('15_ultimo')

export type ExpenseFormData = z.infer<typeof expenseSchema>
