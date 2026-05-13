import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useDebtorsStore } from '../../stores/debtors.store'
import { useProfile } from '../../hooks/useProfile'
import { formatCurrency, formatDate } from '../../lib/format'
import type { Debtor, DebtorPayment } from '../../types'

export function DebtorsPage() {
  const { profileId } = useProfile()
  const { debtors, payments, loading, fetchDebtors, addDebtor, updateDebtor, deleteDebtor, fetchPayments, addPayment, deletePayment } = useDebtorsStore()
  const { showToast } = useToast()

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Add form
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')

  // Edit form
  const [editNome, setEditNome] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editValorTotal, setEditValorTotal] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Payment form
  const [paymentValor, setPaymentValor] = useState('')
  const [paymentData, setPaymentData] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (profileId) fetchDebtors(profileId)
  }, [profileId, fetchDebtors])

  const totalOwed = useMemo(() => {
    return debtors
      .filter((d) => d.status === 'open')
      .reduce((sum, d) => {
        const paid = (payments.get(d.id) ?? []).reduce((s, p) => s + p.valor, 0)
        return sum + (d.valor_total - paid)
      }, 0)
  }, [debtors, payments])

  const getAmountPaid = useCallback((debtorId: string) => {
    return (payments.get(debtorId) ?? []).reduce((sum, p) => sum + p.valor, 0)
  }, [payments])

  const openDebtorDetail = useCallback(async (debtor: Debtor) => {
    setSelectedDebtor(debtor)
    setEditNome(debtor.nome)
    setEditDescricao(debtor.descricao)
    setEditValorTotal(String(debtor.valor_total))
    setIsEditing(false)
    setShowPaymentForm(false)
    await fetchPayments(debtor.id)
  }, [fetchPayments])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return
    if (!nome.trim()) { showToast('Nome é obrigatório', 'error'); return }
    if (!descricao.trim()) { showToast('Descrição é obrigatória', 'error'); return }
    const val = parseFloat(valorTotal) || 0
    if (val <= 0) { showToast('Valor deve ser positivo', 'error'); return }
    setSubmitting(true)
    try {
      await addDebtor(profileId, { nome, descricao, valor_total: val })
      showToast('Devedor adicionado!', 'success')
      setShowAddModal(false)
      setNome(''); setDescricao(''); setValorTotal('')
    } catch { showToast('Erro ao adicionar', 'error') }
    finally { setSubmitting(false) }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDebtor) return
    setSubmitting(true)
    try {
      await updateDebtor(selectedDebtor.id, { nome: editNome, descricao: editDescricao, valor_total: parseFloat(editValorTotal) || 0 })
      showToast('Atualizado!', 'success')
      setIsEditing(false)
      setSelectedDebtor({ ...selectedDebtor, nome: editNome, descricao: editDescricao, valor_total: parseFloat(editValorTotal) || 0 })
    } catch { showToast('Erro ao atualizar', 'error') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!selectedDebtor) return
    if (!window.confirm('Excluir este devedor e todos os pagamentos?')) return
    try {
      await deleteDebtor(selectedDebtor.id)
      showToast('Excluído', 'success')
      setSelectedDebtor(null)
    } catch { showToast('Erro ao excluir', 'error') }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDebtor) return
    const val = parseFloat(paymentValor) || 0
    if (val <= 0) { showToast('Valor deve ser positivo', 'error'); return }
    setSubmitting(true)
    try {
      await addPayment(selectedDebtor.id, { valor: val, data_pagamento: paymentData })
      showToast('Pagamento registrado!', 'success')
      setShowPaymentForm(false)
      setPaymentValor('')
      setPaymentData(new Date().toISOString().split('T')[0])
    } catch { showToast('Erro ao registrar pagamento', 'error') }
    finally { setSubmitting(false) }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedDebtor) return
    if (!window.confirm('Excluir este pagamento?')) return
    try {
      await deletePayment(paymentId, selectedDebtor.id)
      showToast('Pagamento excluído', 'success')
    } catch { showToast('Erro ao excluir', 'error') }
  }

  const iw: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', background: 'var(--card-bg)' }
  const is: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', fontSize: 16, color: 'var(--text)', background: 'transparent', width: '100%' }
  const ls: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }
  const btnBlue: React.CSSProperties = { width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }

  const debtorPayments = selectedDebtor ? (payments.get(selectedDebtor.id) ?? []) : []
  const selectedPaid = selectedDebtor ? getAmountPaid(selectedDebtor.id) : 0
  const selectedRemaining = selectedDebtor ? selectedDebtor.valor_total - selectedPaid : 0

  return (
    <PageContainer>
      <Header title="Devedores" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Total card */}
        {totalOwed > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', borderRadius: 20, padding: 24, color: '#fff' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Total a Receber</p>
            <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>{formatCurrency(totalOwed)}</p>
          </div>
        )}

        {/* Add button */}
        <button onClick={() => setShowAddModal(true)} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Devedor
        </button>

        {/* List */}
        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>Carregando...</p>
        ) : debtors.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>Nenhum devedor cadastrado</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {debtors.map((debtor) => {
              const paid = getAmountPaid(debtor.id)
              const remaining = debtor.valor_total - paid
              const progress = debtor.valor_total > 0 ? (paid / debtor.valor_total) * 100 : 0
              return (
                <div
                  key={debtor.id}
                  onClick={() => openDebtorDetail(debtor)}
                  style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: 16, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#ea580c' }}>
                        {debtor.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{debtor.nome}</p>
                        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>{debtor.descricao}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: debtor.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'rgba(234,88,12,0.1)', color: debtor.status === 'paid' ? '#16a34a' : '#ea580c' }}>
                      {debtor.status === 'paid' ? 'Quitada' : 'Em aberto'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text)' }}>Dívida: {formatCurrency(debtor.valor_total)}</span>
                    <span style={{ color: '#16a34a' }}>Pago: {formatCurrency(paid)}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: debtor.status === 'paid' ? '#16a34a' : '#ea580c', borderRadius: 2, transition: 'width 0.3s ease' }} />
                  </div>
                  {remaining > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 0', textAlign: 'right' }}>Restante: {formatCurrency(remaining)}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Novo Devedor">
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div><label style={ls}>Nome</label><div style={iw}><input type="text" placeholder="Ex: João" value={nome} onChange={(e) => setNome(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Descrição</label><div style={iw}><input type="text" placeholder="Ex: Venda celular" value={descricao} onChange={(e) => setDescricao(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Valor total da dívida</label><div style={iw}><input type="number" placeholder="0,00" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} style={is} /></div></div>
          <button type="submit" disabled={submitting} style={btnBlue}>{submitting ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </Modal>

      {/* Detail Bottom Sheet */}
      <Modal isOpen={!!selectedDebtor} onClose={() => setSelectedDebtor(null)} title={selectedDebtor?.nome || ''}>
        {selectedDebtor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>Valor Total</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '4px 0 0' }}>{formatCurrency(selectedDebtor.valor_total)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>Restante</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: selectedRemaining <= 0 ? '#16a34a' : '#ea580c', margin: '4px 0 0' }}>{formatCurrency(Math.max(0, selectedRemaining))}</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>{selectedDebtor.descricao}</p>

            {/* Edit toggle */}
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} style={{ padding: '10px 0', border: 'none', background: 'none', color: '#2563eb', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
                Editar dados
              </button>
            ) : (
              <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={iw}><input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} style={is} placeholder="Nome" /></div>
                <div style={iw}><input type="text" value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} style={is} placeholder="Descrição" /></div>
                <div style={iw}><input type="number" value={editValorTotal} onChange={(e) => setEditValorTotal(e.target.value)} style={is} placeholder="Valor total" /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={submitting} style={{ ...btnBlue, padding: '12px 0' }}>Salvar</button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Add payment */}
            {selectedRemaining > 0 && !showPaymentForm && (
              <button onClick={() => setShowPaymentForm(true)} style={{ ...btnBlue, padding: '12px 0' }}>
                Registrar Pagamento
              </button>
            )}

            {showPaymentForm && (
              <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, background: 'var(--bg2)', borderRadius: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Novo Pagamento</p>
                <div style={iw}><input type="number" placeholder="Valor" value={paymentValor} onChange={(e) => setPaymentValor(e.target.value)} style={is} /></div>
                <div style={iw}><input type="date" value={paymentData} onChange={(e) => setPaymentData(e.target.value)} style={is} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={submitting} style={{ ...btnBlue, padding: '10px 0', fontSize: 14 }}>Confirmar</button>
                  <button type="button" onClick={() => setShowPaymentForm(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </form>
            )}

            {/* Payments list */}
            {debtorPayments.length > 0 && (
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: '0 0 8px' }}>Pagamentos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {debtorPayments.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 10 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#16a34a', margin: 0 }}>{formatCurrency(p.valor)}</p>
                        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>{formatDate(p.data_pagamento)}</p>
                      </div>
                      <button onClick={() => handleDeletePayment(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delete */}
            <button onClick={handleDelete} style={{ width: '100%', padding: '12px 0', border: 'none', background: 'none', color: '#dc2626', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Excluir devedor
            </button>
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
