import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { MonthYearSelector } from '../../components/ui/MonthYearSelector'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useThirdPartyStore } from '../../stores/third-party.store'
import { useProfile } from '../../hooks/useProfile'
import { thirdPartyExpenseSchema } from '../../schemas/third-party.schema'
import { formatCurrency, formatDate } from '../../lib/format'
import type { ThirdPartyExpense } from '../../types'

export function ThirdPartyPage() {
  const { profileId } = useProfile()
  const { expenses, loading, fetchExpenses, addExpense, updateExpense, toggleStatus, removeExpense } =
    useThirdPartyStore()
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Month/Year selector
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const handleMonthChange = useCallback((month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }, [])

  // Add form state
  const [pessoa, setPessoa] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0])

  // Edit form state
  const [editPessoa, setEditPessoa] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editDataVencimento, setEditDataVencimento] = useState('')

  useEffect(() => {
    if (profileId) { fetchExpenses(profileId, { month: selectedMonth, year: selectedYear }) }
  }, [profileId, selectedMonth, selectedYear, fetchExpenses])

  const groupedByPerson = useMemo(() => {
    const groups = new Map<string, ThirdPartyExpense[]>()
    for (const expense of expenses) {
      const list = groups.get(expense.pessoa) || []
      list.push(expense)
      groups.set(expense.pessoa, list)
    }
    return groups
  }, [expenses])

  const grandTotal = useMemo(() => expenses.reduce((sum, e) => sum + e.valor, 0), [expenses])

  const openEditModal = useCallback((expense: ThirdPartyExpense) => {
    setEditingId(expense.id)
    setEditPessoa(expense.pessoa)
    setEditDescricao(expense.descricao)
    setEditValor(String(expense.valor))
    setEditDataVencimento(expense.data_vencimento)
    setShowEditModal(true)
  }, [])

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSubmitting(true)
    try {
      await updateExpense(editingId, {
        pessoa: editPessoa,
        descricao: editDescricao,
        valor: parseFloat(editValor) || 0,
        data_vencimento: editDataVencimento,
        status: 'pending',
      })
      showToast('Despesa atualizada!', 'success')
      setShowEditModal(false)
      setEditingId(null)
    } catch { showToast('Erro ao atualizar', 'error') }
    finally { setSubmitting(false) }
  }

  const handleDeleteFromEdit = async () => {
    if (!editingId) return
    if (!window.confirm('Tem certeza que deseja excluir esta despesa?')) return
    try {
      await removeExpense(editingId)
      showToast('Despesa excluída', 'success')
      setShowEditModal(false)
      setEditingId(null)
    } catch { showToast('Erro ao excluir', 'error') }
  }

  const resetForm = () => { setPessoa(''); setDescricao(''); setValor(''); setDataVencimento(new Date().toISOString().split('T')[0]) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return
    const parsed = thirdPartyExpenseSchema.safeParse({ pessoa, descricao, valor: parseFloat(valor) || 0, data_vencimento: dataVencimento, status: 'pending' as const })
    if (!parsed.success) { showToast(parsed.error.issues[0].message, 'error'); return }
    setSubmitting(true)
    try {
      await addExpense(profileId, parsed.data)
      showToast('Despesa adicionada!', 'success')
      setShowModal(false)
      resetForm()
    } catch { showToast('Erro ao adicionar', 'error') }
    finally { setSubmitting(false) }
  }

  const handleToggle = async (id: string) => {
    try { await toggleStatus(id) } catch { showToast('Erro ao atualizar status', 'error') }
  }

  const iw: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', background: 'var(--card-bg)' }
  const is: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)', background: 'transparent', width: '100%' }
  const ls: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }
  const btnBlue: React.CSSProperties = { width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }

  const personIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  const editIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  const dollarIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  const calIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>

  return (
    <PageContainer>
      <Header title="Terceiros" />
      <MonthYearSelector month={selectedMonth} year={selectedYear} onChange={handleMonthChange} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar
        </button>

        {grandTotal > 0 && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>Total com Terceiros</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#ea580c', margin: '6px 0 0' }}>{formatCurrency(grandTotal)}</p>
          </div>
        )}

        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>Carregando...</p>
        ) : groupedByPerson.size === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>Nenhuma despesa com terceiros</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from(groupedByPerson.entries()).map(([personName, items]) => {
              const personTotal = items.reduce((sum, e) => sum + e.valor, 0)
              return (
                <div key={personName} style={{ background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#2563eb' }}>
                        {personName.charAt(0).toUpperCase()}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{personName}</p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(personTotal)}</span>
                  </div>
                  {items.map((expense) => (
                    <div
                      key={expense.id}
                      onClick={() => openEditModal(expense)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <div>
                        <p style={{ fontSize: 14, color: 'var(--text)', margin: 0 }}>{expense.descricao}</p>
                        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>{formatDate(expense.data_vencimento)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{formatCurrency(expense.valor)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggle(expense.id) }}
                          style={{ borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: expense.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'rgba(234,88,12,0.1)', color: expense.status === 'paid' ? '#16a34a' : '#ea580c' }}
                        >
                          {expense.status === 'paid' ? 'Desfazer' : 'Pagar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingId(null) }} title="Editar Despesa">
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div><label style={ls}>Nome da pessoa</label><div style={iw}>{personIcon}<input type="text" value={editPessoa} onChange={(e) => setEditPessoa(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Descrição</label><div style={iw}>{editIcon}<input type="text" value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Valor</label><div style={iw}>{dollarIcon}<input type="number" value={editValor} onChange={(e) => setEditValor(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Data de vencimento</label><div style={iw}>{calIcon}<input type="date" value={editDataVencimento} onChange={(e) => setEditDataVencimento(e.target.value)} style={is} /></div></div>
          <button type="submit" disabled={submitting} style={btnBlue}>{submitting ? 'Atualizando...' : 'Atualizar'}</button>
          <button type="button" onClick={handleDeleteFromEdit} style={{ width: '100%', padding: '12px 0', border: 'none', background: 'none', color: '#dc2626', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Excluir despesa
          </button>
        </form>
      </Modal>

      {/* Add Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Despesa com Terceiro">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div><label style={ls}>Nome da pessoa</label><div style={iw}>{personIcon}<input type="text" placeholder="Ex: João" value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Descrição</label><div style={iw}>{editIcon}<input type="text" placeholder="Ex: Almoço" value={descricao} onChange={(e) => setDescricao(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Valor</label><div style={iw}>{dollarIcon}<input type="number" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} style={is} /></div></div>
          <div><label style={ls}>Data de vencimento</label><div style={iw}>{calIcon}<input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} style={is} /></div></div>
          <button type="submit" disabled={submitting} style={btnBlue}>{submitting ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </Modal>
    </PageContainer>
  )
}
