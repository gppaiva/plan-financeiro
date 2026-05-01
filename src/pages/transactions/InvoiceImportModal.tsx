import { useState, useMemo } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { parseC6Csv, extractCsvFromZip } from '../../lib/invoice-csv-parser'
import type { C6ParseResult } from '../../lib/invoice-csv-parser'
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
  const [fileName, setFileName] = useState<string | null>(null)
  const [zipPassword, setZipPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [zipArrayBuffer, setZipArrayBuffer] = useState<ArrayBuffer | null>(null)

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

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext !== 'csv' && ext !== 'zip') {
      setParseError('Apenas arquivos CSV e ZIP são aceitos')
      return
    }

    try {
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
      setParseError(message)
    }
  }

  const canSubmit = parseResult && dataVencimento && !submitting

  const handleUnlockZip = async () => {
    if (!zipArrayBuffer || !zipPassword) return
    setParseError(null)
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
    } catch {
      showToast('Erro ao importar fatura', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setParseResult(null)
    setParseError(null)
    setDataVencimento('')
    setQuinzena('1')
    setFileName(null)
    setNeedsPassword(false)
    setZipPassword('')
    setZipArrayBuffer(null)
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
        {/* File upload */}
        <div>
          <label style={labelStyle}>Arquivo CSV ou ZIP</label>
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
                accept=".csv,.zip"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

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

        {/* ZIP password */}
        {needsPassword && (
          <div>
            <label style={labelStyle}>Senha do arquivo ZIP</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ ...inputWrapStyle, flex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type="password"
                  placeholder="Digite a senha do ZIP"
                  value={zipPassword}
                  onChange={(e) => setZipPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnlockZip() }}
                  style={inputStyle}
                />
              </div>
              <button
                onClick={handleUnlockZip}
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

        {/* Date picker */}
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
      </div>
    </Modal>
  )
}
