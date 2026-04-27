import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAuthStore } from './stores/auth.store'
import { useThemeStore } from './stores/theme.store'
import { onAuthStateChange, getSession } from './services/auth.service'
import { getProfile } from './services/profile.service'

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

function AppContent() {
  const { setSession, setUser, setLoading } = useAuthStore()
  const { setTheme } = useThemeStore()

  useEffect(() => {
    // Check initial session
    getSession()
      .then(async (session) => {
        setSession(session)
        setUser(session?.user ?? null)

        // Load theme preference from profile
        if (session?.user) {
          try {
            const profile = await getProfile(session.user.id)
            if (profile) {
              // Theme could be stored in profile; for now use system preference
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              setTheme(prefersDark)
            }
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

      // If user logs out, clear stores
      if (!session) {
        // Stores will be re-fetched on next login
      }
    })

    return () => {
      unsubscribe()
    }
  }, [setSession, setUser, setLoading, setTheme])

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
