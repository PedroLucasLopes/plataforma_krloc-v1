<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.inventory') }, { label: t('nav.accessories') }]"
      :description="t('accessories.description')"
      :title="t('nav.accessories')"
      :with-menu="false"
      @action="onHeaderAction"
    />

    <div class="toolbar">
      <DlTextField
        icon="mdi-magnify"
        :label="t('common.search')"
        :model-value="term"
        :placeholder="t('accessories.searchPlaceholder')"
        :reserve-error="false"
        @update:model-value="onSearch"
      />
    </div>

    <DlEmptyState
      v-if="store.error && !store.loaded"
      :description="store.error"
      icon="mdi-cloud-alert-outline"
      :title="t('accessories.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="store.load()">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="term.trim() ? t('accessories.emptySearch') : t('accessories.emptyDescription')"
      :empty-title="t('accessories.emptyTitle')"
      :limit="store.limit"
      :loading="store.loading && !store.loaded"
      :page="store.page"
      :rows="rows"
      @action="onRowAction"
      @row-click="row => session.can('PUT', '/accessory/:id') && onRowAction('edit', row)"
      @update:page="value => store.setPage(value)"
    />

    <AccessoryFormDialog v-model:open="editing.open" :accessory="editing.target" />

    <ImportDialog
      v-model:open="importing"
      :columns="IMPORT_COLUMNS"
      :description="t('accessories.importDescription')"
      :title="t('accessories.import')"
      :upload="store.importCsv"
    />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="removal.target && removal.target.quantity > 0 ? t('accessories.removeUnit') : t('common.delete')"
      destructive
      :error="removal.error"
      :message="removalMessage"
      :processing="removal.processing"
      :title="removal.target && removal.target.quantity > 0 ? t('accessories.removeUnitTitle') : t('accessories.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Accessory } from '@/types/krloc'
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
  import AccessoryFormDialog from '@/components/AccessoryFormDialog.vue'
  import ImportDialog from '@/components/ImportDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { useAccessoriesStore } from '@/stores/accessories'
  import { useSessionStore } from '@/stores/session'
  import { formatMoney } from '@/utils/format'
  import { asText } from '@/utils/forms'

  /** O que `POST /accessory/upload` le da planilha, pelo nome da coluna. */
  const IMPORT_COLUMNS = ['name', 'quantity', 'p_indemnity']

  /**
   * Acessorios e o estoque deles. Remover segue a regra da API: com estoque sai
   * uma unidade, sem estoque sai o cadastro, e o que esta associado a equipamento
   * nao sai.
   */
  const { t, locale } = useI18n()
  const session = useSessionStore()
  const store = useAccessoriesStore()

  interface AccessoryRow extends Record<string, unknown> {
    id: string
    name: string
    quantity: number
    p_indemnity: number
  }

  const byId = computed(() => new Map(store.rows.map(item => [item.id, item])))

  const rows = computed<AccessoryRow[]>(() =>
    store.rows.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, p_indemnity: item.p_indemnity })),
  )

  const columns = computed(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      locale: locale.value,
      overrides: {
        name: { label: t('common.name') },
        quantity: { label: t('accessories.quantity'), width: '150px' },
        p_indemnity: { label: t('rates.indemnity'), align: 'end', width: '170px', format: row => formatMoney(row.p_indemnity as number) },
      },
    }),
  )

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'import', label: t('accessories.import'), icon: 'mdi-file-upload-outline', method: 'POST', path: '/accessory/upload', variant: 'outlined' },
    { key: 'create', label: t('accessories.register'), icon: 'mdi-plus', method: 'POST', path: '/accessory' },
  ])

  const rowActions = computed<RowAction<AccessoryRow>[]>(() => [
    { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path: '/accessory/:id' },
    { key: 'remove', label: t('accessories.remove'), icon: 'mdi-minus-circle-outline', method: 'DELETE', path: '/accessory/:id', color: 'error' },
  ])

  /* -------------------------------- busca -------------------------------- */

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

  /* ------------------------------ gravacao ------------------------------ */

  const editing = reactive({ open: false, target: shallowRef<Accessory | null>(null) })
  const importing = ref(false)
  const removal = useConfirm<AccessoryRow>()

  const removalMessage = computed(() => {
    const target = removal.target

    if (!target) {
      return ''
    }

    return target.quantity > 0
      ? t('accessories.removeUnitMessage', { name: target.name, from: target.quantity, to: target.quantity - 1 })
      : t('accessories.deleteMessage', { name: target.name })
  })

  function onHeaderAction (key: string): void {
    if (key === 'create') {
      editing.target = null
      editing.open = true
    } else if (key === 'import') {
      importing.value = true
    }
  }

  function onRowAction (key: string, row: AccessoryRow): void {
    if (key === 'edit') {
      editing.target = byId.value.get(row.id) ?? null
      editing.open = true
    } else if (key === 'remove') {
      removal.ask(row)
    }
  }

  async function remove (): Promise<void> {
    const unit = (removal.target?.quantity ?? 0) > 0
    const ok = await removal.confirm(row => store.remove(row.id))

    if (ok) {
      toast.success(unit ? t('accessories.unitRemoved') : t('accessories.deleted'))
    }
  }
</script>
