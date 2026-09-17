/**
 * Chamadas a API do KRLoc.
 *
 * O que este backend faz e que a camada resolve uma vez, para nenhuma tela
 * precisar lembrar:
 *
 * - **Listagem vazia responde 404.** Com `emptyOn404`, vira lista vazia.
 * - **A credencial e o cookie de sessao do `@pedrolucaslopes/sso-client`**,
 *   anexado pelo navegador na mesma origem. Nenhum token passa pelo JavaScript.
 * - **Escrita leva `X-CSRF-Token`.** Sem ele a API recusa com 403. Se a sessao
 *   foi refeita em outra aba, o token em memoria ficou velho: a camada relê o
 *   token uma vez e repete a chamada.
 * - **Sessao que cai no meio do uso** responde 401 com `login_required` e o
 *   endereco do login. A pessoa vai ao login e volta para a tela onde estava.
 *
 * O erro sai como `ApiError`, com mensagem pronta para mostrar a uma pessoa, na
 * lingua corrente no momento da falha.
 */
import { API_PREFIX } from '@/constants/api'
import { apiMessage, STATUS_MESSAGE_KEYS } from '@/constants/messages'
import { t } from '@/plugins/i18n'

export class ApiError extends Error {
  constructor (
    readonly status: number,
    message: string,
    readonly code: string | null = null,
    /** O corpo da resposta, para quem precisa de mais que a mensagem. */
    readonly payload: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Objeto vira JSON. `FormData` vai como veio, e o navegador monta o multipart. */
  body?: unknown
  /** Filtros da listagem. So texto, numero e booleano viram parametro; vazio e ignorado. */
  query?: object
  /** Este backend responde 404 para lista vazia. Com isto, vira `[]`. */
  emptyOn404?: boolean
  /** `false` onde a propria chamada decide o que fazer com o 401. */
  redirectOnUnauthorized?: boolean
  signal?: AbortSignal
}

interface HttpHooks {
  csrfToken: () => string | null
  /** Sessao caiu. Recebe o endereco de login que a API mandou, quando mandou. */
  unauthorized: (loginUrl: string | null) => void
  /** A API recusou o token anti-CSRF. Devolve `true` se conseguiu um novo. */
  csrfRejected: () => Promise<boolean>
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let hooks: HttpHooks = {
  csrfToken: () => null,
  unauthorized: () => {},
  csrfRejected: async () => false,
}

/** Liga a camada a sessao. Chamado uma vez, no registro dos plugins. */
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

/** O texto do `@pedrolucaslopes/sso-client` quando o header anti-CSRF falta ou nao confere. */
const CSRF_REJECTION = /^requisicao autenticada por cookie precisa do header/

function describe (status: number, payload: unknown): string {
  const body = record(payload)
  let raw: string[] = []

  if (Array.isArray(body.message)) {
    raw = body.message.map(String)
  } else if (typeof body.message === 'string') {
    raw = [body.message]
  }

  const known = raw.map(message => apiMessage(message))

  if (raw.length > 0 && known.every(Boolean)) {
    return known.join(' ')
  }

  // A validacao do class-validator vem em ingles e nomeia o campo. O que a tela
  // conhece sai traduzido; o resto entra como veio, dentro de uma frase na lingua da tela.
  if (status === 400 && raw.length > 0) {
    return t('errors.status.badRequest', { detail: raw.map((message, index) => known[index] ?? message).join(' ') })
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
    const message = record(await readBody(response.clone())).message

    if (typeof message === 'string' && CSRF_REJECTION.test(message) && await hooks.csrfRejected()) {
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

  const code = typeof record(payload).error === 'string' ? String(record(payload).error) : null

  throw new ApiError(response.status, describe(response.status, payload), code, payload)
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

/** `filename*=UTF-8''...` primeiro: o nome com acento so vem ali. */
function fileNameOf (disposition: string | null): string | null {
  if (!disposition) {
    return null
  }

  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]

  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    } catch {
      /* Nome mal codificado cai no nome simples. */
    }
  }

  return disposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1]?.trim() ?? null
}

/** Documento gerado pela API: o arquivo e o nome que ela sugere. */
export async function download (path: string, options: RequestOptions = {}): Promise<{ blob: Blob, fileName: string | null }> {
  const response = await send(path, options, '*/*')

  if (!response.ok) {
    return fail(response, options)
  }

  return { blob: await response.blob(), fileName: fileNameOf(response.headers.get('Content-Disposition')) }
}

/** Mensagem de qualquer falha, para toast e para erro dentro de modal. */
export function errorMessage (error: unknown): string {
  return error instanceof ApiError ? error.message : t('errors.fallback')
}
