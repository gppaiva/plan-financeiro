import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useInvestmentsStore } from '../../stores/investments.store'
import { useProfile } from '../../hooks/useProfile'
import { formatCurrency } from '../../lib/format'
import type { InvestmentAccount } from '../../types'

export function InvestmentsPage() {
  const { profileId } = useProfile()
  const { accounts, loading, fetchAccounts, updateAccount, deleteAccount } =
    useInvestmentsStore()
  const { showToast } = useToast()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Add form
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('')
  const [valor, setValor] = useState('')

  // Edit form
  const [editNome, setEditNome] = useState('')
  const [editTipo, setEditTipo] = useState('')
  const [editValor, setEditValor] = useState('')

  useEffect(() => {
    if (profileId) { fetchAccounts(profileId) }
  }, [profileId, fetchAccounts])

  const totalInvested = useMemo(
    () => accounts.reduce((sum, a) => sum + a.saldo_atual, 0),
    [accounts],
  )

  const openEditModal = useCallback((account: InvestmentAccount) => {
    setEditingId(account.id)
    setEditNome(account.nome)
    setEditTipo(account.tipo)
    setEditValor(String(account.saldo_atual))
    setShowEditModal(true)
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return
    if (!nome.trim()) { showToast('Instituição é obrigatória', 'error'); return }
    if (!tipo.trim()) { showToast('Tipo é obrigatório', 'error'); return }
    const valorNum = parseFloat(valor) || 0
    if (valorNum <= 0) { showToast('Valor deve ser positivo', 'error'); return }

    setSubmitting(true)
    try {
      // Create account with initial balance
      const { supabase } = await import('../../lib/supabase')
      const { data: created, error } = await supabase
        .from('investment_accounts')
        .insert({ user_id: profileId, nome, tipo, saldo_atual: valorNum })
        .select()
        .single()
      if (error) throw new Error(error.message)
      // Update store manually
      useInvestmentsStore.setState((state) => ({
        accounts: [...state.accounts, created as InvestmentAccount],
      }))
      showToast('Investimento adicionado!', 'success')
      setShowAddModal(false)
      setNome(''); setTipo(''); setValor('')
    } catch { showToast('Erro ao adicionar', 'error') }
    finally { setSubmitting(false) }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSubmitting(true)
    try {
      await updateAccount(editingId, {
        nome: editNome,
        tipo: editTipo,
        saldo_atual: parseFloat(editValor) || 0,
      })
      showToast('Investimento atualizado!', 'success')
      setShowEditModal(false)
      setEditingId(null)
    } catch { showToast('Erro ao atualizar', 'error') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!editingId) return
    if (!window.confirm('Tem certeza que deseja excluir este investimento?')) return
    try {
      await deleteAccount(editingId)
      showToast('Investimento excluído', 'success')
      setShowEditModal(false)
      setEditingId(null)
    } catch { showToast('Erro ao excluir', 'error') }
  }

  const iw: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', background: '#fff' }
  const is: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1e293b', background: 'transparent', width: '100%' }
  const ls: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500, color: '#1e293b', marginBottom: 8 }
  const btnBlue: React.CSSProperties = { width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }

  const bankIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
  const typeIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  const dollarIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>

  return (
    <PageContainer>
      <Header title="Investimentos" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Total */}
        <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: 20, padding: 24, color: '#fff' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Total Investido</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>{formatCurrency(totalInvested)}</p>
        </div>

        {/* Add button */}
        <button onClick={() => setShowAddModal(true)} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Investimento
        </button>

        {/* List */}
        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>Carregando...</p>
        ) : accounts.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>Nenhum investimento cadastrado</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {accounts.map((account) => (
              <div
                key={account.id}
                onClick={() => openEditModal(account)}
                style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', margin: 0 }}>{account.nome}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{account.tipo}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a', margin: 0 }}>{formatCurrency(account.saldo_atual)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Novo Investimento">
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div><label style={ls}>Instituição</label><div style={iw}>{bankIcon}<input type="text" placeholder="Ex: Nubank, XP, Inter" value={nome} onChange={(e) => setNome(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Tipo do investimento</label><div style={iw}>{typeIcon}<input type="text" placeholder="Ex: CDB, Tesouro, Ações" value={tipo} onChange={(e) => setTipo(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Valor investido</label><div style={iw}>{dollarIcon}<input type="number" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} style={is} /></div></div>
          <button type="submit" disabled={submitting} style={btnBlue}>{submitting ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingId(null) }} title="Editar Investimento">
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div><label style={ls}>Instituição</label><div style={iw}>{bankIcon}<input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Tipo do investimento</label><div style={iw}>{typeIcon}<input type="text" value={editTipo} onChange={(e) => setEditTipo(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Valor investido</label><div style={iw}>{dollarIcon}<input type="number" value={editValor} onChange={(e) => setEditValor(e.target.value)} style={is} /></div></div>
          <button type="submit" disabled={submitting} style={btnBlue}>{submitting ? 'Atualizando...' : 'Atualizar'}</button>
          <button type="button" onClick={handleDelete} style={{ width: '100%', padding: '12px 0', border: 'none', background: 'none', color: '#dc2626', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Excluir investimento
          </button>
        </form>
      </Modal>
    </PageContainer>
  )
}
