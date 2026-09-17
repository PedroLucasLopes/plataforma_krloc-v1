import { type ThemeMode, useThemePreferences } from '@pedrolucaslopes/dotlog-ui'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { NAV_COLLAPSED_STORAGE_KEY } from '@/constants/layout'

function readFlag (): boolean {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeFlag (value: boolean): void {
  try {
    window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* Conveniencia, nao requisito: sem armazenamento o menu so nao lembra. */
  }
}

/**
 * Preferencias de interface desta pessoa neste navegador.
 *
 * O tema vem de `useThemePreferences`, da biblioteca, que ja resolve os tres
 * estados e le o armazenamento de forma sincrona no boot, sem piscar claro
 * antes do escuro. Este store so o expoe junto do resto da aplicacao.
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const theme = useThemePreferences()
  const navCollapsed = ref(readFlag())

  watch(navCollapsed, writeFlag)

  function setThemeMode (mode: ThemeMode): void {
    theme.setMode(mode)
  }

  return {
    themeMode: theme.mode,
    resolvedTheme: theme.resolved,
    isDark: theme.isDark,
    navCollapsed,
    setThemeMode,
  }
})
