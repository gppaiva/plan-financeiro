import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const stepIcons = [
    // Step 1 - User
    <svg key="s1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    // Step 2 - Calendar
    <svg key="s2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    // Step 3 - Dollar
    <svg key="s3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    // Step 4 - Check
    <svg key="s4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  ]

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
        minHeight: '100vh',
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
          Etapa {step} de 4
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
        {/* Step content */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Dados pessoais
            </h2>

            <div>
              <label style={labelStyle}>Nome</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={step1.nome || ''}
                  onChange={(e) => setStepData(1, { ...step1, nome: e.target.value })}
                  style={inputStyle}
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>E-mail</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={step1.email || user?.email || ''}
                  onChange={(e) => setStepData(1, { ...step1, email: e.target.value })}
                  style={inputStyle}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Telefone</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={step1.telefone || ''}
                  onChange={(e) => setStepData(1, { ...step1, telefone: e.target.value })}
                  style={inputStyle}
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Ciclo de pagamento
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Como você recebe seu salário?
            </p>

            <button
              type="button"
              onClick={() => setStepData(2, { ciclo: 'quinzenal' })}
              style={{
                borderRadius: 16,
                border: step2.ciclo === 'quinzenal' ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                background: step2.ciclo === 'quinzenal' ? 'rgba(37,99,235,0.04)' : '#fff',
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
              onClick={() => setStepData(2, { ciclo: 'mensal' })}
              style={{
                borderRadius: 16,
                border: step2.ciclo === 'mensal' ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                background: step2.ciclo === 'mensal' ? 'rgba(37,99,235,0.04)' : '#fff',
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

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Renda
            </h2>

            <div>
              <label style={labelStyle}>Salário bruto</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <input
                  type="number"
                  placeholder="0,00"
                  value={step3.salario_bruto || ''}
                  onChange={(e) => setStepData(3, { ...step3, salario_bruto: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Salário líquido</label>
              <div style={inputWrapStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <input
                  type="number"
                  placeholder="0,00"
                  value={step3.salario_liquido || ''}
                  onChange={(e) => setStepData(3, { ...step3, salario_liquido: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {step2.ciclo === 'quinzenal' && (
              <>
                <div>
                  <label style={labelStyle}>Valor quinzena 1 (dia 15)</label>
                  <div style={inputWrapStyle}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={step3.quinzena1 || ''}
                      onChange={(e) => setStepData(3, { ...step3, quinzena1: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Valor quinzena 2 (último dia útil)</label>
                  <div style={inputWrapStyle}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={step3.quinzena2 || ''}
                      onChange={(e) => setStepData(3, { ...step3, quinzena2: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
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
          {step < 4 ? (
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
