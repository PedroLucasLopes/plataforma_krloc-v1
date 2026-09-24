import type { Me } from '@/types/krloc'
import { permits } from '@pedrolucaslopes/dotlog-ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { API_PREFIX, LOGIN_PATH } from '@/constants/api'
import { ApiError } from '@/services/http'
import { sessionApi } from '@/services/krloc'

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated' | 'signed-out' | 'unavailable'

export function safeReturnPath (path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return '/'
  }

  return path.startsWith('/signed-out') || path.startsWith('/sign-in-error') ? '/' : path
}

function accessKey (me: Me | null): string {
  if (!me) {
    return ''
  }

  const roles = me.roles.toSorted().join(',')
  const routes = me.permissions.map(p => `${p.method} ${p.path}`).toSorted().join(',')

  return `${roles}|${routes}`
}

export const useSessionStore = defineStore('session', () => {
  const me = ref<Me | null>(null)
  const status = ref<SessionStatus>('unknown')
  const signingOut = ref(false)

  let loginUrl: string | null = null
  let pending: Promise<SessionStatus> | null = null

  const permissions = computed(() => me.value?.permissions ?? [])
  const csrfToken = computed(() => me.value?.csrfToken ?? null)

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

  async function revalidate (): Promise<'same' | 'changed' | 'ended' | 'unknown'> {
    if (status.value !== 'authenticated' || pending) {
      return 'unknown'
    }

    try {
      const next = await sessionApi.me()
      const changed = accessKey(next) !== accessKey(me.value)

      me.value = next

      return changed ? 'changed' : 'same'
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const body = error.payload as { login_url?: unknown } | null

        loginUrl = typeof body?.login_url === 'string' ? body.login_url : loginUrl
        me.value = null
        status.value = 'unauthenticated'

        return 'ended'
      }

      return 'unknown'
    }
  }

  async function reloadCsrf (): Promise<boolean> {
    const previous = csrfToken.value

    return (await refresh()) === 'authenticated' && csrfToken.value !== previous
  }

  function beginLogin (returnTo: string): void {
    const target = new URL(loginUrl ?? `${API_PREFIX}${LOGIN_PATH}`, window.location.origin)

    target.searchParams.set('returnTo', safeReturnPath(returnTo))
    window.location.assign(target.toString())
  }

  async function signOut (): Promise<void> {
    signingOut.value = true

    await sessionApi.logout().catch(() => null)

    signingOut.value = false

    me.value = null
    status.value = 'signed-out'
  }

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
    revalidate,
    reloadCsrf,
    beginLogin,
    signOut,
    handleUnauthorized,
  }
})
