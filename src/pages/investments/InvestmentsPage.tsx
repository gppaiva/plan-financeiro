import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useInvestmentsStore } from '../../stores/investments.store'
import { useProfile } from '../../hooks/useProfile'
import { investmentAccountSchema, investmentTransactionSchema } from '../../schemas/investment.schema'
import { formatCurrency } from '../../lib/format'

export function InvestmentsPage() {
  const { profileId } = useProfile()
  const { accounts, loading, fetchAccounts, createAccount, addDeposit, addWithdrawal } =
    useInvestmentsStore()
  const { showToast } = useToast()

  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [txType, setTxType] = useState<'aporte' | 'resgate'>('aporte')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Account form
  const [accountNome, setAccountNome] = useState('')
  const [accountTipo, setAccountTipo] = useState('')
  const [accountCor, setAccountCor] = useState('#2563eb')

  // Transaction form
  const [txValor, setTxValor] = useState('')
  const [txDescricao, setTxDescricao] = useState('')
  const [txData, setTxData] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (profileId) {
      fetchAccounts(profileId)
    }
  }, [profileId, fetchAccounts])

  const totalInvested = useMemo(
    () => accounts.reduce((sum, a) => sum + a.saldo_atual, 0),
    [accounts],
  )

  const resetAccountForm = () => {
    setAccountNome('')
    setAccountTipo('')
    setAccountCor('#2563eb')
  }

  const resetTxForm = () => {
    setTxValor('')
    setTxDescricao('')
    setTxData(new Date().toISOString().split('T')[0])
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return

    const parsed = investmentAccountSchema.safeParse({
      nome: accountNome,
      tipo: accountTipo,
      cor: accountCor || undefined,
    })

    if (!parsed.success) {
      showToast(parsed.error.issues[0].message, 'error')
      return
    }

    setSubmitting(true)
    try {
      await createAccount(profileId, parsed.data)
      showToast('Conta criada!', 'success')
      setShowAccountModal(false)
      resetAccountForm()
    } catch {
      showToast('Erro ao criar conta', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openTxModal = (accountId: string, type: 'aporte' | 'resgate') => {
    setSelectedAccountId(accountId)
    setTxType(type)
    resetTxForm()
    setShowTxModal(true)
  }

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccountId) return

    const parsed = investmentTransactionSchema.safeParse({
      conta_id: selectedAccountId,
      descricao: txDescricao || undefined,
      valor: parseFloat(txValor) || 0,
      tipo: txType,
      data: txData,
    })

    if (!parsed.success) {
      showToast(parsed.error.issues[0].message, 'error')
      return
    }

    setSubmitting(true)
    try {
      if (txType === 'aporte') {
        await addDeposit(parsed.data)
      } else {
        await addWithdrawal(parsed.data)
      }
      showToast(
        txType === 'aporte' ? 'Depósito realizado!' : 'Resgate realizado!',
        'success',
      )
      setShowTxModal(false)
      resetTxForm()
    } catch {
      showToast('Erro ao processar transação', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    padding: '14px 16px',
    background: '#fff',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 15,
    color: '#1e293b',
    background: 'transparent',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#1e293b',
    marginBottom: 8,
  }

  return (
    <PageContainer>
      <Header title="Investimentos" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
        {/* Total invested */}
        <div
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: 20,
            padding: 24,
            color: '#fff',
          }}
        >
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Total Investido</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>
            {formatCurrency(totalInvested)}
          </p>
        </div>

        {/* Add account button */}
        <button
          onClick={() => setShowAccountModal(true)}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Conta
        </button>

        {/* Accounts list */}
        {loading ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
            Carregando...
          </p>
        ) : accounts.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
            Nenhuma conta de investimento
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {accounts.map((account) => (
              <div
                key={account.id}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', margin: 0 }}>
                        {account.nome}
                      </p>
                      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, margin: '2px 0 0' }}>
                        {account.tipo}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    {formatCurrency(account.saldo_atual)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => openTxModal(account.id, 'aporte')}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 13,
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'rgba(22,163,74,0.1)',
                      color: '#16a34a',
                    }}
                  >
                    Depositar
                  </button>
                  <button
                    onClick={() => openTxModal(account.id, 'resgate')}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 13,
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'rgba(220,38,38,0.1)',
                      color: '#dc2626',
                    }}
                  >
                    Resgatar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title="Nova Conta"
      >
        <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              <input
                type="text"
                placeholder="Ex: Nubank"
                value={accountNome}
                onChange={(e) => setAccountNome(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <input
                type="text"
                placeholder="Ex: CDB, Ações, Tesouro"
                value={accountTipo}
                onChange={(e) => setAccountTipo(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Cor</label>
            <input
              type="color"
              value={accountCor}
              onChange={(e) => setAccountCor(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 14,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                cursor: 'pointer',
                padding: 4,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {submitting ? 'Salvando...' : 'Criar Conta'}
          </button>
        </form>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        title={txType === 'aporte' ? 'Depositar' : 'Resgatar'}
      >
        <form onSubmit={handleTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Valor</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input
                type="number"
                placeholder="0,00"
                value={txValor}
                onChange={(e) => setTxValor(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Descrição (opcional)</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <input
                type="text"
                placeholder="Ex: Aporte mensal"
                value={txDescricao}
                onChange={(e) => setTxDescricao(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Data</label>
            <div style={inputWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input
                type="date"
                value={txData}
                onChange={(e) => setTxData(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {submitting ? 'Processando...' : 'Confirmar'}
          </button>
        </form>
      </Modal>
    </PageContainer>
  )
}
