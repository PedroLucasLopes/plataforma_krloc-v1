import {
  darkColors,

  lightColors,

  type ThemeColors,
  typography,
} from '@pedrolucaslopes/dotlog-ui'

export type ResolvedTheme = 'light' | 'dark'

export const COLORS: Readonly<Record<ResolvedTheme, ThemeColors>> = {
  light: lightColors,
  dark: darkColors,
}

export const BACKGROUND: Readonly<Record<ResolvedTheme, string>> = {
  light: lightColors.background,
  dark: darkColors.background,
}

export const SURFACE: Readonly<Record<ResolvedTheme, string>> = {
  light: lightColors.surface,
  dark: darkColors.surface,
}

export const FONTS = {
  body: typography.fontFamily,
  mono: typography.fontFamilyMono,
  size: typography.size,
  weight: typography.weight,
  lineHeight: typography.lineHeight,
} as const

export type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info'

export const toneColor = (tone: Tone, theme: ResolvedTheme): string => COLORS[theme][tone]

export { breakpoints as BREAKPOINTS, elevation as ELEVATION, motion as MOTION, radius as RADIUS, spacing as SPACING } from '@pedrolucaslopes/dotlog-ui'
