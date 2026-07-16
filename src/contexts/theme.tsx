import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './auth'
import { getSettings, saveSettings } from '@/services/settings-service'

export const LightColors = {
  text: '#000000',
  background: '#ffffff',
  backgroundElement: '#F0F0F3',
  backgroundSelected: '#E0E1E6',
  textSecondary: '#60646C',
  primary: '#C4956A',
}

export const DarkColors = {
  text: '#F3F4F6',
  background: '#0F0F0F',
  backgroundElement: '#1C1C1E',
  backgroundSelected: '#2C2C2E',
  textSecondary: '#9CA3AF',
  primary: '#C4956A',
}

type Colors = typeof LightColors

type ThemeContextType = {
  colors: Colors
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (t: 'light' | 'dark') => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const companyId = user?.uid ?? ''
  const [theme, setThemeState] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (!companyId) return
    getSettings(companyId).then((s) => {
      setThemeState(s.theme)
    }).catch(() => {})
  }, [companyId])

  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t)
    if (companyId) {
      getSettings(companyId).then((s) => {
        saveSettings(companyId, { ...s, theme: t })
      }).catch(() => {})
    }
  }, [companyId])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  const colors = theme === 'dark' ? DarkColors : LightColors

  return (
    <ThemeContext.Provider value={{ colors, theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider')
  return ctx
}
