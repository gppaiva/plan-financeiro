import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { listInvoiceItems, updateInvoiceItem } from '../../services/invoice.service'
import { formatCurrency, formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
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
  const [redirectingItemId, setRedirectingItemId] = useState<string | null>(null)
  const [redirectPessoa, setRedirectPessoa] = useState('')
  const [redirectValor, setRedirectValor] = useState('')
  const [redirecting, setRedirecting] = useState(false)

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

  const handleRedirectToThirdParty = async (item: InvoiceItem) => {
    if (!redirectPessoa.trim()) {
      showToast('Informe o nome da pessoa', 'error')
      return
    }
    const valorToRedirect = parseFloat(redirectValor)
    if (isNaN(valorToRedirect) || valorToRedirect <= 0) {
      showToast('Valor deve ser maior que zero', 'error')
      return
    }
    if (valorToRedirect > Number(item.valor)) {
      showToast('Valor não pode ser maior que o valor do item', 'error')
      return
    }
    setRedirecting(true)
    try {
      // 1. Create third-party expense with link to invoice item
      const { error } = await supabase.from('third_party_expenses').insert({
        user_id: expense.user_id,
        pessoa: redirectPessoa.trim(),
        descricao: item.descricao,
        valor: valorToRedirect,
        data_vencimento: expense.data_vencimento,
        status: 'pending',
        source_invoice_item_id: item.id,
      })
      if (error) throw new Error(error.message)

      // 2. Subtract the redirected value from the invoice item
      const newItemValor = Math.round((Number(item.valor) - valorToRedirect) * 100) / 100
      if (newItemValor > 0) {
        try {
          const { newTotal } = await updateInvoiceItem(item.id, expense.id, newItemValor)
          setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, valor: newItemValor } : i))
          onExpenseUpdated({ ...expense, valor: newTotal })
        } catch (updateErr) {
          console.error('Erro ao subtrair valor do item:', updateErr)
          // Third-party was created but item wasn't updated — still show partial success
        }
      } else {
        // If value becomes 0, delete the item
        try {
          const { error: delError } = await supabase.from('invoice_items').delete().eq('id', item.id)
          if (delError) console.error('Erro ao deletar item:', delError)
          setItems((prev) => prev.filter((i) => i.id !== item.id))
          // Recalculate total
          const remaining = items.filter((i) => i.id !== item.id)
          const newTotal = remaining.reduce((sum, i) => sum + Number(i.valor), 0)
          const roundedTotal = Math.round(newTotal * 100) / 100
          const { error: expError } = await supabase.from('expenses').update({ valor: roundedTotal }).eq('id', expense.id)
          if (expError) console.error('Erro ao atualizar total:', expError)
          onExpenseUpdated({ ...expense, valor: roundedTotal })
        } catch (delErr) {
          console.error('Erro ao remover item zerado:', delErr)
        }
      }

      showToast(`R$ ${valorToRedirect.toFixed(2).replace('.', ',')} direcionado para ${redirectPessoa.trim()}!`, 'success')
      setRedirectingItemId(null)
      setRedirectPessoa('')
      setRedirectValor('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      showToast(`Erro ao direcionar gasto: ${msg}`, 'error')
    } finally {
      setRedirecting(false)
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
                  {/* Redirect to third party */}
                  {redirectingItemId === item.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="Nome da pessoa"
                        value={redirectPessoa}
                        onChange={(e) => setRedirectPessoa(e.target.value)}
                        autoFocus
                        style={{
                          border: '1.5px solid var(--border)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 13,
                          color: 'var(--text)',
                          background: 'var(--card-bg)',
                          outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--card-bg)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>R$</span>
                        <input
                          type="number"
                          value={redirectValor}
                          onChange={(e) => setRedirectValor(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRedirectToThirdParty(item); if (e.key === 'Escape') { setRedirectingItemId(null); setRedirectPessoa(''); setRedirectValor('') } }}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: 13,
                            color: 'var(--text)',
                            background: 'transparent',
                            textAlign: 'right',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleRedirectToThirdParty(item)}
                        disabled={redirecting || !redirectPessoa.trim()}
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#2563eb',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: redirecting || !redirectPessoa.trim() ? 'not-allowed' : 'pointer',
                          opacity: redirecting || !redirectPessoa.trim() ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {redirecting ? '...' : 'Enviar'}
                      </button>
                      <button
                        onClick={() => { setRedirectingItemId(null); setRedirectPessoa(''); setRedirectValor('') }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'var(--bg2)',
                          color: 'var(--text2)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRedirectingItemId(item.id)
                        setEditingItemId(null)
                        setRedirectPessoa('')
                        setRedirectValor(String(item.valor))
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'none',
                        color: '#ea580c',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Direcionar gasto
                    </button>
                  )}
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
