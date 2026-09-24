<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.inventory') }, { label: t('nav.equipment') }]"
      :description="t('equipment.description')"
      :title="t('nav.equipment')"
      :with-menu="false"
      @action="onHeaderAction"
    />

    <div class="toolbar">
      <DlTextField
        :hint="t('equipment.searchHint')"
        icon="mdi-magnify"
        :label="t('common.search')"
        :model-value="term"
        :placeholder="t('equipment.searchPlaceholder')"
        :reserve-error="false"
        @update:model-value="onSearch"
      />

      <DlSelect
        :label="t('common.status')"
        :model-value="status"
        :options="statusOptions"
        :placeholder="t('common.allStatuses')"
        @update:model-value="onStatus"
      />
    </div>

    <DlEmptyState
      v-if="store.error && !store.loaded"
      :description="store.error"
      icon="mdi-cloud-alert-outline"
      :title="t('equipment.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="store.load()">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="filtered ? t('equipment.emptySearch') : t('equipment.emptyDescription')"
      :empty-title="t('equipment.emptyTitle')"
      :limit="store.limit"
      :loading="store.loading && !store.loaded"
      :page="store.page"
      :rows="rows"
      @action="onRowAction"
      @row-click="row => router.push({ name: 'equipment-unit', params: { id: row.id } })"
      @update:page="value => store.setPage(value)"
    >
      <template #col-status="{ row }">
        <DlStatusChip :map="EQUIPMENT_STATUS" :status="String(row.status)" />
      </template>
    </DlDataTable>

    <EquipmentFormDialog v-model:open="editing.open" :equipment="editing.target" />

    <ImportDialog
      v-model:open="importing"
      :columns="IMPORT_COLUMNS"
      :description="t('equipment.importDescription')"
      :title="t('equipment.import')"
      :upload="store.importCsv"
    />

    <DlConfirmDialog
      v-model="retirement.open"
      :confirm-label="t('equipment.retire')"
      destructive
      :error="retirement.error"
      :message="retirement.target ? t('equipment.retireMessage', { code: retirement.target.code }) : ''"
      :processing="retirement.processing"
      :title="t('equipment.retireTitle')"
      @confirm="retire"
    />

    <DlConfirmDialog
      v-model="reactivation.open"
      :confirm-label="t('equipment.reactivate')"
      :error="reactivation.error"
      :message="reactivation.target ? t('equipment.reactivateMessage', { code: reactivation.target.code }) : ''"
      :processing="reactivation.processing"
      :title="t('equipment.reactivateTitle')"
      @confirm="reactivate"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Equipment, EquipmentStatus } from '@/types/krloc'
  import {
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlPageHeader,
    DlSelect,
    DlStatusChip,
    DlTextField,
    type HeaderAction,
    inferColumns,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import EquipmentFormDialog from '@/components/EquipmentFormDialog.vue'
  import ImportDialog from '@/components/ImportDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { CONTRACT_EQUIPMENT_STATUS, EQUIPMENT_STATUS } from '@/constants/status'
  import { useEquipmentStore } from '@/stores/equipment'
  import { formatMoney, queryString, unitCode } from '@/utils/format'
  import { asOption, asText } from '@/utils/forms'

  const IMPORT_COLUMNS = ['name', 'code', 'p_diary', 'p_weekly', 'p_biweekly', 'p_monthly', 'p_indemnity', 'status']

  const { t, locale } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const store = useEquipmentStore()

  interface EquipmentRow extends Record<string, unknown> {
    id: string
    code: string
    name: string
    status: EquipmentStatus
    p_diary: number
    p_monthly: number | null
    accessories: number
  }

  const byId = computed(() => new Map(store.rows.map(item => [item.id, item])))

  const rows = computed<EquipmentRow[]>(() =>
    store.rows.map(item => ({
      id: item.id,
      code: unitCode(item.code, item.suffix),
      name: item.name,
      status: item.status,
      p_diary: item.p_diary,
      p_monthly: item.p_monthly,
      accessories: item.equipmentAccessories?.length ?? 0,
    })),
  )

  const columns = computed(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      locale: locale.value,
      overrides: {
        code: { label: t('equipment.code'), mono: true, width: '140px' },
        name: { label: t('common.name') },
        status: { label: t('common.status'), width: '160px' },
        p_diary: { label: t('rates.daily'), align: 'end', width: '130px', format: row => formatMoney(row.p_diary as number) },
        p_monthly: { label: t('rates.monthly'), align: 'end', width: '140px', format: row => formatMoney(row.p_monthly as number | null) },
        accessories: { label: t('nav.accessories'), align: 'end', width: '120px', secondary: true },
      },
    }),
  )

  const statusOptions = computed(() =>
    (Object.keys(EQUIPMENT_STATUS) as EquipmentStatus[]).map(value => ({ title: EQUIPMENT_STATUS[value].label, value })),
  )

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'import', label: t('equipment.import'), icon: 'mdi-file-upload-outline', method: 'POST', path: '/equipment/upload', variant: 'outlined' },
    { key: 'create', label: t('equipment.register'), icon: 'mdi-plus', method: 'POST', path: '/equipment' },
  ])

  const rowActions = computed<RowAction<EquipmentRow>[]>(() => [
    {
      key: 'edit',
      label: t('common.edit'),
      icon: 'mdi-pencil-outline',
      method: 'PUT',
      path: '/equipment/:id',
      unavailable: row => row.status === 'RETIRED' || CONTRACT_EQUIPMENT_STATUS.includes(row.status),
    },
    {
      key: 'retire',
      label: t('equipment.retire'),
      icon: 'mdi-archive-arrow-down-outline',
      method: 'DELETE',
      path: '/equipment/:id',
      color: 'error',
      unavailable: row => row.status === 'RETIRED' || CONTRACT_EQUIPMENT_STATUS.includes(row.status),
    },
    ...(rows.value.some(row => row.status === 'RETIRED')
      ? [{
        key: 'reactivate',
        label: t('equipment.reactivate'),
        icon: 'mdi-archive-arrow-up-outline',
        method: 'POST',
        path: '/equipment/reactivate/:id',
        color: 'success',
        unavailable: (row: EquipmentRow) => row.status !== 'RETIRED',
      }]
      : []),
  ])

  const term = ref(store.search)
  const status = ref<EquipmentStatus | null>(null)
  const filtered = computed(() => !!term.value.trim() || !!status.value)

  let timer: ReturnType<typeof setTimeout> | undefined

  function onSearch (value: unknown): void {
    term.value = asText(value)
    clearTimeout(timer)
    timer = setTimeout(() => {
      void store.applySearch(term.value, status.value)
    }, FILTER_DEBOUNCE_MS)
  }

  function onStatus (value: unknown): void {
    status.value = asOption(value) as EquipmentStatus | null

    const { status: _previous, ...query } = route.query

    void router.replace({ query: status.value ? { ...query, status: status.value } : query })
    void store.applySearch(term.value, status.value)
  }

  onBeforeUnmount(() => clearTimeout(timer))

  onMounted(() => {
    const requested = queryString(route.query.status)

    status.value = requested && requested in EQUIPMENT_STATUS ? requested as EquipmentStatus : null
    void store.applySearch(term.value, status.value)
  })

  const editing = reactive({ open: false, target: shallowRef<Equipment | null>(null) })
  const importing = ref(false)
  const retirement = useConfirm<EquipmentRow>()
  const reactivation = useConfirm<EquipmentRow>()

  function onHeaderAction (key: string): void {
    if (key === 'create') {
      editing.target = null
      editing.open = true
    } else if (key === 'import') {
      importing.value = true
    }
  }

  function onRowAction (key: string, row: EquipmentRow): void {
    switch (key) {
      case 'edit': {
        editing.target = byId.value.get(row.id) ?? null
        editing.open = true

        break
      }
      case 'retire': {
        retirement.ask(row)

        break
      }
      case 'reactivate': {
        reactivation.ask(row)

        break
      }
    // No default
    }
  }

  async function retire (): Promise<void> {
    const ok = await retirement.confirm(row => store.retire(row.id))

    if (ok) {
      toast.success(t('equipment.retired'))
    }
  }

  async function reactivate (): Promise<void> {
    const ok = await reactivation.confirm(row => store.reactivate(row.id))

    if (ok) {
      toast.success(t('equipment.reactivated'))
    }
  }
</script>
