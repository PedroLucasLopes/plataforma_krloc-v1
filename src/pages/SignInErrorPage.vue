<template>
  <DlSignIn
    :application="APP_NAME"
    :brand="APP_NAME"
    :error="error"
    :logo="APP_LOGO"
    :pending-provider="pendingProvider"
    :providers="providers"
    state="ready"
    @select="signIn"
  />
</template>

<script lang="ts" setup>
  import { DlSignIn } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { SIGN_IN_PROVIDER } from '@/constants/api'
  import { APP_LOGO, APP_NAME } from '@/constants/layout'
  import { signInError } from '@/constants/messages'
  import { safeReturnPath, useSessionStore } from '@/stores/session'
  import { queryString } from '@/utils/format'

  /**
   * Para onde a API devolve quem nao conseguiu entrar.
   *
   * O SSO recusa no callback da API, como a conta sem papel no projeto KRLoc
   * (`access_denied`). Com `APP_LOGIN_ERROR_REDIRECT` apontando para ca, o
   * `@pedrolucaslopes/sso-client` manda a pessoa a esta tela com
   * `?auth_error=<codigo>`, em vez de responder JSON. O cartao e o da tela de
   * login do SSO, com a marca do KRLoc e a mesma caixa de erro.
   *
   * So codigo conhecido vira texto, e nada lido da URL e ecoado.
   *
   * A tela nao manda ao login sozinha. A conta recusada seria recusada de novo,
   * voltaria para ca, e o ciclo se repetiria sem clique nenhum: entrar de novo e
   * o botao, depois que um administrador liberar o acesso.
   */
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()

  const providers = [SIGN_IN_PROVIDER]
  const pendingProvider = ref<string | null>(null)

  const error = computed(() => signInError(queryString(route.query.auth_error)))

  // A API so manda `returnTo` que ja passou pelo `safeReturnTo` dela; aqui ele
  // passa de novo, porque a URL desta tela pode ter sido escrita a mao.
  const returnTo = computed(() => safeReturnPath(queryString(route.query.returnTo)))

  function signIn (): void {
    if (pendingProvider.value) {
      return
    }

    pendingProvider.value = SIGN_IN_PROVIDER.id
    session.beginLogin(returnTo.value)
  }

  /**
   * Voltar do SSO pelo botao do navegador restaura esta pagina do cache, com o
   * botao ainda girando. A pessoa precisa poder tentar de novo.
   */
  function onPageShow (event: PageTransitionEvent): void {
    if (event.persisted) {
      pendingProvider.value = null
    }
  }

  onMounted(async () => {
    window.addEventListener('pageshow', onPageShow)

    // Aberta por quem ja tem sessao, como num favorito, a tela so atrapalharia.
    // `GET /api/auth/me` nao manda ao login no 401, entao isto nao vira laco.
    if ((await session.ensure()) === 'authenticated') {
      await router.replace(returnTo.value)
    }
  })

  onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))
</script>
