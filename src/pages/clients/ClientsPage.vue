<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.customers') }, { label: t('nav.clients') }]"
      :description="t('clients.description')"
      :title="t('nav.clients')"
      :with-menu="false"
      @action="openCreate"
    />

    <div class="toolbar">
      <DlTextField
        :hint="t('clients.searchHint')"
        icon="mdi-magnify"
        :label="t('common.search')"
        :model-value="term"
        :placeholder="t('clients.searchPlaceholder')"
        :reserve-error="false"
        @update:model-value="onSearch"
      />
    </div>

    <DlEmptyState
      v-if="store.error && !store.loaded"
      :description="store.error"
      icon="mdi-cloud-alert-outline"
      :title="t('clients.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="store.load()">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="term.trim() ? t('clients.emptySearch') : t('clients.emptyDescription')"
      :empty-title="t('clients.emptyTitle')"
      :limit="store.limit"
      :loading="store.loading && !store.loaded"
      :page="store.page"
      :rows="rows"
      @action="onRowAction"
      @row-click="row => router.push({ name: 'client', params: { id: row.id } })"
      @update:page="value => store.setPage(value)"
    />

    <ClientFormDialog v-model:open="editing.open" :client="editing.target" @saved="onSaved" />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('clients.deleteTitle')"
      destructive
      :error="removal.error"
      :message="removal.target ? t('clients.deleteMessage', { name: removal.target.name }) : ''"
      :processing="removal.processing"
      :title="t('clients.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Client } from '@/types/krloc'
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
  import ClientFormDialog from '@/components/ClientFormDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { useClientsStore } from '@/stores/clients'
  import { formatPhone, formatTaxId } from '@/utils/documents'
  import { asText } from '@/utils/forms'

  const { t, locale } = useI18n()
  const router = useRouter()
  const store = useClientsStore()

  interface ClientRow extends Record<string, unknown> {
    id: string
    name: string
    taxId: string
    email: string | null
    phone: string
    city: string
    lessees: number
  }

  const byId = computed(() => new Map(store.rows.map(client => [client.id, client])))

  const rows = computed<ClientRow[]>(() =>
    store.rows.map(client => ({
      id: client.id,
      name: client.name,
      taxId: formatTaxId(client.tax_id),
      email: client.email,
      phone: formatPhone(client.phone),
      city: [client.city, client.state].filter(Boolean).join(' / '),
      lessees: client.lessees?.length ?? 0,
    })),
  )

  const columns = computed(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      locale: locale.value,
      overrides: {
        name: { label: t('common.name') },
        taxId: { label: t('clients.taxId'), mono: true, width: '190px' },
        email: { label: t('common.email'), secondary: true },
        phone: { label: t('clients.phone'), width: '160px', secondary: true },
        city: { label: t('address.city'), width: '170px' },
        lessees: { label: t('nav.lessees'), align: 'end', width: '90px' },
      },
    }),
  )

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'create', label: t('clients.register'), icon: 'mdi-domain-plus', method: 'POST', path: '/client' },
  ])

  const rowActions = computed<RowAction<ClientRow>[]>(() => [
    { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path: '/client/:id' },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/client/:id',
      color: 'error',
      unavailable: row => row.lessees > 0,
    },
  ])

  const term = ref(store.search)

  let timer: ReturnType<typeof setTimeout> | undefined

  function onSearch (value: unknown): void {
    term.value = asText(value)
    clearTimeout(timer)
    timer = setTimeout(() => {
      void store.applySearch(term.value)
    }, FILTER_DEBOUNCE_MS)
  }

  onBeforeUnmount(() => clearTimeout(timer))

  onMounted(() => {
    void store.load()
  })

  const editing = reactive({ open: false, target: shallowRef<Client | null>(null) })
  const removal = useConfirm<ClientRow>()

  function openCreate (): void {
    editing.target = null
    editing.open = true
  }

  function onRowAction (key: string, row: ClientRow): void {
    if (key === 'edit') {
      editing.target = byId.value.get(row.id) ?? null
      editing.open = true
    } else if (key === 'delete') {
      removal.ask(row)
    }
  }

  function onSaved (client: Client | null): void {
    if (client) {
      void router.push({ name: 'client', params: { id: client.id } })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(row => store.remove(row.id))

    if (ok) {
      toast.success(t('clients.deleted'))
    }
  }
</script>
