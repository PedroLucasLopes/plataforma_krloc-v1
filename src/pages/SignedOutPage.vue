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

  const { t } = useI18n()
  const router = useRouter()
  const session = useSessionStore()

  const leaving = ref(false)

  function signIn (): void {
    leaving.value = true
    session.beginLogin('/')
  }

  onMounted(async () => {
    if (session.status !== 'signed-out' && (await session.ensure()) === 'authenticated') {
      await router.replace('/')
    }
  })
</script>
