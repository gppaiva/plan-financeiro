import { describe, it, expect } from 'vitest'
import { parseInvoiceScreenshotText } from './invoice-image-parser'

describe('parseInvoiceScreenshotText - Bradesco', () => {
  it('should parse Bradesco invoice with 11 transactions totaling R$ 1336.57', () => {
    // Simulated OCR output from the Bradesco screenshots provided
    const ocrText = `
Lançamentos
Final 1234

22 e ROLDAO ATACADISTA R$ 98,63 >
Mai

21 e 99* R$ 15,50 >
Mai
e 99* R$ 16,51 >

20 e SALDO ANTERIOR R$ 1.555,79
Mai
e PAGTO. POR DEB EM C/C R$ -1.555,79 >

16 e 99Food *B Salgados pendi R$ 30,24 >
Mai

11 e ATACADAO 938 AS R$ 427,98 >
Abr
Parcela 2 de 2

09 e RIACHUELO 331 R$ 69,99 >
Set
Parcela 9 de 10

01 e SHOPPING CNA R$ 66,55 >
Ago
Parcela 11 de 18

09 e Wellhub Gustavo Pereira d R$ 99,99 >
Mai
e Wellhub bruno paiva R$ 99,99 >

08 e EBN *SPOTIFY R$ 40,90 >
Mai

12 e WWW-CASASBAHIA-COM-BR R$ 370,29 >
Mar
Parcela 3 de 10
`
    const result = parseInvoiceScreenshotText(ocrText)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.banco).toBe('Bradesco')
    expect(result.data.items).toHaveLength(11)
    expect(result.data.totalBrl).toBeCloseTo(1336.57, 2)

    // Verify individual items
    const items = result.data.items
    expect(items[0]).toMatchObject({ descricao: 'ROLDAO ATACADISTA', valorBrl: 98.63 })
    expect(items[1]).toMatchObject({ descricao: '99*', valorBrl: 15.50 })
    expect(items[2]).toMatchObject({ descricao: '99*', valorBrl: 16.51 })
    expect(items[3]).toMatchObject({ descricao: '99Food *B Salgados pendi', valorBrl: 30.24 })
    expect(items[4]).toMatchObject({ descricao: 'ATACADAO 938 AS', valorBrl: 427.98, parcela: '2/2' })
    expect(items[5]).toMatchObject({ descricao: 'RIACHUELO 331', valorBrl: 69.99, parcela: '9/10' })
    expect(items[6]).toMatchObject({ descricao: 'SHOPPING CNA', valorBrl: 66.55, parcela: '11/18' })
    expect(items[7]).toMatchObject({ descricao: 'Wellhub Gustavo Pereira d', valorBrl: 99.99 })
    expect(items[8]).toMatchObject({ descricao: 'Wellhub bruno paiva', valorBrl: 99.99 })
    expect(items[9]).toMatchObject({ descricao: 'EBN *SPOTIFY', valorBrl: 40.90 })
    expect(items[10]).toMatchObject({ descricao: 'WWW-CASASBAHIA-COM-BR', valorBrl: 370.29, parcela: '3/10' })
  })

  it('should skip SALDO ANTERIOR and PAGTO entries', () => {
    const ocrText = `
Lançamentos
Final 1234

20 e SALDO ANTERIOR R$ 1.555,79
Mai
e PAGTO. POR DEB EM C/C R$ -1.555,79 >
`
    const result = parseInvoiceScreenshotText(ocrText)
    expect(result.success).toBe(false) // No valid items → returns error
  })

  it('should handle OCR with O instead of 0 in day numbers', () => {
    const ocrText = `
Lançamentos
Final 5678

O9 e RIACHUELO 331 R$ 69,99 >
Set
Parcela 9 de 10

O8 o EBN *SPOTIFY R$ 40,90 >
Mai
`
    const result = parseInvoiceScreenshotText(ocrText)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.banco).toBe('Bradesco')
    expect(result.data.items).toHaveLength(2)
    expect(result.data.items[0]).toMatchObject({
      descricao: 'RIACHUELO 331',
      valorBrl: 69.99,
      parcela: '9/10',
      dataCompra: expect.stringMatching(/^\d{4}-09-09$/),
    })
    expect(result.data.items[1]).toMatchObject({
      descricao: 'EBN *SPOTIFY',
      valorBrl: 40.90,
      dataCompra: expect.stringMatching(/^\d{4}-05-08$/),
    })
  })

  it('should handle values with thousands separator', () => {
    const ocrText = `
Lançamentos
Final 1234

11 e ATACADAO 938 AS R$ 1.427,98 >
Abr
`
    const result = parseInvoiceScreenshotText(ocrText)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.items[0].valorBrl).toBe(1427.98)
  })

  it('should deduplicate overlapping screenshots', () => {
    const ocrText = `
Lançamentos
Final 1234

22 e ROLDAO ATACADISTA R$ 98,63 >
Mai

22 e ROLDAO ATACADISTA R$ 98,63 >
Mai
`
    const result = parseInvoiceScreenshotText(ocrText)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.items).toHaveLength(1)
    expect(result.data.items[0].valorBrl).toBe(98.63)
  })

  it('should not deduplicate same description with different values (e.g. two 99* rides)', () => {
    const ocrText = `
Lançamentos
Final 1234

21 e 99* R$ 15,50 >
Mai
e 99* R$ 16,51 >
`
    const result = parseInvoiceScreenshotText(ocrText)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.items).toHaveLength(2)
    expect(result.data.items[0].valorBrl).toBe(15.50)
    expect(result.data.items[1].valorBrl).toBe(16.51)
  })
})
