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

function writeFlag (value: boolean): boolean {
  try {
    window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, value ? '1' : '0')

    return true
  } catch {
    return false
  }
}

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
