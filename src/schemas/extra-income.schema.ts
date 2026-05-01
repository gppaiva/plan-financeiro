import { z } from 'zod'

/**
 * Creates an extra income validation schema based on the user's payment cycle type.
 * - For 'mensal': quinzena is optional (nullish)
 * - For quinzenal cycles ('15_ultimo', '5_20'): quinzena is required
 */
export function createExtraIncomeSchema(cicloTipo: string) {
  const base = {
    descricao: z
      .string()
      .min(1, 'Descrição é obrigatória')
      .max(255, 'Descrição deve ter no máximo 255 caracteres'),
    valor: z
      .number()
      .positive('Valor deve ser positivo'),
  }

  if (cicloTipo === 'mensal') {
    return z.object({
      ...base,
      quinzena: z.enum(['1', '2']).nullish(),
    })
  }

  return z.object({
    ...base,
    quinzena: z.enum(['1', '2'], { message: 'Selecione uma quinzena' }),
  })
}

// Keep existing extraIncomeSchema for backward compatibility
export const extraIncomeSchema = createExtraIncomeSchema('15_ultimo')

export type ExtraIncomeFormData = z.infer<typeof extraIncomeSchema>
