<template>
  <GateLayout>
    <DlEmptyState
      :description="t('unavailable.description')"
      icon="mdi-cloud-alert-outline"
      :title="t('unavailable.title')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" :loading="retrying" @click="retry">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState, toast } from '@pedrolucaslopes/dotlog-ui'
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import GateLayout from '@/layouts/GateLayout.vue'
  import { safeReturnPath, useSessionStore } from '@/stores/session'
  import { queryString } from '@/utils/format'

  /**
   * A API do KRLoc nao respondeu, e sem ela nao da para afirmar se a pessoa tem
   * sessao. A tela nao manda ao login, que tambem passa pela API: so oferece
   * tentar de novo.
   */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()

  const retrying = ref(false)

  async function retry (): Promise<void> {
    retrying.value = true

    try {
      if ((await session.refresh()) === 'unavailable') {
        toast.error(t('unavailable.stillTitle'), { description: t('unavailable.stillDescription') })

        return
      }

      await router.replace(safeReturnPath(queryString(route.query.from)))
    } finally {
      retrying.value = false
    }
  }
</script>
