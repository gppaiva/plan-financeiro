import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '../types'

export const expenseSchema = z.object({
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
  quinzena: z.enum(['1', '2'], {
    error: 'Quinzena deve ser 1 ou 2',
  }),
  data_vencimento: z
    .string()
    .min(1, 'Data de vencimento é obrigatória')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD'),
  status: z.enum(['paid', 'pending'], {
    error: 'Status deve ser "paid" ou "pending"',
  }),
  recorrente: z.boolean().optional().default(false),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
