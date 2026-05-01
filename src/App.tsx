import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAuthStore } from './stores/auth.store'
import { onAuthStateChange, getSession, signOut } from './services/auth.service'
import { getProfile } from './services/profile.service'
import {
  isBiometricEnabled,
  authenticateBiometric,
} from './lib/biometric'
import lockLogo from './assets/logoapenasNew.png'

// Pages
import { AuthPage } from './pages/auth/AuthPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { TransactionsPage } from './pages/transactions/TransactionsPage'
import { ThirdPartyPage } from './pages/third-party/ThirdPartyPage'
import { InvestmentsPage } from './pages/investments/InvestmentsPage'
import { ReportsPage } from './pages/reports/ReportsPage'

function ProtectedRoute() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <span className="text-2xl font-bold text-primary-fg">P</span>
          </div>
          <p className="text-sm text-text2">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function AuthRoute() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <span className="text-2xl font-bold text-primary-fg">P</span>
          </div>
          <p className="text-sm text-text2">Carregando...</p>
        </div>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

function BiometricLockScreen({ onUnlock, onUsePassword }: { onUnlock: () => void; onUsePassword: () => void }) {
  const [attempting, setAttempting] = useState(false)

  const tryBiometric = useCallback(async () => {
    if (attempting) return
    setAttempting(true)
    try {
      const ok = await authenticateBiometric()
      if (ok) onUnlock()
    } finally {
      setAttempting(false)
    }
  }, [attempting, onUnlock])

  useEffect(() => {
    tryBiometric()
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <img src={lockLogo} alt="Plan Financeiro" style={{ width: 64, height: 'auto' }} />

      <p style={{ fontSize: 16, color: 'var(--text)', fontWeight: 500, textAlign: 'center' }}>
        Desbloqueie para continuar
      </p>

      {/* Fingerprint / retry button */}
      <button
        onClick={tryBiometric}
        disabled={attempting}
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--card-bg)',
          border: '2px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: attempting ? 'not-allowed' : 'pointer',
          opacity: attempting ? 0.5 : 1,
          color: 'var(--text2)',
        }}
        aria-label="Desbloquear com biometria"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.9 7a8 8 0 0 0-2.2-2.5" />
          <path d="M3.9 12a8 8 0 0 1 1.2-4.3" />
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74A9 9 0 0 0 3 12" />
          <path d="M12 12a3 3 0 0 0-3 3v1" />
          <path d="M12 3a9 9 0 0 1 9 9" />
          <path d="M12 7a5 5 0 0 1 5 5v1" />
          <path d="M12 7a5 5 0 0 0-5 5v4" />
          <path d="M9 18a3 3 0 0 0 6 0v-3" />
        </svg>
      </button>

      {/* Use password fallback */}
      <button
        onClick={onUsePassword}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text2)',
          fontSize: 14,
          cursor: 'pointer',
          padding: '8px 16px',
          marginTop: 16,
          textDecoration: 'underline',
        }}
      >
        Usar senha
      </button>
    </div>
  )
}

function AppContent() {
  const { setSession, setUser, setLoading } = useAuthStore()
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  const [biometricLocked, setBiometricLocked] = useState(false)

  useEffect(() => {
    // Check initial session
    getSession()
      .then(async (session) => {
        setSession(session)
        setUser(session?.user ?? null)

        // If session exists and biometric is enabled, lock the app
        if (session && isBiometricEnabled()) {
          setBiometricLocked(true)
        }

        // Load theme preference from profile
        if (session?.user) {
          try {
            await getProfile(session.user.id)
            // Theme is always dark by default — user can toggle via header
          } catch {
            // Ignore profile load errors for theme
          }
        }
      })
      .catch(() => {
        setSession(null)
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })

    // Listen for auth state changes
    const { unsubscribe } = onAuthStateChange((session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // If user logs out, clear stores and unlock
      if (!session) {
        setBiometricLocked(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [setSession, setUser, setLoading])

  const handleBiometricUnlock = useCallback(() => {
    setBiometricLocked(false)
  }, [])

  const handleUsePassword = useCallback(async () => {
    setBiometricLocked(false)
    try {
      await signOut()
    } catch {
      // Ignore sign out errors — auth listener will handle state
    }
  }, [])

  // Show lock screen when biometric locked
  if (!loading && session && biometricLocked) {
    return (
      <BiometricLockScreen
        onUnlock={handleBiometricUnlock}
        onUsePassword={handleUsePassword}
      />
    )
  }

  return (
    <Routes>
      {/* Auth routes - redirect to dashboard if already logged in */}
      <Route element={<AuthRoute />}>
        <Route path="/" element={<AuthPage />} />
      </Route>

      {/* Onboarding - protected but no tab bar */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Main app routes - protected with tab bar */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/third-party" element={<ThirdPartyPage />} />
        <Route path="/investments" element={<InvestmentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
