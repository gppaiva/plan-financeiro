import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'
import { useOnboardingStore } from '../../stores/onboarding.store'
import { useAuthStore } from '../../stores/auth.store'
import { createProfile } from '../../services/profile.service'
import { parseCurrency, formatCurrencyInput } from '../../lib/format'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const user = useAuthStore((s) => s.user)
  const { step, data, nextStep, prevStep, setStepData } = useOnboardingStore()
  const [loading, setLoading] = useState(false)

  // Step 1 = Ciclo de pagamento (was step 2)
  const step1 = data.step1 as { ciclo?: string }
  // Step 2 = Renda (was step 3)
  const step2 = data.step2 as {
    salario_bruto?: number
    salario_bruto_display?: string
    salario_liquido?: number
    salario_liquido_display?: string
    quinzena1?: number
    quinzena1_display?: string
    quinzena2?: number
    quinzena2_display?: string
  }
  // Step 3 = Rendimentos extras (was step 4)

  const handleNext = () => {
    nextStep()
  }

  const handleFinish = async () => {
    if (!user) return
    setLoading(true)

    try {
      const salarioLiquido = step2.salario_liquido || 0
      const q1 = step2.quinzena1 || 0
      const q2 = step2.quinzena2 || 0

      await createProfile(user.id, {
        nome: user.user_metadata?.nome || user.user_metadata?.full_name || '',
        email: user.email || '',
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

  const progressPercent = (step / 3) * 100

  const totalSteps = 3

  const stepIcons = [
    // Step 1 - Calendar (payment cycle)
    <svg key="s1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    // Step 2 - Dollar (salary)
    <svg key="s2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    // Step 3 - Check (extras / finish)
    <svg key="s3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  ]

  // Currency input handler: user types freely, we parse on change and format on blur
  const handleCurrencyChange = (
    stepNum: number,
    field: string,
    displayField: string,
    rawValue: string,
  ) => {
    const currentStepData = stepNum === 2 ? step2 : {}
    setStepData(stepNum, {
      ...currentStepData,
      [displayField]: rawValue,
      [field]: parseCurrency(rawValue),
    })
  }

  const handleCurrencyBlur = (
    stepNum: number,
    field: string,
    displayField: string,
  ) => {
    const currentStepData = stepNum === 2 ? step2 : {}
    const numericValue = (currentStepData as Record<string, unknown>)[field] as number || 0
    setStepData(stepNum, {
      ...currentStepData,
      [displayField]: formatCurrencyInput(numericValue),
    })
  }

  // Shared input style
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
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#1e293b',
    marginBottom: 8,
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #dbeafe 0%, #eff6ff 40%, #eff6ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Top area */}
      <div style={{ paddingTop: 48, paddingBottom: 20, textAlign: 'center', width: '100%', maxWidth: 430, padding: '48px 24px 20px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          {stepIcons[step - 1]}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Configuração inicial
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Etapa {step} de {totalSteps}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 430, padding: '0 24px', marginBottom: 20 }}>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              background: '#2563eb',
              width: `${progressPercent}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* White card */}
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 430,
          background: '#fff',
          borderRadius: '28px 28px 0 0',
          padding: '28px 24px 40px',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.06)',
        }}
      >
        {/* Step 1: Ciclo de pagamento */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Ciclo de pagamento
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Como você recebe seu salário?
            </p>

            <button
              type="button"
              onClick={() => setStepData(1, { ciclo: 'quinzenal' })}
              style={{
                borderRadius: 16,
                border: step1.ciclo === 'quinzenal' ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                background: step1.ciclo === 'quinzenal' ? 'rgba(37,99,235,0.04)' : '#fff',
                padding: 18,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>Quinzenal</span>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: '4px 0 0' }}>
                Recebo no dia 15 e no último dia útil
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStepData(1, { ciclo: 'mensal' })}
              style={{
                borderRadius: 16,
                border: step1.ciclo === 'mensal' ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                background: step1.ciclo === 'mensal' ? 'rgba(37,99,235,0.04)' : '#fff',
                padding: 18,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>Mensal</span>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: '4px 0 0' }}>
                Recebo uma vez por mês
              </p>
            </button>
          </div>
        )}

        {/* Step 2: Renda (with currency mask) */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Renda
            </h2>

            <div>
              <label style={labelStyle}>Salário bruto</label>
              <div style={inputWrapStyle}>
                <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={step2.salario_bruto_display ?? formatCurrencyInput(step2.salario_bruto || 0)}
                  onChange={(e) =>
                    handleCurrencyChange(2, 'salario_bruto', 'salario_bruto_display', e.target.value)
                  }
                  onBlur={() => handleCurrencyBlur(2, 'salario_bruto', 'salario_bruto_display')}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Salário líquido</label>
              <div style={inputWrapStyle}>
                <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={step2.salario_liquido_display ?? formatCurrencyInput(step2.salario_liquido || 0)}
                  onChange={(e) =>
                    handleCurrencyChange(2, 'salario_liquido', 'salario_liquido_display', e.target.value)
                  }
                  onBlur={() => handleCurrencyBlur(2, 'salario_liquido', 'salario_liquido_display')}
                  style={inputStyle}
                />
              </div>
            </div>

            {step1.ciclo === 'quinzenal' && (
              <>
                <div>
                  <label style={labelStyle}>Valor quinzena 1 (dia 15)</label>
                  <div style={inputWrapStyle}>
                    <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={step2.quinzena1_display ?? formatCurrencyInput(step2.quinzena1 || 0)}
                      onChange={(e) =>
                        handleCurrencyChange(2, 'quinzena1', 'quinzena1_display', e.target.value)
                      }
                      onBlur={() => handleCurrencyBlur(2, 'quinzena1', 'quinzena1_display')}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Valor quinzena 2 (último dia útil)</label>
                  <div style={inputWrapStyle}>
                    <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={step2.quinzena2_display ?? formatCurrencyInput(step2.quinzena2 || 0)}
                      onChange={(e) =>
                        handleCurrencyChange(2, 'quinzena2', 'quinzena2_display', e.target.value)
                      }
                      onBlur={() => handleCurrencyBlur(2, 'quinzena2', 'quinzena2_display')}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Rendimentos extras */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Rendimentos extras
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Você poderá adicionar rendimentos extras depois no dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          {step > 1 && (
            <button
              onClick={prevStep}
              style={{
                flex: 1,
                padding: '16px 0',
                borderRadius: 14,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                color: '#334155',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          )}
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              style={{
                flex: 1,
                padding: '16px 0',
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
              Avançar
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              style={{
                flex: 1,
                padding: '16px 0',
                borderRadius: 14,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              }}
            >
              {loading ? 'Salvando...' : 'Finalizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
