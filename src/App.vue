<template>
  <VApp>
    <RouterView />
    <DlToastHost />
  </VApp>
</template>

<script lang="ts" setup>
  import { bindVuetifyTheme, DlToastHost } from '@pedrolucaslopes/dotlog-ui'

  bindVuetifyTheme()
</script>
