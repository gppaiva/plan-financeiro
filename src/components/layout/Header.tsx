import { useState } from 'react'
import { useThemeStore } from '../../stores/theme.store'
import { signOut } from '../../services/auth.service'
import { APP_VERSION } from '../../version'
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
} from '../../lib/biometric'
import logo from '../../assets/logoapenasNew.png'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const { isDark, toggle } = useThemeStore()
  const [showMenu, setShowMenu] = useState(false)
  const [biometricOn, setBiometricOn] = useState(() => isBiometricEnabled())

  const handleLogout = async () => {
    setShowMenu(false)
    try {
      await signOut()
    } catch {
      // Error handled by auth state listener
    }
  }

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
          padding: '14px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logo} alt="Plan Financeiro" style={{ width: 28, height: 'auto' }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {title}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--bg2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text2)',
            }}
            aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Settings gear */}
          <button
            onClick={() => setShowMenu(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--bg2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text2)',
            }}
            aria-label="Configurações"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Side menu overlay + drawer */}
      {showMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          {/* Overlay */}
          <div
            onClick={() => setShowMenu(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
            aria-hidden="true"
          />
          {/* Drawer from right */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 260,
              background: 'var(--card-bg)',
              boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 0',
            }}
          >
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 16px' }}>
              <button
                onClick={() => setShowMenu(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bg2)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text2)',
                }}
                aria-label="Fechar menu"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Menu items */}
            <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <button
                onClick={() => {
                  setShowMenu(false)
                  alert(`Plan Financeiro v${APP_VERSION}\n\nPlaneje hoje, conquiste amanhã.\n\nDesenvolvido por Gustavo Paiva`)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text)',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Sobre
              </button>

              {/* Biometric toggle — only show if device supports it */}
              {isBiometricAvailable() && (
                <button
                  onClick={async () => {
                    if (biometricOn) {
                      disableBiometric()
                      setBiometricOn(false)
                    } else {
                      const ok = await enableBiometric()
                      setBiometricOn(ok)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 20px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--text)',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.9 7a8 8 0 0 0-2.2-2.5" />
                    <path d="M3.9 12a8 8 0 0 1 1.2-4.3" />
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74A9 9 0 0 0 3 12" />
                    <path d="M12 12a3 3 0 0 0-3 3v1" />
                    <path d="M12 3a9 9 0 0 1 9 9" />
                    <path d="M12 7a5 5 0 0 1 5 5v1" />
                    <path d="M12 7a5 5 0 0 0-5 5v4" />
                    <path d="M9 18a3 3 0 0 0 6 0v-3" />
                  </svg>
                  {biometricOn ? 'Desativar biometria' : 'Ativar biometria'}
                </button>
              )}

              <div style={{ flex: 1 }} />

              <div style={{ height: 1, background: 'var(--border)', margin: '0 20px' }} />

              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#dc2626',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
