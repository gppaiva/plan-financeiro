import { z } from 'zod'

export const investmentAccountSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome da conta é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  tipo: z
    .string()
    .min(1, 'Tipo é obrigatório')
    .max(50, 'Tipo deve ter no máximo 50 caracteres'),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hexadecimal válido (ex: #FF5733)')
    .optional(),
})

export const investmentTransactionSchema = z.object({
  conta_id: z
    .string()
    .min(1, 'Conta é obrigatória'),
  descricao: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(255, 'Descrição deve ter no máximo 255 caracteres')
    .optional(),
  valor: z
    .number()
    .positive('Valor deve ser positivo'),
  tipo: z.enum(['aporte', 'resgate'], {
    error: 'Tipo deve ser "aporte" ou "resgate"',
  }),
  data: z
    .string()
    .min(1, 'Data é obrigatória')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD'),
})

export type InvestmentAccountFormData = z.infer<typeof investmentAccountSchema>
export type InvestmentTransactionFormData = z.infer<typeof investmentTransactionSchema>
