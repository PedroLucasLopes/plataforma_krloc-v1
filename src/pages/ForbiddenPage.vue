<template>
  <DlEmptyState
    :description="t('forbidden.description')"
    icon="mdi-lock-outline"
    :title="t('forbidden.title')"
    tone="warning"
  >
    <DlButton icon="mdi-view-dashboard-outline" variant="tonal" @click="router.push('/')">
      {{ t('common.goToOverview') }}
    </DlButton>
  </DlEmptyState>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState } from '@pedrolucaslopes/dotlog-ui'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'

  const { t } = useI18n()
  const router = useRouter()
</script>
