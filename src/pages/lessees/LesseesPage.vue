<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.customers') }, { label: t('nav.lessees') }]"
      :description="t('lessees.description')"
      :title="t('nav.lessees')"
      :with-menu="false"
      @action="openCreate"
    />

    <div class="toolbar">
      <DlTextField
        icon="mdi-magnify"
        :label="t('common.search')"
        :model-value="term"
        :placeholder="t('lessees.searchPlaceholder')"
        :reserve-error="false"
        @update:model-value="value => onSearch(asText(value), city)"
      />

      <DlTextField
        icon="mdi-city-variant-outline"
        :label="t('address.city')"
        :model-value="city"
        :placeholder="t('lessees.cityPlaceholder')"
        :reserve-error="false"
        @update:model-value="value => onSearch(term, asText(value))"
      />
    </div>

    <DlEmptyState
      v-if="store.error && !store.loaded"
      :description="store.error"
      icon="mdi-cloud-alert-outline"
      :title="t('lessees.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="store.load()">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="term.trim() || city.trim() ? t('lessees.emptySearch') : t('lessees.emptyDescription')"
      :empty-title="t('lessees.emptyTitle')"
      :limit="store.limit"
      :loading="store.loading && !store.loaded"
      :page="store.page"
      :rows="rows"
      @action="onRowAction"
      @row-click="row => router.push({ name: 'lessee', params: { id: row.id } })"
      @update:page="value => store.setPage(value)"
    />

    <LesseeFormDialog v-model:open="editing.open" :lessee="editing.target" @saved="onSaved" />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('lessees.deleteTitle')"
      destructive
      :error="removal.error"
      :message="removal.target ? t('lessees.deleteMessage', { name: removal.target.name }) : ''"
      :processing="removal.processing"
      :title="t('lessees.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Lessee } from '@/types/krloc'
  import {
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlPageHeader,
    DlTextField,
    type HeaderAction,
    inferColumns,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import LesseeFormDialog from '@/components/LesseeFormDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { useLesseesStore } from '@/stores/lessees'
  import { formatZipcode } from '@/utils/documents'
  import { asText } from '@/utils/forms'

  /** Obras de todos os clientes. Pagina no servidor. */
  const { t, locale } = useI18n()
  const router = useRouter()
  const store = useLesseesStore()

  interface LesseeRow extends Record<string, unknown> {
    id: string
    name: string
    client: string
    city: string
    zipcode: string
    contracts: number
  }

  const byId = computed(() => new Map(store.rows.map(lessee => [lessee.id, lessee])))

  const rows = computed<LesseeRow[]>(() =>
    store.rows.map(lessee => ({
      id: lessee.id,
      name: lessee.name,
      client: lessee.client?.name ?? '—',
      city: [lessee.city, lessee.state].filter(Boolean).join(' / '),
      zipcode: formatZipcode(lessee.zipcode),
      contracts: lessee.eleases?.length ?? 0,
    })),
  )

  const columns = computed(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      locale: locale.value,
      overrides: {
        name: { label: t('common.name') },
        client: { label: t('lessees.client') },
        city: { label: t('address.city'), width: '180px' },
        zipcode: { label: t('address.zipcode'), mono: true, width: '120px', secondary: true },
        contracts: { label: t('nav.contracts'), align: 'end', width: '110px' },
      },
    }),
  )

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'create', label: t('lessees.register'), icon: 'mdi-plus', method: 'POST', path: '/lessee' },
  ])

  const rowActions = computed<RowAction<LesseeRow>[]>(() => [
    { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path: '/lessee/:id' },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/lessee/:id',
      color: 'error',
      // Obra com contrato nao sai: e o historico do contrato.
      unavailable: row => row.contracts > 0,
    },
  ])

  /* -------------------------------- busca -------------------------------- */

  const term = ref(store.search)
  const city = ref(store.city)

  let timer: ReturnType<typeof setTimeout> | undefined

  function onSearch (nextTerm: string, nextCity: string): void {
    term.value = nextTerm
    city.value = nextCity
    clearTimeout(timer)
    timer = setTimeout(() => {
      void store.applySearch(term.value, city.value)
    }, FILTER_DEBOUNCE_MS)
  }

  onBeforeUnmount(() => clearTimeout(timer))

  onMounted(() => {
    void store.load()
  })

  /* ------------------------------ gravacao ------------------------------ */

  const editing = reactive({ open: false, target: shallowRef<Lessee | null>(null) })
  const removal = useConfirm<LesseeRow>()

  function openCreate (): void {
    editing.target = null
    editing.open = true
  }

  function onRowAction (key: string, row: LesseeRow): void {
    if (key === 'edit') {
      editing.target = byId.value.get(row.id) ?? null
      editing.open = true
    } else if (key === 'delete') {
      removal.ask(row)
    }
  }

  function onSaved (lessee: Lessee | null): void {
    if (lessee) {
      void router.push({ name: 'lessee', params: { id: lessee.id } })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(row => store.remove(row.id))

    if (ok) {
      toast.success(t('lessees.deleted'))
    }
  }
</script>
