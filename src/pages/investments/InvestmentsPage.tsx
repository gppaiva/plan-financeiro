import { useEffect, useState, useMemo } from 'react'
import { Header } from '../../components/layout/Header'
import { PageContainer } from '../../components/layout/PageContainer'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useInvestmentsStore } from '../../stores/investments.store'
import { useAuthStore } from '../../stores/auth.store'
import { investmentAccountSchema, investmentTransactionSchema } from '../../schemas/investment.schema'
import { formatCurrency } from '../../lib/format'

export function InvestmentsPage() {
  const user = useAuthStore((s) => s.user)
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
    if (user) {
      fetchAccounts(user.id)
    }
  }, [user, fetchAccounts])

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
    if (!user) return

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
      await createAccount(user.id, parsed.data)
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

  return (
    <PageContainer>
      <Header title="Investimentos" />

      <div className="flex flex-col gap-4 p-4">
        {/* Total invested */}
        <Card className="bg-gradient-to-br from-blue to-blue/80 p-5">
          <p className="text-sm text-white/70">Total Investido</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {formatCurrency(totalInvested)}
          </p>
        </Card>

        {/* Add account button */}
        <Button onClick={() => setShowAccountModal(true)}>Nova Conta</Button>

        {/* Accounts list */}
        {loading ? (
          <p className="py-8 text-center text-sm text-text2">Carregando...</p>
        ) : accounts.length === 0 ? (
          <p className="py-8 text-center text-sm text-text2">
            Nenhuma conta de investimento
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <Card key={account.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: '#2563eb' }}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-text">
                        {account.nome}
                      </p>
                      <p className="text-xs text-text2">{account.tipo}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-text">
                    {formatCurrency(account.saldo_atual)}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openTxModal(account.id, 'aporte')}
                    className="flex-1 rounded-lg bg-green/10 py-2 text-xs font-medium text-green"
                  >
                    Depositar
                  </button>
                  <button
                    onClick={() => openTxModal(account.id, 'resgate')}
                    className="flex-1 rounded-lg bg-red/10 py-2 text-xs font-medium text-red"
                  >
                    Resgatar
                  </button>
                </div>
              </Card>
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
        <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
          <Input
            label="Nome"
            placeholder="Ex: Nubank"
            value={accountNome}
            onChange={setAccountNome}
          />
          <Input
            label="Tipo"
            placeholder="Ex: CDB, Ações, Tesouro"
            value={accountTipo}
            onChange={setAccountTipo}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2">Cor</label>
            <input
              type="color"
              value={accountCor}
              onChange={(e) => setAccountCor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-xl border border-border bg-bg2"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Criar Conta'}
          </Button>
        </form>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        title={txType === 'aporte' ? 'Depositar' : 'Resgatar'}
      >
        <form onSubmit={handleTransaction} className="flex flex-col gap-4">
          <Input
            label="Valor"
            type="number"
            placeholder="0,00"
            value={txValor}
            onChange={setTxValor}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: Aporte mensal"
            value={txDescricao}
            onChange={setTxDescricao}
          />
          <Input
            label="Data"
            type="date"
            value={txData}
            onChange={setTxData}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Processando...' : 'Confirmar'}
          </Button>
        </form>
      </Modal>
    </PageContainer>
  )
}
