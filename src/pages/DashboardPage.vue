<template>
  <div class="page">
    <DlPageHeader
      :description="t('dashboard.description')"
      :title="greeting"
      :with-menu="false"
    />

    <section v-if="stats.length > 0" :aria-label="t('dashboard.totals')" class="stats">
      <DlStatCard
        v-for="stat in stats"
        :key="stat.key"
        :hint="stat.hint"
        :icon="stat.icon"
        :interactive="!!stat.to"
        :label="stat.label"
        :loading="stat.loading"
        :tone="stat.tone"
        :value="stat.value"
        @select="stat.to && router.push(stat.to)"
      />
    </section>

    <DlEmptyState
      v-else
      :description="t('dashboard.nothingDescription')"
      icon="mdi-eye-off-outline"
      :title="t('dashboard.nothingTitle')"
    />

    <section v-if="canContracts || canEquipment" :aria-label="t('dashboard.charts')" class="charts">
      <DlChartFrame
        v-if="canEquipment"
        :description="t('counts.equipment', equipment.length)"
        :empty="equipmentState.ready && (equipment.length === 0 || !!equipmentState.error)"
        :empty-message="equipmentState.error ?? t('dashboard.fleet.empty')"
        :loading="equipmentState.loading"
        :series="fleetSeries"
        :table-headers="[t('common.status'), t('nav.equipment'), t('dashboard.share')]"
        :table-rows="fleetRows"
        :title="t('dashboard.fleet.title')"
      >
        <DlDonutChart :data="fleetSlices" :total-label="t('nav.equipment')" />

        <template #loading>
          <div class="chart-placeholder">
            <DlSkeleton variant="circle" width="160px" />
          </div>
        </template>
      </DlChartFrame>

      <DlChartFrame
        v-if="canContracts"
        :description="t('counts.contracts', contracts.length)"
        :empty="contractsState.ready && (contracts.length === 0 || !!contractsState.error)"
        :empty-message="contractsState.error ?? t('dashboard.contracts.empty')"
        :loading="contractsState.loading"
        :series="contractSeries"
        :table-headers="[t('common.status'), t('nav.contracts')]"
        :table-rows="contractRows"
        :title="t('dashboard.contracts.title')"
      >
        <DlBarChart :data="contractBars" />

        <template #loading>
          <DlSkeleton height="22px" :lines="4" />
        </template>
      </DlChartFrame>

      <DlChartFrame
        v-if="canContracts"
        class="charts__wide"
        :description="t('dashboard.growth.description')"
        :empty="contractsState.ready && (contracts.length === 0 || !!contractsState.error)"
        :empty-message="contractsState.error ?? t('dashboard.contracts.empty')"
        :loading="contractsState.loading"
        :series="growthSeries"
        :table-headers="[t('dashboard.growth.month'), t('dashboard.growth.title')]"
        :table-rows="growthRows"
        :title="t('dashboard.growth.title')"
      >
        <DlAreaChart filled :labels="months.map(month => month.label)" :series="growthSeries" />

        <template #loading>
          <DlSkeleton height="180px" variant="block" />
        </template>
      </DlChartFrame>
    </section>

    <DlSectionCard
      v-if="canContracts"
      :count="dueSoon.length"
      :description="t('dashboard.due.description', { days: DUE_SOON_DAYS })"
      :padded="!contractsState.ready || dueSoon.length === 0"
      :title="t('dashboard.due.title')"
    >
      <DlSkeleton v-if="contractsState.loading" height="36px" :lines="3" />

      <DlEmptyState
        v-else-if="dueSoon.length === 0"
        compact
        :description="t('dashboard.due.emptyDescription')"
        icon="mdi-calendar-check-outline"
        :title="t('dashboard.due.emptyTitle')"
        tone="success"
      />

      <DlDataTable
        v-else
        bare
        :columns="dueColumns"
        :limit="dueSoon.length + 1"
        :paged="false"
        :rows="dueSoon"
        @row-click="row => router.push({ name: 'contract', params: { id: row.id } })"
      >
        <template #col-when="{ row }">
          <span :class="row.overdue ? 'text-error' : 'text-warning'">{{ row.when }}</span>
        </template>
      </DlDataTable>
    </DlSectionCard>

    <DlSectionCard
      v-if="canContracts"
      :count="waiting.length"
      :description="t('dashboard.waiting.description')"
      :padded="!contractsState.ready || waiting.length === 0"
      :title="t('dashboard.waiting.title')"
    >
      <DlSkeleton v-if="contractsState.loading" height="36px" :lines="2" />

      <DlEmptyState
        v-else-if="waiting.length === 0"
        compact
        :description="t('dashboard.waiting.emptyDescription')"
        icon="mdi-check-all"
        :title="t('dashboard.waiting.emptyTitle')"
        tone="success"
      />

      <DlDataTable
        v-else
        bare
        :columns="waitingColumns"
        :limit="waiting.length + 1"
        :paged="false"
        :rows="waiting"
        @row-click="row => router.push({ name: 'contract', params: { id: row.id } })"
      />
    </DlSectionCard>
  </div>
