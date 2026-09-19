import { CURRENCY, DATE_INPUT_MAX, DATE_INPUT_MIN } from '@/constants/api'
import { currentLocale } from '@/plugins/i18n'

const DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: '2-digit', minute: '2-digit' }

/* Um formatador por lingua e formato: criar `Intl.*Format` a cada celula custa caro. */
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>()

function cached<Format extends Intl.DateTimeFormat | Intl.NumberFormat> (name: string, create: (locale: string) => Format): Format {
  const locale = currentLocale()
  const key = `${name}:${locale}`
  let format = formatters.get(key) as Format | undefined

  if (!format) {
    format = create(locale)
    formatters.set(key, format)
  }

  return format
}

function parse (iso: string | null | undefined): Date | null {
  if (!iso) {
    return null
  }

  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? null : date
}

/** Data curta, na lingua corrente. Valor ausente vira travessao, nao espaco vazio. */
export function formatDate (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? cached('date', locale => new Intl.DateTimeFormat(locale, DATE)).format(date) : '—'
}

export function formatDateTime (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? cached('dateTime', locale => new Intl.DateTimeFormat(locale, DATE_TIME)).format(date) : '—'
}

/** Valor em reais, com a pontuacao da lingua da tela. */
export function formatMoney (value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }

  return cached('money', locale => new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY })).format(value)
}

/** Nome de uma unidade: o tipo e o numero dela. `KRBET` numero 12 vira `KRBET-12`. */
export function unitCode (code: string, suffix: number): string {
  return `${code}-${suffix}`
}

/** Primeiro nome, para cumprimento. */
export const firstName = (name: string): string => name.trim().split(/\s+/, 1)[0] ?? name

/** Parametro de rota ou query que pode vir repetido. */
export function queryString (value: unknown): string | null {
  return typeof value === 'string' ? value : (Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const localMidnight = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** Dias de hoje ate a data, pelo calendario local. Negativo e atraso; zero e hoje. */
export function daysUntil (iso: string): number {
  const date = parse(iso)

  return date ? Math.round((localMidnight(date) - localMidnight(new Date())) / MS_PER_DAY) : 0
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** Data de hoje no formato do campo de data (`AAAA-MM-DD`). */
export function todayInput (): string {
  const now = new Date()

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Data da API no formato do campo de data, pelo calendario local. */
export function isoToDateInput (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : ''
}

/** O dia de uma data do campo, contado desde 1970. */
function dateInputDay (value: string): number | null {
  const [year, month, date] = value.split('-').map(Number)

  return year && month && date ? Date.UTC(year, month - 1, date) / MS_PER_DAY : null
}

/** Dias de uma data do campo a outra, com sinal. `null` se falta data. */
export function dateInputDelta (from: string, to: string): number | null {
  const start = dateInputDay(from)
  const end = dateInputDay(to)

  return start === null || end === null ? null : end - start
}

/** Dias corridos entre duas datas do campo, como a API conta: ao menos um. `null` se falta data ou a ordem esta invertida. */
export function dateInputDays (start: string, end: string): number | null {
  const delta = dateInputDelta(start, end)

  return delta === null || delta < 0 ? null : Math.max(1, delta)
}

/** A data do campo cai no intervalo que a API aceita. */
export function isDateInputInRange (value: string): boolean {
  return value >= DATE_INPUT_MIN && value <= DATE_INPUT_MAX
}

/** A data do campo somada de `days` dias, no formato do campo. */
export function addDaysToDateInput (value: string, days: number): string {
  const [year, month, date] = value.split('-').map(Number)
  const result = new Date(year ?? 1970, (month ?? 1) - 1, (date ?? 1) + days)

  return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())}`
}

/**
 * Data escolhida no campo como instante para a API: meio-dia local.
 *
 * Contrato tem dia, nao hora, e a API conta o dia em Sao Paulo: na cobranca e
 * nos documentos. Meia-noite em UTC seria o dia anterior la; meio-dia local cai
 * no mesmo dia de Sao Paulo em todo fuso de -12h a +9h, o Brasil inteiro incluido.
 */
export function dateInputToIso (value: string): string {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12).toISOString()
}
