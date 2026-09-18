import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SESSION_RECHECK_MS } from '@/constants/api'
import { useSessionStore } from '@/stores/session'

/** Duas conferencias seguidas, como foco e visibilidade juntos, viram uma so. */
const MIN_GAP_MS = 5000

/**
 * Mantem a tela em dia com o que mudou no SSO enquanto a pessoa usa o KRLoc.
 *
 * Sem isto, `GET /api/auth/me` era lido uma vez, na carga da pagina: papel
 * trocado ou retirado no SSO so aparecia no menu depois de sair e entrar de
 * novo, mesmo com a API ja decidindo pelo papel novo.
 *
 * Rele a sessao a cada `SESSION_RECHECK_MS` com a aba visivel, e na hora em que
 * a pessoa volta para ela. O que muda:
 *
 * - **papel diferente:** menu, cabecalho e acoes acompanham sozinhos, porque
 *   saem de `session.permissions`. Se a tela aberta deixou de ser alcancada, a
 *   pessoa vai para a de "nao permitido";
 * - **acesso encerrado** (tirada do projeto, aplicacao suspensa, sessao
 *   revogada): vai ao login, que no SSO vira a tela de acesso recusado.
 *
 * Aba escondida nao pergunta nada: quem nao esta olhando nao precisa de tela em
 * dia, e a API continua conferindo cada chamada.
 */
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
