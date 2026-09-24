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

  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()

  const providers = [SIGN_IN_PROVIDER]
  const pendingProvider = ref<string | null>(null)

  const error = computed(() => signInError(queryString(route.query.auth_error)))

  const returnTo = computed(() => safeReturnPath(queryString(route.query.returnTo)))

  function signIn (): void {
    if (pendingProvider.value) {
      return
    }

    pendingProvider.value = SIGN_IN_PROVIDER.id
    session.beginLogin(returnTo.value)
  }

  function onPageShow (event: PageTransitionEvent): void {
    if (event.persisted) {
      pendingProvider.value = null
    }
  }

  onMounted(async () => {
    window.addEventListener('pageshow', onPageShow)

    if ((await session.ensure()) === 'authenticated') {
      await router.replace(returnTo.value)
    }
  })

  onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))
</script>
