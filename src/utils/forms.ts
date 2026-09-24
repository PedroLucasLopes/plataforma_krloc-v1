export interface SelectOption {
  title: string
  value: string
}

export function asText (value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return typeof value === 'number' ? String(value) : ''
}

export function asOption (value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

export function asOptions (value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function asInteger (value: unknown): number | null {
  const text = asText(value).trim()

  return /^\d+$/.test(text) ? Number(text) : null
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

export const EQUIPMENT_CODE_PATTERN = /^KR[A-Z0-9]+/i

export const STATE_PATTERN = /^[A-Z]{2}$/
