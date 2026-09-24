import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SESSION_RECHECK_MS } from '@/constants/api'
import { useSessionStore } from '@/stores/session'

const MIN_GAP_MS = 5000

export function useSessionWatch (): void {
  const session = useSessionStore()
  const route = useRoute()
  const router = useRouter()

  let timer: ReturnType<typeof setInterval> | undefined
  let lastCheck = 0

  async function check (): Promise<void> {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < MIN_GAP_MS) {
      return
    }

    lastCheck = Date.now()

    const result = await session.revalidate()

    if (result === 'ended') {
      session.beginLogin(route.fullPath)

      return
    }

    const permission = route.meta.permission

    if (result === 'changed' && permission && !session.can(permission.method, permission.path)) {
      await router.replace({ name: 'forbidden', query: { from: route.fullPath } })
    }
  }

  function onReturn (): void {
    void check()
  }

  onMounted(() => {
    lastCheck = Date.now()
    timer = setInterval(onReturn, SESSION_RECHECK_MS)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
  })
}
