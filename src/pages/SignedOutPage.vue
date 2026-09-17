<template>
  <GateLayout>
    <DlEmptyState
      :description="t('signedOut.description')"
      icon="mdi-logout-variant"
      :title="t('signedOut.title')"
      tone="info"
    >
      <DlButton icon="mdi-login-variant" :loading="leaving" @click="signIn">{{ t('signedOut.signIn') }}</DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState } from '@pedrolucaslopes/dotlog-ui'
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import GateLayout from '@/layouts/GateLayout.vue'
  import { useSessionStore } from '@/stores/session'

  /**
   * A pessoa saiu do KRLoc.
   *
   * A sessao dela com o SSO continua de pe, e e ela que a colocaria de volta sem
   * pedir nada. Por isso esta tela nao manda ao login sozinha: entrar de novo e
   * um clique, e so acontece quando a pessoa quer.
   */
  const { t } = useI18n()
  const router = useRouter()
  const session = useSessionStore()

  const leaving = ref(false)

  function signIn (): void {
    leaving.value = true
    session.beginLogin('/')
  }

  onMounted(async () => {
    // Aberta direto por quem ainda tem sessao, a tela so atrapalharia.
    if (session.status !== 'signed-out' && (await session.ensure()) === 'authenticated') {
      await router.replace('/')
    }
  })
</script>