</template>

<script lang="ts" setup>
  import type { EquipmentStatus, LeaseStatus } from '@/types/krloc'
  import {
    type Column,
    DlAreaChart,
    DlBarChart,
    DlChartFrame,
    DlDataTable,
    DlDonutChart,
    DlEmptyState,
    DlPageHeader,
    DlSectionCard,
    DlSkeleton,
    DlStatCard,
    seriesColor,
    type StatusTone,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { DUE_SOON_DAYS, LOOKUP_LIMIT, STAT_CARD_MIN_WIDTH } from '@/constants/layout'
  import { EQUIPMENT_STATUS, LEASE_STATUS } from '@/constants/status'
  import { COLORS, type ResolvedTheme } from '@/constants/theme'
  import { errorMessage } from '@/services/http'
  import { type LookupKind, useLookupsStore } from '@/stores/lookups'
  import { usePreferencesStore } from '@/stores/preferences'
  import { useSessionStore } from '@/stores/session'
  import { daysUntil, firstName, formatDate } from '@/utils/format'

  const { t, locale } = useI18n()
  const router = useRouter()
  const session = useSessionStore()
  const lookups = useLookupsStore()
  const preferences = usePreferencesStore()

  const canContracts = computed(() => session.can('GET', '/elease'))
  const canEquipment = computed(() => session.can('GET', '/equipment'))
  const canClients = computed(() => session.can('GET', '/client'))
  const canLessees = computed(() => session.can('GET', '/lessee'))

  const greeting = computed(() => (session.me ? t('dashboard.welcome', { name: firstName(session.me.name) }) : t('nav.overview')))

  const theme = computed<ResolvedTheme>(() => (preferences.isDark ? 'dark' : 'light'))

  function stateOf (kind: LookupKind) {
    const state = lookups.state[kind]

    return {
      loading: state.loading || (!state.loaded && !state.error),
      ready: state.loaded || !!state.error,
      error: state.error,
    }
  }

  const equipmentState = computed(() => stateOf('equipment'))
  const contractsState = computed(() => stateOf('contracts'))

  const equipment = computed(() => lookups.equipment)
  const contracts = computed(() => lookups.contracts)

  const count = (length: number): number | string => (length >= LOOKUP_LIMIT ? `${LOOKUP_LIMIT}+` : length)

  function equipmentIn (...statuses: EquipmentStatus[]): number {
    return equipment.value.filter(item => statuses.includes(item.status)).length
  }

  const contractsIn = (status: LeaseStatus) => contracts.value.filter(contract => contract.status === status)

  interface Stat {
    key: string
    label: string
    value: number | string | null
    icon: string
    tone: 'primary' | 'success' | 'warning' | 'info' | 'neutral'
    hint?: string
    loading: boolean
    to?: string
  }

  const stats = computed<Stat[]>(() => {
    const list: Stat[] = []

    if (canContracts.value) {
      const state = contractsState.value
      const active = contractsIn('ACTIVE')
      const waitingStart = contractsIn('PENDING')
      const withoutDocument = waitingStart.filter(contract => !contract.contract_generated).length
      const overdue = dueSoon.value.filter(row => row.overdue).length
      const upcoming = dueSoon.value.length - overdue

      let activeHint = t('dashboard.stats.noneDue')

      if (overdue > 0) {
        activeHint = t('dashboard.stats.overdue', overdue)
      } else if (upcoming > 0) {
        activeHint = t('dashboard.stats.dueSoon', upcoming)
      }

      list.push(
        {
          key: 'active',
          label: t('dashboard.stats.active'),
          value: state.error ? null : count(active.length),
          icon: 'mdi-play-circle-outline',
          tone: 'success',
          hint: activeHint,
          loading: state.loading,
          to: '/contracts?status=ACTIVE',
        },
        {
          key: 'pending',
          label: t('dashboard.stats.pending'),
          value: state.error ? null : count(waitingStart.length),
          icon: 'mdi-clock-outline',
          tone: 'warning',
          hint: withoutDocument > 0 ? t('dashboard.stats.withoutDocument', withoutDocument) : undefined,
          loading: state.loading,
          to: '/contracts?status=PENDING',
        },
      )
    }

    if (canEquipment.value) {
      const state = equipmentState.value

      list.push(
        {
          key: 'available',
          label: t('dashboard.stats.available'),
          value: state.error ? null : count(equipmentIn('AVAILABLE')),
          icon: 'mdi-check-circle-outline',
          tone: 'primary',
          hint: t('dashboard.stats.registered', { count: count(equipment.value.length) }),
          loading: state.loading,
          to: '/equipment?status=AVAILABLE',
        },
        {
          key: 'out',
          label: t('dashboard.stats.out'),
          value: state.error ? null : count(equipmentIn('LEASED', 'REPLACE')),
          icon: 'mdi-truck-outline',
          tone: 'info',
          hint: t('dashboard.stats.maintenance', equipmentIn('MAINTENANCE')),
          loading: state.loading,
          to: '/equipment?status=LEASED',
        },
      )
    }

    if (canClients.value) {
      const state = stateOf('clients')

      list.push({
        key: 'clients',
        label: t('nav.clients'),
        value: state.error ? null : count(lookups.clients.length),
        icon: 'mdi-domain',
        tone: 'neutral',
        hint: canLessees.value && lookups.state.lessees.loaded ? t('counts.lessees', lookups.lessees.length) : undefined,
        loading: state.loading,
        to: '/clients',
      })
    }

    return list
  })

  const TONE_COLOR: Record<StatusTone, keyof typeof COLORS.light> = {
    success: 'success',
    info: 'info',
    warning: 'warning',
    error: 'error',
    neutral: 'onSurfaceMuted',
    dark: 'onSurface',
  }

  const share = (value: number, total: number): string => (total > 0 ? `${((value / total) * 100).toFixed(0)}%` : '0%')

  const fleetCounts = computed(() =>
    (Object.keys(EQUIPMENT_STATUS) as EquipmentStatus[]).map(status => ({
      status,
      label: EQUIPMENT_STATUS[status].label,
      value: equipmentIn(status),
      color: COLORS[theme.value][TONE_COLOR[EQUIPMENT_STATUS[status].tone]],
    })),
  )

  const fleetSlices = computed(() => fleetCounts.value.filter(item => item.value > 0))

  const fleetSeries = computed(() =>
    fleetSlices.value.map(item => ({ label: item.label, color: item.color, value: `${item.value} · ${share(item.value, equipment.value.length)}` })),
  )

  const fleetRows = computed(() =>
    fleetCounts.value.map(item => [item.label, String(item.value), share(item.value, equipment.value.length)]),
  )

  const contractBars = computed(() =>
    (Object.keys(LEASE_STATUS) as LeaseStatus[]).map(status => ({
      label: LEASE_STATUS[status].label,
      value: contractsIn(status).length,
      color: COLORS[theme.value][TONE_COLOR[LEASE_STATUS[status].tone]],
    })),
  )

  const contractSeries = computed(() => contractBars.value.map(bar => ({ label: bar.label, color: bar.color })))

  const contractRows = computed(() => contractBars.value.map(bar => [bar.label, String(bar.value)]))

  const months = computed(() => {
    const now = new Date()
    const MONTH = new Intl.DateTimeFormat(locale.value, { month: 'short' })
    const MONTH_YEAR = new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric' })

    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)

      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: MONTH.format(date), long: MONTH_YEAR.format(date) }
    })
  })

  const growthValues = computed(() =>
    months.value.map(month =>
      contracts.value.filter(contract => {
        const start = new Date(contract.startDate)

        return `${start.getFullYear()}-${start.getMonth()}` === month.key
      }).length,
    ),
  )

  const growthSeries = computed(() => [
    { label: t('nav.contracts'), color: seriesColor(0, preferences.isDark), values: growthValues.value },
  ])

  const growthRows = computed(() => months.value.map((month, index) => [month.long, String(growthValues.value[index] ?? 0)]))

  interface DueRow extends Record<string, unknown> {
    id: string
    lessee: string
    client: string
    end: string
    when: string
    overdue: boolean
  }

  const dueSoon = computed<DueRow[]>(() =>
    contractsIn('ACTIVE')
      .map(contract => ({ contract, days: daysUntil(contract.endDate) }))
      .filter(({ days }) => days <= DUE_SOON_DAYS)
      .toSorted((a, b) => a.days - b.days)
      .map(({ contract, days }) => ({
        id: contract.id,
        lessee: contract.lessee?.name ?? '—',
        client: contract.lessee?.client?.name ?? '—',
        end: formatDate(contract.endDate),
        when: days < 0 ? t('dashboard.due.overdue', -days) : t('dashboard.due.inDays', days),
        overdue: days < 0,
      })),
  )

  const dueColumns = computed<Column<DueRow>[]>(() => [
    { key: 'lessee', label: t('contracts.lessee') },
    { key: 'client', label: t('lessees.client'), secondary: true },
    { key: 'end', label: t('contracts.end'), width: '140px' },
    { key: 'when', label: t('dashboard.due.when'), width: '180px' },
  ])

  interface WaitingRow extends Record<string, unknown> {
    id: string
    lessee: string
    start: string
    document: string
  }

  const waiting = computed<WaitingRow[]>(() =>
    contractsIn('PENDING').map(contract => ({
      id: contract.id,
      lessee: contract.lessee?.name ?? '—',
      start: formatDate(contract.startDate),
      document: contract.contract_generated ? formatDate(contract.contract_generated) : t('dashboard.waiting.noDocument'),
    })),
  )

  const waitingColumns = computed<Column<WaitingRow>[]>(() => [
    { key: 'lessee', label: t('contracts.lessee') },
    { key: 'start', label: t('contracts.start'), width: '140px' },
    { key: 'document', label: t('contract.document'), width: '200px' },
  ])

  onMounted(async () => {
    const kinds: LookupKind[] = [
      ...(canContracts.value ? ['contracts' as const] : []),
      ...(canEquipment.value ? ['equipment' as const] : []),
      ...(canClients.value ? ['clients' as const] : []),
      ...(canLessees.value ? ['lessees' as const] : []),
    ]

    const results = await Promise.allSettled(kinds.map(kind => lookups.ensure(kind, true)))
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')

    if (failure) {
      toast.error(t('dashboard.loadFailed'), { description: errorMessage(failure.reason) })
    }
  })
</script>

<style scoped>
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.stats > * {
  flex: 1 1 v-bind(STAT_CARD_MIN_WIDTH);
  min-width: 0;
}

.charts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.charts > * {
  flex: 1 1 320px;
  min-width: 0;
}

.charts__wide {
  flex-basis: 100%;
}

.chart-placeholder {
  display: grid;
  place-items: center;
  padding: 12px 0;
}
</style>
