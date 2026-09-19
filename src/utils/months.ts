import { currentLocale } from '@/plugins/i18n'

/*
 * Mes no formato da API do fechamento: `AAAA-MM`. O mes e o do calendario
 * local, o mesmo em que a locadora fecha as contas.
 */

const pad = (value: number): string => String(value).padStart(2, '0')

const keyOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

/** O mes de hoje. */
export function currentMonth (): string {
  return keyOf(new Date())
}

/** `2026-09` e mes; `2026-13` e `setembro`, nao. */
export function isMonth (value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)
}

/** Os ultimos `count` meses, do atual para tras. Mes que ainda nao comecou nao fecha. */
export function recentMonths (count: number): string[] {
  const now = new Date()

  return Array.from({ length: count }, (_, index) => keyOf(new Date(now.getFullYear(), now.getMonth() - index, 1)))
}

/** `2026-09` vira "Setembro de 2026", na lingua da tela. */
export function monthLabel (month: string): string {
  const [year, number] = month.split('-').map(Number)
  const locale = currentLocale()
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    .format(new Date(year ?? 1970, (number ?? 1) - 1, 1))

  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1)
}
