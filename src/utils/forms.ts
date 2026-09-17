/** Opcao de seletor no formato que `DlSelect` le por padrao. */
export interface SelectOption {
  title: string
  value: string
}

/** Valor de campo de texto como string. O campo pode devolver numero ou `null`. */
export function asText (value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return typeof value === 'number' ? String(value) : ''
}

/** Valor unico de seletor. Limpar o campo devolve `null`. */
export function asOption (value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** Valores de seletor multiplo. */
export function asOptions (value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Inteiro digitado, ou `null`. "12a" nao e 12. */
export function asInteger (value: unknown): number | null {
  const text = asText(value).trim()

  return /^\d+$/.test(text) ? Number(text) : null
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

/**
 * Codigo de equipamento como a API aceita: comeca com `KR` e tem ao menos tres
 * caracteres antes de um sufixo `-XXX`, que ela descarta. O numero da unidade e
 * dela, sequencial.
 */
export const EQUIPMENT_CODE_PATTERN = /^KR[A-Z0-9]+/i

/** Sigla de UF, como a API exige: duas letras maiusculas. */
export const STATE_PATTERN = /^[A-Z]{2}$/
