<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.operation') }, { label: t('nav.contracts') }]"
      :description="t('contracts.description')"
      :title="t('nav.contracts')"
      :with-menu="false"
      @action="creating = true"
    />

    <div class="toolbar">
      <DlSelect
        :label="t('common.status')"
        :model-value="status"
        :options="statusOptions"
        :placeholder="t('common.allStatuses')"
        @update:model-value="onStatus"
      />

      <DlTextField
        icon="mdi-magnify"
        :label="t('contracts.equipmentSearch')"
        :model-value="equipmentName"
        :placeholder="t('contracts.equipmentSearchPlaceholder')"
        :reserve-error="false"
        @update:model-value="onEquipmentName"
      />
    </div>

    <DlEmptyState
      v-if="store.error && !store.loaded"
      :description="store.error"
      icon="mdi-cloud-alert-outline"
      :title="t('contracts.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="store.load()">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :columns="columns"
      :empty-description="status || equipmentName.trim() ? t('contracts.emptySearch') : t('contracts.emptyDescription')"
      :empty-title="t('contracts.emptyTitle')"
      :limit="store.limit"
      :loading="store.loading && !store.loaded"
      :page="store.page"
      :rows="rows"
      @row-click="row => router.push({ name: 'contract', params: { id: row.id } })"
      @update:page="value => store.setPage(value)"
    >
      <template #col-status="{ row }">
        <DlStatusChip :map="LEASE_STATUS" :status="String(row.status)" />
      </template>

      <template #col-end="{ row }">
        <span :class="{ 'text-error': row.overdue }">{{ row.end }}</span>
      </template>
    </DlDataTable>

    <ContractFormDialog v-model:open="creating" @created="onCreated" />
  </div>
</template>

<script lang="ts" setup>
  import type { Contract, LeaseStatus } from '@/types/krloc'
  import {
    DlButton,
    DlDataTable,
    DlEmptyState,
    DlPageHeader,
    DlSelect,
    DlStatusChip,
    DlTextField,
    type HeaderAction,
    inferColumns,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import ContractFormDialog from '@/components/ContractFormDialog.vue'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { LEASE_STATUS } from '@/constants/status'
  import { useContractsStore } from '@/stores/contracts'
  import { daysUntil, formatDate, queryString } from '@/utils/format'
  import { asOption, asText } from '@/utils/forms'

  const { t, locale } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const store = useContractsStore()

  interface ContractRow extends Record<string, unknown> {
    id: string
    lessee: string
    client: string
    start: string
    end: string
    status: LeaseStatus
    items: number
    overdue: boolean
  }

  const rows = computed<ContractRow[]>(() =>
    store.rows.map((contract: Contract) => ({
      id: contract.id,
      lessee: contract.lessee?.name ?? '—',
      client: contract.lessee?.client?.name ?? '—',
      start: formatDate(contract.startDate),
      end: formatDate(contract.endDate),
      status: contract.status,
      items: contract.leaseItems?.length ?? 0,
      overdue: contract.status === 'ACTIVE' && daysUntil(contract.endDate) < 0,
    })),
  )

  const columns = computed(() =>
    inferColumns(rows.value, {
      omit: ['id', 'overdue'],
      locale: locale.value,
      overrides: {
        lessee: { label: t('contracts.lessee') },
        client: { label: t('lessees.client'), secondary: true },
        start: { label: t('contracts.start'), width: '130px' },
        end: { label: t('contracts.end'), width: '130px' },
        status: { label: t('common.status'), width: '150px' },
        items: { label: t('nav.equipment'), align: 'end', width: '120px' },
      },
    }),
  )

  const statusOptions = computed(() =>
    (Object.keys(LEASE_STATUS) as LeaseStatus[]).map(value => ({ title: LEASE_STATUS[value].label, value })),
  )

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'create', label: t('contracts.new'), icon: 'mdi-file-document-plus-outline', method: 'POST', path: '/elease' },
  ])

  const status = ref<LeaseStatus | null>(null)
  const equipmentName = ref('')

  function apply (): Promise<void> {
    return store.applyFilters({
      status: status.value ?? undefined,
      equipmentName: equipmentName.value.trim() || undefined,
    })
  }

  function onStatus (value: unknown): void {
    status.value = asOption(value) as LeaseStatus | null

    const { status: _previous, ...query } = route.query

    void router.replace({ query: status.value ? { ...query, status: status.value } : query })
    void apply()
  }

  let timer: ReturnType<typeof setTimeout> | undefined

  function onEquipmentName (value: unknown): void {
    equipmentName.value = asText(value)
    clearTimeout(timer)
    timer = setTimeout(() => void apply(), FILTER_DEBOUNCE_MS)
  }

  onBeforeUnmount(() => clearTimeout(timer))

  onMounted(() => {
    const requested = queryString(route.query.status)

    status.value = requested && requested in LEASE_STATUS ? requested as LeaseStatus : null
    equipmentName.value = store.filters.equipmentName ?? ''
    void apply()
  })

  const creating = ref(false)

  function onCreated (contract: Contract): void {
    void router.push({ name: 'contract', params: { id: contract.id } })
  }
</script>
