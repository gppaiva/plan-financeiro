import { create } from 'zustand'

interface ThemeState {
  isDark: boolean
  toggle: () => void
  setTheme: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: false,
  toggle: () =>
    set((state) => {
      const newIsDark = !state.isDark
      document.documentElement.setAttribute(
        'data-theme',
        newIsDark ? 'dark' : 'light',
      )
      return { isDark: newIsDark }
    }),
  setTheme: (isDark: boolean) => {
    document.documentElement.setAttribute(
      'data-theme',
      isDark ? 'dark' : 'light',
    )
    set({ isDark })
  },
}))
