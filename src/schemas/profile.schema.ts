import { z } from 'zod'

export const profileSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z
    .string()
    .email('E-mail inválido'),
  telefone: z
    .string()
    .regex(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
    .optional(),
  salario_liquido: z
    .number()
    .nonnegative('Salário deve ser zero ou positivo'),
  dia_pagamento_1: z
    .number()
    .int('Dia deve ser um número inteiro')
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  dia_pagamento_2: z
    .number()
    .int('Dia deve ser um número inteiro')
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
})

export type ProfileFormData = z.infer<typeof profileSchema>
