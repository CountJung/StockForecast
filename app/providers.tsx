'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

type ColorMode = 'light' | 'dark'

type ColorModeContextType = {
  mode: ColorMode
  toggle: () => void
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: 'light',
  toggle: () => {}
})

export function useColorMode() {
  return useContext(ColorModeContext)
}

const STORAGE_KEY = 'sf-color-mode'

function readStoredMode(): ColorMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return null
}

function detectSystemMode(): ColorMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function Providers({ children }: { children: React.ReactNode }) {
  // SSR에서는 항상 'light'로 렌더하여 hydration 일치시킴
  const [mode, setMode] = useState<ColorMode>('light')
  const [mounted, setMounted] = useState(false)

  // 마운트 시 실제 모드 적용 (localStorage > 시스템)
  useEffect(() => {
    const stored = readStoredMode()
    const actual = stored ?? detectSystemMode()
    setMode(actual)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {}
  }, [mode, mounted])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const stored = readStoredMode()
      if (!stored) setMode(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggle = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'))

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: '#0B5FFF' },
          ...(mode === 'light'
            ? { background: { default: '#F3F6FB' } }
            : { background: { default: '#121212', paper: '#1e1e1e' } })
        },
        shape: { borderRadius: 14 }
      }),
    [mode]
  )

  const value = useMemo(() => ({ mode, toggle }), [mode])

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* 마운트 전에는 콘텐츠를 숨겨서 테마 전환 깜빡임 방지 */}
        <div style={{ visibility: mounted ? 'visible' : 'hidden' }}>
          {children}
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
