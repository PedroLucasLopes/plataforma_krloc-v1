import type { Me } from '@/types/krloc'
import { permits } from '@pedrolucaslopes/dotlog-ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { API_PREFIX, LOGIN_PATH } from '@/constants/api'
import { ApiError } from '@/services/http'
import { sessionApi } from '@/services/krloc'

/**
 * - `authenticated`: sessao valida com o KRLoc.
 * - `unauthenticated`: sem sessao; a tela manda ao login.
 * - `signed-out`: a pessoa acabou de sair. Nao manda ao login sozinho, senao a
 *   sessao do SSO, que continua viva, a colocaria de volta sem ela pedir.
 * - `unavailable`: a API nao respondeu, e nao da para afirmar nada.
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated' | 'signed-out' | 'unavailable'

/**
 * Destino da volta do login. So caminho interno: `//host` e `/\host` o navegador
 * leria como outro site. A API confere de novo, com a mesma regra.
 */
export function safeReturnPath (path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return '/'
  }

  // Voltar para a tela de saida, ou para a de login recusado, so recomecaria o ciclo.
  return path.startsWith('/signed-out') || path.startsWith('/sign-in-error') ? '/' : path
}

/**
 * A sessao do KRLoc com o SSO, mantida pelo `@pedrolucaslopes/sso-client`.
 *
 * O front nao conduz o OAuth: navega para `/api/auth/login`, e a API faz o resto
 * (PKCE, troca do code, cookie de sessao cifrado) e devolve a pessoa a tela que
 * ela pediu. Nenhum token passa por aqui. O store guarda quem entrou, o que o
 * papel alcanca e a copia legivel do token anti-CSRF, que so vale junto do
 * cookie HttpOnly.
 */
export const useSessionStore = defineStore('session', () => {
  const me = ref<Me | null>(null)
  const status = ref<SessionStatus>('unknown')
  const signingOut = ref(false)

  /**
   * Endereco do login que a API mandou no ultimo 401. E absoluto, na origem de
   * `APP_BASE_URL`, que e a registrada no SSO: quem abriu a tela por outro nome
   * do mesmo host volta ao nome certo antes de entrar.
   */
  let loginUrl: string | null = null
  let pending: Promise<SessionStatus> | null = null

  const permissions = computed(() => me.value?.permissions ?? [])
  const csrfToken = computed(() => me.value?.csrfToken ?? null)

  /** Mesma pergunta do servidor, com o mesmo matcher. So controla interface. */
  const can = (method: string, path: string): boolean =>
    permits(permissions.value, method, path, API_PREFIX)

  async function load (): Promise<SessionStatus> {
    try {
      me.value = await sessionApi.me()
      status.value = 'authenticated'
    } catch (error) {
      me.value = null

      if (error instanceof ApiError && error.status === 401) {
        const body = error.payload as { login_url?: unknown } | null

        loginUrl = typeof body?.login_url === 'string' ? body.login_url : loginUrl
        status.value = 'unauthenticated'
      } else {
        status.value = 'unavailable'
      }
    }

    return status.value
  }

  /** Carrega uma vez; chamadas simultaneas esperam a mesma resposta. */
  function ensure (): Promise<SessionStatus> {
    if (status.value !== 'unknown') {
      return Promise.resolve(status.value)
    }

    pending ??= load().finally(() => {
      pending = null
    })

    return pending
  }

  function refresh (): Promise<SessionStatus> {
    status.value = 'unknown'

    return ensure()
  }

  /**
   * Relê o token anti-CSRF. Ele muda quando a pessoa entra de novo, inclusive
   * em outra aba; a camada HTTP chama isto quando a API recusa o que tinha.
   */
  async function reloadCsrf (): Promise<boolean> {
    const previous = csrfToken.value

    return (await refresh()) === 'authenticated' && csrfToken.value !== previous
  }

  /** Navegacao de pagina ao login. Quem chama nao deve continuar a navegacao. */
  function beginLogin (returnTo: string): void {
    const target = new URL(loginUrl ?? `${API_PREFIX}${LOGIN_PATH}`, window.location.origin)

    target.searchParams.set('returnTo', safeReturnPath(returnTo))
    window.location.assign(target.toString())
  }

  /**
   * Encerra a sessao do KRLoc: a API revoga o refresh token no SSO (RFC 7009) e
   * apaga o cookie. A sessao da pessoa com o SSO continua, e e por isso que a
   * tela seguinte nao manda ao login sozinha.
   */
  async function signOut (): Promise<void> {
    signingOut.value = true

    try {
      await sessionApi.logout()
    } catch {
      /* Sessao que ja caiu nao tem o que encerrar. */
    } finally {
      signingOut.value = false
    }

    me.value = null
    status.value = 'signed-out'
  }

  /** Sessao que cai no meio do uso. A pessoa volta para a tela onde estava. */
  function handleUnauthorized (url: string | null): void {
    if (status.value === 'unauthenticated' || status.value === 'signed-out') {
      return
    }

    loginUrl = url ?? loginUrl
    me.value = null
    status.value = 'unauthenticated'
    beginLogin(`${window.location.pathname}${window.location.search}`)
  }

  return {
    me,
    status,
    signingOut,
    permissions,
    csrfToken,
    can,
    ensure,
    refresh,
    reloadCsrf,
    beginLogin,
    signOut,
    handleUnauthorized,
  }
})
