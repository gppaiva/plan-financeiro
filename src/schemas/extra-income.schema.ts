import { z } from 'zod'

export const extraIncomeSchema = z.object({
  descricao: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(255, 'Descrição deve ter no máximo 255 caracteres'),
  valor: z
    .number()
    .positive('Valor deve ser positivo'),
  quinzena: z
    .enum(['1', '2'], { message: 'Selecione uma quinzena' }),
})

export type ExtraIncomeFormData = z.infer<typeof extraIncomeSchema>
