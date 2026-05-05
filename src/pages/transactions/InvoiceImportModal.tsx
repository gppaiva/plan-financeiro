import { useState, useMemo } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { parseC6Csv, extractCsvFromZip } from '../../lib/invoice-csv-parser'
import type { C6ParseResult } from '../../lib/invoice-csv-parser'
import { extractTextFromPdf, parsePdfInvoice } from '../../lib/invoice-pdf-parser'
import { parseC6Screenshots } from '../../lib/invoice-image-parser'
import { createInvoice } from '../../services/invoice.service'
import { formatCurrency } from '../../lib/format'
import { isMensal } from '../../lib/quinzena'

type ImportMode = 'select' | 'image' | 'file'

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

  const [mode, setMode] = useState<ImportMode>('select')
  const [parseResult, setParseResult] = useState<C6ParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dataVencimento, setDataVencimento] = useState('')
  const [quinzena, setQuinzena] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [zipPassword, setZipPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [zipArrayBuffer, setZipArrayBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null)
  const [processing, setProcessing] = useState(false)

  // Image mode state
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseResult(null)
    setParseError(null)
    setFileName(file.name)
    setNeedsPassword(false)
    setZipPassword('')
    setZipArrayBuffer(null)
    setPdfArrayBuffer(null)

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext !== 'csv' && ext !== 'zip' && ext !== 'pdf') {
      setParseError('Apenas arquivos CSV, ZIP e PDF são aceitos')
      return
    }

    try {
      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer()
        setPdfArrayBuffer(arrayBuffer)
        setProcessing(true)
        try {
          const text = await extractTextFromPdf(arrayBuffer)
          const outcome = parsePdfInvoice(text)
          if (!outcome.success) {
            setParseError(outcome.error)
            return
          }
          setParseResult(outcome.data)
        } finally {
          setProcessing(false)
        }
        return
      }

      let csvContent: string

      if (ext === 'zip') {
        const arrayBuffer = await file.arrayBuffer()
        setZipArrayBuffer(arrayBuffer)
        csvContent = await extractCsvFromZip(arrayBuffer)
      } else {
        csvContent = await file.text()
      }

      const outcome = parseC6Csv(csvContent)

      if (!outcome.success) {
        setParseError(outcome.error)
        return
      }

      setParseResult(outcome.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo'
      if (message === 'ZIP_NEEDS_PASSWORD') {
        setNeedsPassword(true)
        return
      }
      if (message === 'PDF_NEEDS_PASSWORD') {
        setNeedsPassword(true)
        return
      }
      setParseError(message)
    }
  }

  const handleClearFile = () => {
    setFileName(null)
    setParseResult(null)
    setParseError(null)
    setNeedsPassword(false)
    setZipPassword('')
    setZipArrayBuffer(null)
    setPdfArrayBuffer(null)
    setProcessing(false)
  }

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
      const year = new Date().getFullYear()
      const outcome = await parseC6Screenshots(
        imageFiles,
        year,
        (current, total) => setOcrProgress({ current, total }),
      )

      if (!outcome.success) {
        setParseError(outcome.error)
        return
      }

      setParseResult(outcome.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar imagens'
      setParseError(message)
    } finally {
      setProcessing(false)
      setOcrProgress(null)
    }
  }

  const handleClearImages = () => {
    // Revoke object URLs to free memory
    imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    setImageFiles([])
    setImagePreviews([])
    setParseResult(null)
    setParseError(null)
    setOcrProgress(null)
    setProcessing(false)
  }

  const canSubmit = parseResult && dataVencimento && !submitting

  const handleUnlock = async () => {
    if (!zipPassword) return
    setParseError(null)

    if (pdfArrayBuffer) {
      try {
        const text = await extractTextFromPdf(pdfArrayBuffer, zipPassword)
        const outcome = parsePdfInvoice(text)
        if (!outcome.success) { setParseError(outcome.error); return }
        setParseResult(outcome.data)
        setNeedsPassword(false)
        setParseError(null)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
      }
      return
    }

    if (!zipArrayBuffer) return
    try {
      const csvContent = await extractCsvFromZip(zipArrayBuffer, zipPassword)
      const outcome = parseC6Csv(csvContent)
      if (!outcome.success) { setParseError(outcome.error); return }
      setParseResult(outcome.data)
      setNeedsPassword(false)
      setParseError(null)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
    }
  }

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
    setMode('select')
    setParseResult(null)
    setParseError(null)
    setDataVencimento('')
    setQuinzena('1')
    setFileName(null)
    setNeedsPassword(false)
    setZipPassword('')
    setZipArrayBuffer(null)
    setPdfArrayBuffer(null)
    setProcessing(false)
    // Clean up image state
    imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    setImageFiles([])
    setImagePreviews([])
    setOcrProgress(null)
    onClose()
  }

  const handleBack = () => {
    // Reset state when going back to mode selection
    setParseResult(null)
    setParseError(null)
    setFileName(null)
    setNeedsPassword(false)
    setZipPassword('')
    setZipArrayBuffer(null)
    setPdfArrayBuffer(null)
    setProcessing(false)
    imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    setImageFiles([])
    setImagePreviews([])
    setOcrProgress(null)
    setMode('select')
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

        {/* Mode selection */}
        {mode === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
              Como deseja importar a fatura?
            </p>
            <button
              onClick={() => setMode('image')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px',
                borderRadius: 14,
                border: '1.5px solid var(--border)',
                background: 'var(--card-bg)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 24 }}>📷</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  Imagens (Screenshots)
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                  Upload de screenshots do app C6
                </div>
              </div>
            </button>
            <button
              onClick={() => setMode('file')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px',
                borderRadius: 14,
                border: '1.5px solid var(--border)',
                background: 'var(--card-bg)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 24 }}>📄</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  Arquivo (CSV/ZIP/PDF)
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                  Importar arquivo de fatura
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Back button */}
        {mode !== 'select' && !parseResult && (
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
              alignSelf: 'flex-start',
            }}
          >
            ← Voltar
          </button>
        )}

        {/* Image mode */}
        {mode === 'image' && (
          <>
            {/* Image upload */}
            {!parseResult && (
              <div>
                <label style={labelStyle}>Screenshots do app C6</label>
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
          </>
        )}

        {/* File mode */}
        {mode === 'file' && (
          <>
            {/* File upload */}
            <div>
              <label style={labelStyle}>Arquivo CSV, ZIP ou PDF</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <label style={{ ...inputStyle, cursor: 'pointer', color: fileName ? 'var(--text)' : 'var(--text2)' }}>
                  {fileName || 'Selecionar arquivo...'}
                  <input
                    type="file"
                    accept=".csv,.zip,.pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
                {fileName && (
                  <button
                    onClick={handleClearFile}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Limpar arquivo"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Processing indicator */}
            {processing && (
              <div style={{
                padding: '16px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, fontWeight: 500 }}>
                  Processando PDF...
                </p>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: '4px 0 0' }}>
                  Isso pode levar alguns segundos
                </p>
              </div>
            )}

            {/* ZIP password */}
            {needsPassword && (
              <div>
                <label style={labelStyle}>Senha do arquivo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...inputWrapStyle, flex: 1 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      type="password"
                      placeholder="Digite a senha do arquivo"
                      value={zipPassword}
                      onChange={(e) => setZipPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock() }}
                      style={inputStyle}
                    />
                  </div>
                  <button
                    onClick={handleUnlock}
                    disabled={!zipPassword}
                    style={{
                      padding: '14px 20px',
                      borderRadius: 14,
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: zipPassword ? 'pointer' : 'not-allowed',
                      opacity: zipPassword ? 1 : 0.6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Desbloquear
                  </button>
                </div>
              </div>
            )}
          </>
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

        {/* Date picker — show when we have a result (either mode) */}
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
