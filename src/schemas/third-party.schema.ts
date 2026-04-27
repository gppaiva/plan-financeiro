import { z } from 'zod'

export const thirdPartyExpenseSchema = z.object({
  pessoa: z
    .string()
    .min(1, 'Nome da pessoa é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  descricao: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(255, 'Descrição deve ter no máximo 255 caracteres'),
  valor: z
    .number()
    .positive('Valor deve ser positivo'),
  data_vencimento: z
    .string()
    .min(1, 'Data de vencimento é obrigatória')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD'),
  status: z.enum(['paid', 'pending'], {
    error: 'Status deve ser "paid" ou "pending"',
  }),
})

export type ThirdPartyExpenseFormData = z.infer<typeof thirdPartyExpenseSchema>
