import { API_PREFIX } from '@/constants/api'
import { apiErrorText, STATUS_MESSAGE_KEYS } from '@/constants/messages'
import { t } from '@/plugins/i18n'

export class ApiError extends Error {
  constructor (
    readonly status: number,
    message: string,
    readonly code: string | null = null,
    readonly payload: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: object
  emptyOn404?: boolean
  redirectOnUnauthorized?: boolean
  signal?: AbortSignal
}

interface HttpHooks {
  csrfToken: () => string | null
  unauthorized: (loginUrl: string | null) => void
  csrfRejected: () => Promise<boolean>
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let hooks: HttpHooks = {
  csrfToken: () => null,
  unauthorized: () => {},
  csrfRejected: async () => false,
}

export function configureHttp (next: HttpHooks): void {
  hooks = next
}

function buildUrl (path: string, query?: object): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    const primitive = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

    if (primitive && value !== '') {
      params.set(key, String(value))
    }
  }

  const search = params.toString()

  return `${API_PREFIX}${path}${search ? `?${search}` : ''}`
}

async function readBody (response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function record (payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
}

function codeOf (payload: unknown): string | null {
  const code = record(payload).error

  return typeof code === 'string' ? code : null
}

function describe (status: number, payload: unknown): string {
  const known = apiErrorText(codeOf(payload), record(payload))

  if (known) {
    return known
  }

  const key = STATUS_MESSAGE_KEYS[status] ?? (status >= 500 ? STATUS_MESSAGE_KEYS[500] : undefined)

  return key ? t(key) : t('errors.fallback')
}

async function send (path: string, options: RequestOptions, accept: string, retried = false): Promise<Response> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: accept }
  const multipart = options.body instanceof FormData

  if (options.body !== undefined && !multipart) {
    headers['Content-Type'] = 'application/json'
  }

  if (!SAFE_METHODS.has(method)) {
    const token = hooks.csrfToken()

    if (token) {
      headers['X-CSRF-Token'] = token
    }
  }

  let body: BodyInit | undefined

  if (multipart) {
    body = options.body as FormData
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
  }

  let response: Response

  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new ApiError(0, t('errors.status.network'), 'network_error')
  }

  if (response.status === 403 && !SAFE_METHODS.has(method) && !retried) {
    const code = codeOf(await readBody(response.clone()))

    if (code === 'csrf_token_invalid' && await hooks.csrfRejected()) {
      return send(path, options, accept, true)
    }
  }

  return response
}

async function fail (response: Response, options: RequestOptions): Promise<never> {
  const payload = await readBody(response)

  if (response.status === 401) {
    const body = record(payload)
    const loginUrl = body.error === 'login_required' && typeof body.login_url === 'string' ? body.login_url : null

    if (options.redirectOnUnauthorized !== false) {
      hooks.unauthorized(loginUrl)
    }

    throw new ApiError(401, t('errors.status.unauthorized'), 'login_required', payload)
  }

  throw new ApiError(response.status, describe(response.status, payload), codeOf(payload), payload)
}

export async function request<T> (path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options, 'application/json')

  if (response.status === 404 && options.emptyOn404) {
    return [] as T
  }

  if (!response.ok) {
    return fail(response, options)
  }

  return (response.status === 204 ? null : await readBody(response)) as T
}

function fileNameOf (disposition: string | null): string | null {
  if (!disposition) {
    return null
  }

  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1]?.trim() ?? null
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]

  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    } catch {
      return plain
    }
  }

  return plain
}

export async function download (path: string, options: RequestOptions = {}): Promise<{ blob: Blob, fileName: string | null }> {
  const response = await send(path, options, '*/*')

  if (!response.ok) {
    return fail(response, options)
  }

  return { blob: await response.blob(), fileName: fileNameOf(response.headers.get('Content-Disposition')) }
}

export function errorMessage (error: unknown): string {
  return error instanceof ApiError ? error.message : t('errors.fallback')
}
