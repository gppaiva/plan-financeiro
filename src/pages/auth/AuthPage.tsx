import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../../services/auth.service'
import { hasCompletedOnboarding } from '../../services/profile.service'

type AuthMode = 'login' | 'register'

const inputWrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', background: '#fff' }
const inputField: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1e293b', background: 'transparent' }
const label: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500, color: '#1e293b', marginBottom: 8 }

function EyeOpen() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeClosed() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }

export function AuthPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password)
        if (result.error) { showToast('E-mail ou senha inválidos', 'error'); return }
        if (result.user) {
          const completed = await hasCompletedOnboarding(result.user.id)
          navigate(completed ? '/dashboard' : '/onboarding')
        }
      } else {
        if (!name.trim()) { showToast('Nome é obrigatório', 'error'); return }
        if (!phone.trim()) { showToast('Telefone é obrigatório', 'error'); return }
        if (!username.trim()) { showToast('Nome de usuário é obrigatório', 'error'); return }
        if (password.length < 6) { showToast('Senha deve ter pelo menos 6 caracteres', 'error'); return }
        if (password !== confirmPassword) { showToast('As senhas não coincidem', 'error'); return }
        const result = await signUpWithEmail(name, email, password)
        if (result.error) { showToast(result.error, 'error'); return }
        showToast('Conta criada com sucesso!', 'success')
        navigate('/onboarding')
      }
    } catch { showToast('Erro ao processar. Tente novamente.', 'error') }
    finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    try { await signInWithGoogle() }
    catch { showToast('Erro ao entrar com Google', 'error') }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #dbeafe 0%, #eff6ff 40%, #eff6ff 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Logo */}
      <div style={{ paddingTop: 60, paddingBottom: 24, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>P</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Plan. Financeiro</h1>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</p>
      </div>

      {/* Card */}
      <div style={{ flex: 1, width: '100%', maxWidth: 430, background: '#fff', borderRadius: '28px 28px 0 0', padding: '28px 24px 40px', boxShadow: '0 -4px 30px rgba(0,0,0,0.06)', overflowY: 'auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 28 }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: mode === m ? '#2563eb' : 'transparent', color: mode === m ? '#fff' : '#94a3b8', boxShadow: mode === m ? '0 2px 8px rgba(37,99,235,0.25)' : 'none' }}>
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Nome Completo (register) */}
          {mode === 'register' && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Nome Completo</label>
              <div style={inputWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} style={inputField} autoComplete="name" />
              </div>
            </div>
          )}

          {/* E-mail */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>E-mail</label>
            <div style={inputWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={inputField} autoComplete="email" />
            </div>
          </div>

          {/* Telefone (register) */}
          {mode === 'register' && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Telefone</label>
              <div style={inputWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <input type="tel" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputField} autoComplete="tel" />
              </div>
            </div>
          )}

          {/* Nome de Usuário (register) */}
          {mode === 'register' && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Nome de Usuário</label>
              <div style={inputWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" placeholder="usuario123" value={username} onChange={(e) => setUsername(e.target.value)} style={inputField} autoComplete="username" />
              </div>
            </div>
          )}

          {/* Senha */}
          <div style={{ marginBottom: mode === 'register' ? 18 : 28 }}>
            <label style={label}>Senha</label>
            <div style={inputWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={inputField} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>{showPw ? <EyeClosed /> : <EyeOpen />}</button>
            </div>
          </div>

          {/* Confirmar Senha (register) */}
          {mode === 'register' && (
            <div style={{ marginBottom: 28 }}>
              <label style={label}>Confirmar Senha</label>
              <div style={inputWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type={showCpw ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputField} autoComplete="new-password" />
                <button type="button" onClick={() => setShowCpw(!showCpw)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>{showCpw ? <EyeClosed /> : <EyeOpen />}</button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            {loading ? 'Carregando...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>ou</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        {/* Google */}
        <button type="button" onClick={handleGoogle} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 15, fontWeight: 500, color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {mode === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 32 }}>
          Ao continuar, você concorda com nossos Termos de Uso
        </p>
      </div>
    </div>
  )
}
