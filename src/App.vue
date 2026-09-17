<template>
  <VApp>
    <RouterView />
    <DlToastHost />
  </VApp>
</template>

<script lang="ts" setup>
  import { bindVuetifyTheme, DlToastHost } from '@pedrolucaslopes/dotlog-ui'

  // Liga a preferencia de tema ao Vuetify e as variaveis `--dl-*`. Precisa
  // rodar dentro de componente, onde o Vuetify ja foi injetado.
  bindVuetifyTheme()
</script>
