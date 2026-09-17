/**
 * Estilo padrao do KRLoc, em constantes.
 *
 * Nenhum valor nasce aqui. Tudo sai dos tokens de `@pedrolucaslopes/dotlog-ui`, que ja passaram
 * pela conferencia de contraste, e este arquivo so os organiza para a
 * aplicacao: um lugar para olhar, e o que grafico e calculo em TypeScript
 * precisam, ja que eles nao enxergam variavel CSS.
 *
 * No template e no CSS, prefira a classe do tema (`bg-surface`) ou a variavel
 * (`var(--dl-surface)`): elas trocam sozinhas com o tema.
 */
import {

  darkColors,

  lightColors,

  type ThemeColors,
  typography,
} from '@pedrolucaslopes/dotlog-ui'

export type ResolvedTheme = 'light' | 'dark'

/** Paleta completa de cada tema. */
export const COLORS: Readonly<Record<ResolvedTheme, ThemeColors>> = {
  light: lightColors,
  dark: darkColors,
}

/** Fundo da pagina. Claro levemente acinzentado; escuro quase preto, nunca `#000000`. */
export const BACKGROUND: Readonly<Record<ResolvedTheme, string>> = {
  light: lightColors.background,
  dark: darkColors.background,
}

/** Cartao, tabela e painel: o que fica sobre o fundo. */
export const SURFACE: Readonly<Record<ResolvedTheme, string>> = {
  light: lightColors.surface,
  dark: darkColors.surface,
}

/** Uma familia para texto, uma monoespacada para id, chave e codigo. */
export const FONTS = {
  body: typography.fontFamily,
  mono: typography.fontFamilyMono,
  size: typography.size,
  weight: typography.weight,
  lineHeight: typography.lineHeight,
} as const

export type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info'

/** Cor de um tom no tema em uso, para grafico que precisa do valor e nao da classe. */
export const toneColor = (tone: Tone, theme: ResolvedTheme): string => COLORS[theme][tone]

export { breakpoints as BREAKPOINTS, elevation as ELEVATION, motion as MOTION, radius as RADIUS, spacing as SPACING } from '@pedrolucaslopes/dotlog-ui'
