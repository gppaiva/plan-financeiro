import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { listInvoiceItems, updateInvoiceItem } from '../../services/invoice.service'
import { formatCurrency, formatDate } from '../../lib/format'
import type { Expense, InvoiceItem } from '../../types'

interface InvoiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  expense: Expense
  onExpenseUpdated: (updated: Expense) => void
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  expense,
  onExpenseUpdated,
}: InvoiceDetailModalProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchItems = useCallback(async () => {
    if (!expense?.id) return
    setLoading(true)
    try {
      const data = await listInvoiceItems(expense.id)
      setItems(data)
    } catch {
      showToast('Erro ao carregar itens da fatura', 'error')
    } finally {
      setLoading(false)
    }
  }, [expense?.id, showToast])

  useEffect(() => {
    if (isOpen && expense?.id) {
      fetchItems()
    }
  }, [isOpen, expense?.id, fetchItems])

  const total = items.reduce((sum, item) => sum + Number(item.valor), 0)

  const handleStartEdit = (item: InvoiceItem) => {
    setEditingItemId(item.id)
    setEditValor(String(item.valor))
  }

  const handleCancelEdit = () => {
    setEditingItemId(null)
    setEditValor('')
  }

  const handleConfirmEdit = async () => {
    if (!editingItemId) return

    const newValor = parseFloat(editValor)
    if (isNaN(newValor) || newValor <= 0) {
      showToast('Valor deve ser maior que zero', 'error')
      return
    }

    setSaving(true)
    try {
      const { newTotal } = await updateInvoiceItem(editingItemId, expense.id, newValor)

      // Update local items list
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId ? { ...item, valor: newValor } : item,
        ),
      )

      // Notify parent about updated expense total
      onExpenseUpdated({ ...expense, valor: newTotal })

      setEditingItemId(null)
      setEditValor('')
      showToast('Item atualizado', 'success')
    } catch {
      showToast('Erro ao atualizar item', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhe da Fatura">
      {loading ? (
        <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
          Carregando...
        </p>
      ) : items.length === 0 ? (
        <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
          Nenhum item encontrado
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (editingItemId !== item.id) handleStartEdit(item)
              }}
              style={{
                background: 'var(--bg)',
                borderRadius: 12,
                border: editingItemId === item.id ? '1.5px solid #2563eb' : '1px solid var(--border)',
                padding: 12,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.descricao}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {formatDate(item.data_compra)}
                    </span>
                    {item.categoria_c6 && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--border)' }}>•</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {item.categoria_c6}
                        </span>
                      </>
                    )}
                    {item.parcela && item.parcela !== 'Única' && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--border)' }}>•</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {item.parcela}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  {editingItemId === item.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        value={editValor}
                        onChange={(e) => setEditValor(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        style={{
                          width: 90,
                          border: '1.5px solid var(--border)',
                          borderRadius: 8,
                          padding: '6px 8px',
                          fontSize: 14,
                          color: 'var(--text)',
                          background: 'var(--card-bg)',
                          outline: 'none',
                          textAlign: 'right',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConfirmEdit()
                        }}
                        disabled={saving}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: 'none',
                          background: '#2563eb',
                          color: '#fff',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        aria-label="Confirmar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancelEdit()
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: 'none',
                          background: 'var(--bg2)',
                          color: 'var(--text2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        aria-label="Cancelar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      {formatCurrency(Number(item.valor))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Total footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 12px 0',
            borderTop: '1.5px solid var(--border)',
            marginTop: 8,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}
