<template>
  <DlEmptyState
    :description="t('notFound.description')"
    icon="mdi-map-marker-question-outline"
    :title="t('notFound.title')"
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
