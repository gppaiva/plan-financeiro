import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useOnboardingStore } from '../../stores/onboarding.store'
import { useAuthStore } from '../../stores/auth.store'
import { createProfile } from '../../services/profile.service'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const user = useAuthStore((s) => s.user)
  const { step, data, nextStep, prevStep, setStepData } = useOnboardingStore()
  const [loading, setLoading] = useState(false)

  const step1 = data.step1 as { nome?: string; email?: string; telefone?: string }
  const step2 = data.step2 as { ciclo?: string }
  const step3 = data.step3 as {
    salario_bruto?: string
    salario_liquido?: string
    quinzena1?: string
    quinzena2?: string
  }

  const handleNext = () => {
    if (step === 1) {
      if (!step1.nome?.trim()) {
        showToast('Nome é obrigatório', 'error')
        return
      }
    }
    nextStep()
  }

  const handleFinish = async () => {
    if (!user) return
    setLoading(true)

    try {
      const salarioLiquido = parseFloat(step3.salario_liquido || '0') || 0
      const q1 = parseFloat(step3.quinzena1 || '0') || 0
      const q2 = parseFloat(step3.quinzena2 || '0') || 0

      await createProfile(user.id, {
        nome: step1.nome || user.user_metadata?.nome || '',
        email: step1.email || user.email || '',
        salario_liquido: salarioLiquido,
        dia_pagamento_1: q1 > 0 ? 15 : 15,
        dia_pagamento_2: q2 > 0 ? 30 : 30,
      })

      showToast('Perfil criado com sucesso!', 'success')
      navigate('/dashboard')
    } catch {
      showToast('Erro ao salvar perfil. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = (step / 4) * 100

  return (
    <div className="flex min-h-screen flex-col bg-bg p-6">
      <div className="mx-auto w-full max-w-sm">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text">Configuração inicial</h1>
          <p className="mt-1 text-sm text-text2">Etapa {step} de 4</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-bg2">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step content */}
        <div className="flex flex-col gap-4">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-text">Dados pessoais</h2>
              <Input
                label="Nome"
                placeholder="Seu nome completo"
                value={step1.nome || ''}
                onChange={(v) => setStepData(1, { ...step1, nome: v })}
              />
              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={step1.email || user?.email || ''}
                onChange={(v) => setStepData(1, { ...step1, email: v })}
              />
              <Input
                label="Telefone"
                placeholder="(11) 99999-9999"
                value={step1.telefone || ''}
                onChange={(v) => setStepData(1, { ...step1, telefone: v })}
              />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-text">Ciclo de pagamento</h2>
              <p className="text-sm text-text2">
                Como você recebe seu salário?
              </p>
              <div className="flex flex-col gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setStepData(2, { ciclo: 'quinzenal' })}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    step2.ciclo === 'quinzenal'
                      ? 'border-primary bg-primary/5 text-text'
                      : 'border-border bg-bg2 text-text2'
                  }`}
                >
                  <span className="font-medium">Quinzenal</span>
                  <p className="mt-1 text-xs opacity-70">
                    Recebo no dia 15 e no último dia útil
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setStepData(2, { ciclo: 'mensal' })}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    step2.ciclo === 'mensal'
                      ? 'border-primary bg-primary/5 text-text'
                      : 'border-border bg-bg2 text-text2'
                  }`}
                >
                  <span className="font-medium">Mensal</span>
                  <p className="mt-1 text-xs opacity-70">
                    Recebo uma vez por mês
                  </p>
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-text">Renda</h2>
              <Input
                label="Salário bruto"
                type="number"
                placeholder="0,00"
                value={step3.salario_bruto || ''}
                onChange={(v) => setStepData(3, { ...step3, salario_bruto: v })}
              />
              <Input
                label="Salário líquido"
                type="number"
                placeholder="0,00"
                value={step3.salario_liquido || ''}
                onChange={(v) => setStepData(3, { ...step3, salario_liquido: v })}
              />
              {step2.ciclo === 'quinzenal' && (
                <>
                  <Input
                    label="Valor quinzena 1 (dia 15)"
                    type="number"
                    placeholder="0,00"
                    value={step3.quinzena1 || ''}
                    onChange={(v) => setStepData(3, { ...step3, quinzena1: v })}
                  />
                  <Input
                    label="Valor quinzena 2 (último dia útil)"
                    type="number"
                    placeholder="0,00"
                    value={step3.quinzena2 || ''}
                    onChange={(v) => setStepData(3, { ...step3, quinzena2: v })}
                  />
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold text-text">Rendimentos extras</h2>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mb-4 text-text2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <p className="text-sm text-text2">
                  Você poderá adicionar rendimentos extras depois no dashboard.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <Button variant="secondary" onClick={prevStep}>
              Voltar
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={handleNext}>Avançar</Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading}>
              {loading ? 'Salvando...' : 'Finalizar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
