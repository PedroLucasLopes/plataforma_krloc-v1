import { currentLocale } from '@/plugins/i18n'

const pad = (value: number): string => String(value).padStart(2, '0')

const keyOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

export function currentMonth (): string {
  return keyOf(new Date())
}

export function isMonth (value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)
}

export function recentMonths (count: number): string[] {
  const now = new Date()

  return Array.from({ length: count }, (_, index) => keyOf(new Date(now.getFullYear(), now.getMonth() - index, 1)))
}

export function monthLabel (month: string): string {
  const [year, number] = month.split('-').map(Number)
  const locale = currentLocale()
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    .format(new Date(year ?? 1970, (number ?? 1) - 1, 1))

  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1)
}
