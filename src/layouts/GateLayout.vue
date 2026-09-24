<template>
  <main class="gate">
    <div class="gate__card">
      <slot />
    </div>
  </main>
</template>

<script lang="ts" setup>
</script>

<style scoped>
.gate {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background:
    radial-gradient(56rem 36rem at 12% -12%, rgba(var(--v-theme-primary), 0.08), transparent 62%),
    var(--dl-background);
}

.gate__card {
  width: 100%;
  max-width: 480px;
  background: var(--dl-surface);
  border: 1px solid var(--dl-outline);
  border-radius: var(--dl-radius-lg, 16px);
}
</style>
