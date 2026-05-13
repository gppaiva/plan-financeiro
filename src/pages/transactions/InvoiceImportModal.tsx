import { useState, useMemo } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import type { C6ParseResult } from '../../lib/invoice-csv-parser'
import { parseInvoiceScreenshots } from '../../lib/invoice-image-parser'
import { createInvoice } from '../../services/invoice.service'
import { formatCurrency } from '../../lib/format'
import { isMensal } from '../../lib/quinzena'

interface InvoiceImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  profileId: string
  cicloTipo: string
}

export function InvoiceImportModal({
  isOpen,
  onClose,
  onSuccess,
  profileId,
  cicloTipo,
}: InvoiceImportModalProps) {
  const { showToast } = useToast()
  const mensal = isMensal(cicloTipo)

  const [parseResult, setParseResult] = useState<C6ParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dataVencimento, setDataVencimento] = useState('')
  const [quinzena, setQuinzena] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Image state
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number } | null>(null)

  const quinzenaOptions = useMemo(() => {
    if (cicloTipo === '5_20') {
      return [
        { value: '1', label: '5º dia útil' },
        { value: '2', label: 'Dia 20' },
      ]
    }
    return [
      { value: '1', label: 'Dia 15' },
      { value: '2', label: 'Último dia útil' },
    ]
  }, [cicloTipo])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    setImageFiles(fileArray)
    setParseResult(null)
    setParseError(null)

    // Generate previews
    const previews: string[] = []
    for (const file of fileArray) {
      const url = URL.createObjectURL(file)
      previews.push(url)
    }
    setImagePreviews(previews)
  }

  const handleProcessImages = async () => {
    if (imageFiles.length === 0) return

    setProcessing(true)
    setParseError(null)
    setOcrProgress({ current: 0, total: imageFiles.length })

    try {
      const outcome = await parseInvoiceScreenshots(
        imageFiles,
        (current, total) => setOcrProgress({ current, total }),
      )

      if (outcome.success === false) {
        setParseError(outcome.error)
      } else {
        setParseResult(outcome.data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar imagens'
      setParseError(message)
    } finally {
      setProcessing(false)
      setOcrProgress(null)
    }
  }

  const handleClearImages = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    setImageFiles([])
    setImagePreviews([])
    setParseResult(null)
    setParseError(null)
    setOcrProgress(null)
    setProcessing(false)
  }

  const canSubmit = parseResult && dataVencimento && !submitting

  const handleSubmit = async () => {
    if (!parseResult || !dataVencimento) return

    setSubmitting(true)
    try {
      await createInvoice(profileId, {
        descricao: `Fatura ${parseResult.banco}`,
        dataVencimento,
        quinzena: mensal ? null : quinzena,
        items: parseResult.items.map((item) => ({
          data_compra: item.dataCompra,
          descricao: item.descricao,
          categoria_c6: item.categoriaC6,
          parcela: item.parcela,
          valor: item.valorBrl,
        })),
      })
      showToast('Fatura importada com sucesso!', 'success')
      handleClose()
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar fatura'
      if (msg.includes('Nenhuma transação nova')) {
        showToast(msg, 'success')
        handleClose()
      } else {
        showToast(msg, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    setImageFiles([])
    setImagePreviews([])
    setParseResult(null)
    setParseError(null)
    setDataVencimento('')
    setQuinzena('1')
    setOcrProgress(null)
    setProcessing(false)
    onClose()
  }

  const inputWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1.5px solid var(--border)',
    borderRadius: 14,
    padding: '14px 16px',
    background: 'var(--card-bg)',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 15,
    color: 'var(--text)',
    background: 'transparent',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    marginBottom: 8,
  }
  const selectStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid var(--border)',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    color: 'var(--text)',
    background: 'var(--card-bg)',
    outline: 'none',
    appearance: 'none' as const,
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Fatura">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Image upload */}
        {!parseResult && (
          <div>
            <label style={labelStyle}>Screenshots da fatura (C6 ou Bradesco)</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <label style={{ ...inputStyle, cursor: 'pointer', color: imageFiles.length > 0 ? 'var(--text)' : 'var(--text2)' }}>
                {imageFiles.length > 0
                  ? `${imageFiles.length} imagem(ns) selecionada(s)`
                  : 'Selecionar imagens...'}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </label>
              {imageFiles.length > 0 && (
                <button
                  onClick={handleClearImages}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Limpar imagens"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image thumbnails */}
        {imagePreviews.length > 0 && !parseResult && (
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {imagePreviews.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Screenshot ${idx + 1}`}
                style={{
                  width: 60,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {/* Process button */}
        {imageFiles.length > 0 && !parseResult && !processing && (
          <button
            onClick={handleProcessImages}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            Processar Imagens
          </button>
        )}

        {/* OCR processing indicator */}
        {processing && (
          <div style={{
            padding: '16px',
            borderRadius: 12,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, fontWeight: 500 }}>
              Processando imagens com OCR...
            </p>
            {ocrProgress && (
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: '4px 0 0' }}>
                Imagem {ocrProgress.current} de {ocrProgress.total}
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: '4px 0 0' }}>
              Isso pode levar alguns segundos por imagem
            </p>
          </div>
        )}

        {/* Parse error */}
        {parseError && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(220,38,38,0.1)',
            color: '#dc2626',
            fontSize: 14,
          }}>
            {parseError}
          </div>
        )}

        {/* Parse result summary */}
        {parseResult && (
          <div style={{
            padding: '16px',
            borderRadius: 14,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>Banco</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{parseResult.banco}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>Itens</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{parseResult.items.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(parseResult.totalBrl)}</span>
            </div>
          </div>
        )}

        {/* Date picker and submit — show when we have a result */}
        {parseResult && (
          <>
            <div>
              <label style={labelStyle}>Data de vencimento</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Quinzena selector (conditional) */}
            {!mensal && (
              <div>
                <label style={labelStyle}>Quinzena</label>
                <select
                  value={quinzena}
                  onChange={(e) => setQuinzena(e.target.value)}
                  style={selectStyle}
                >
                  {quinzenaOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '16px 0',
                borderRadius: 14,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.6,
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              }}
            >
              {submitting ? 'Importando...' : 'Importar'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
