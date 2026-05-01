import { z } from 'zod'

/** Schema for a single invoice item (validation at import time) */
export const invoiceItemSchema = z.object({
  dataCompra: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  descricao: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(255, 'Descrição deve ter no máximo 255 caracteres'),
  categoriaC6: z
    .string()
    .max(100, 'Categoria deve ter no máximo 100 caracteres'),
  parcela: z
    .string()
    .max(50, 'Parcela deve ter no máximo 50 caracteres'),
  valorBrl: z
    .number()
    .positive('Valor deve ser positivo'),
})

/** Schema for the import form */
export const invoiceImportSchema = z.object({
  dataVencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida'),
  quinzena: z.enum(['1', '2']).nullish(),
})

export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>
export type InvoiceImportFormData = z.infer<typeof invoiceImportSchema>
