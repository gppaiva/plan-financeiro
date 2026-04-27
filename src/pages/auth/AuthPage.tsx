import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../../services/auth.service'
import { hasCompletedOnboarding } from '../../services/profile.service'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password)
        if (result.error) {
          showToast('E-mail ou senha inválidos', 'error')
          return
        }
        if (result.user) {
          const completed = await hasCompletedOnboarding(result.user.id)
          navigate(completed ? '/dashboard' : '/onboarding')
        }
      } else {
        if (!name.trim()) {
          showToast('Nome é obrigatório', 'error')
          return
        }
        const result = await signUpWithEmail(name, email, password)
        if (result.error) {
          showToast(result.error, 'error')
          return
        }
        showToast('Conta criada com sucesso!', 'success')
        navigate('/onboarding')
      }
    } catch {
      showToast('Erro ao processar. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch {
      showToast('Erro ao entrar com Google', 'error')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
            <span className="text-3xl font-bold text-primary-fg">P</span>
          </div>
          <h1 className="text-2xl font-bold text-text">Plan. Financeiro</h1>
          <p className="mt-1 text-sm text-text2">
            {mode === 'login'
              ? 'Entre na sua conta'
              : 'Crie sua conta'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <Input
              label="Nome"
              placeholder="Seu nome completo"
              value={name}
              onChange={setName}
              autoComplete="name"
            />
          )}
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          <Button type="submit" disabled={loading}>
            {loading
              ? 'Carregando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-text2">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google */}
        <Button variant="secondary" onClick={handleGoogleSignIn}>
          <span className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </span>
        </Button>

        {/* Toggle mode */}
        <p className="mt-6 text-center text-sm text-text2">
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-medium text-primary underline"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-medium text-primary underline"
              >
                Entrar
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
