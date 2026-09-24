<template>
  <DlAppShell
    v-model:collapsed="preferences.navCollapsed"
    v-model:open="navOpen"
    :active="activeNav"
    :groups="groups"
    :loading="routeLoading"
    :logo="APP_LOGO"
    :max-width="CONTENT_MAX_WIDTH"
    :subtitle="t('app.subtitle')"
    :title="APP_NAME"
    @navigate="navigate"
  >
    <template #top-actions>
      <DlUserMenu
        v-if="session.me"
        :email="session.me.email"
        :name="session.me.name"
        :role="roleLabel(session.me.roles)"
        :signing-out="session.signingOut"
        :theme-mode="preferences.themeMode"
        @sign-out="signOut"
        @update:theme-mode="preferences.setThemeMode"
      />
    </template>

    <RouterView v-slot="{ Component, route: current }">
      <Transition mode="out-in" name="page">
        <component :is="Component" :key="current.path" />
      </Transition>
    </RouterView>
  </DlAppShell>
</template>

<script lang="ts" setup>
  import { DlAppShell, DlUserMenu, type NavItem, providePermissions } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, toRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useSessionWatch } from '@/composables/useSessionWatch'
  import { API_PREFIX } from '@/constants/api'
  import { APP_LOGO, APP_NAME, CONTENT_MAX_WIDTH } from '@/constants/layout'
  import { buildNavGroups } from '@/constants/navigation'
  import { roleLabel } from '@/constants/status'
  import { routeLoading } from '@/router/loading'
  import { usePreferencesStore } from '@/stores/preferences'
  import { useSessionStore } from '@/stores/session'

  const { t } = useI18n()
  const session = useSessionStore()
  const preferences = usePreferencesStore()
  const route = useRoute()
  const router = useRouter()

  providePermissions(toRef(session, 'permissions'), ref(API_PREFIX))

  useSessionWatch()

  const navOpen = ref(false)

  const groups = computed(() => buildNavGroups(session.permissions))

  const activeNav = computed(() => route.meta.nav)

  function navigate (item: NavItem): void {
    void router.push(item.to)
  }

  async function signOut (): Promise<void> {
    await session.signOut()
    await router.replace({ name: 'signed-out' })
  }
</script>
