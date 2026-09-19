<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :description="t('financial.closing.description')"
      :title="t('pageTitles.closing')"
      :with-menu="false"
      @action="onAction"
    />

    <div class="toolbar">
      <DlSelect
        :clearable="false"
        :label="t('financial.closing.month')"
        :model-value="month"
        :options="monthOptions"
        @update:model-value="onMonth"
      />
    </div>

    <DlEmptyState
      v-if="loadError && !closing"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('financial.closing.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <template v-else>
      <p v-if="closing && partial" class="note">
        <VIcon icon="mdi-progress-clock" size="18" />
        <span>{{ t('financial.closing.partial', { date: formatDateTime(closing.asOf) }) }}</span>
      </p>

      <section :aria-label="t('financial.closing.summary')" class="stats">
        <DlStatCard
          v-for="stat in stats"
          :key="stat.key"
          :format="stat.money ? formatMoney : undefined"
          :hint="stat.hint"
          :icon="stat.icon"
          :interactive="!!stat.tab"
          :label="stat.label"
          :loading="loading"
          :tone="stat.tone"
          :value="stat.value"
          @select="stat.tab && selectTab(stat.tab)"
        />
      </section>

      <DlTabs v-model="tab" :tabs="tabs">
        <template #closed>
          <DlSectionCard :description="t('financial.closing.closed.description')" :padded="false" :title="t('financial.closing.closed.title')">
            <DlDataTable
              bare
              :columns="closedColumns"
              :empty-description="t('financial.closing.closed.emptyDescription')"
              :empty-title="t('financial.closing.closed.emptyTitle')"
              :limit="closedRows.length + 1"
              :loading="loading"
              :paged="false"
              :rows="closedRows"
              @row-click="row => openContract(row.contractId)"
            />
          </DlSectionCard>
        </template>

        <template #active>
          <DlSectionCard :description="t('financial.closing.active.description')" :padded="false" :title="t('financial.closing.active.title')">
            <DlDataTable
              bare
              :columns="activeColumns"
              :empty-description="t('financial.closing.active.emptyDescription')"
              :empty-title="t('financial.closing.active.emptyTitle')"
              :limit="activeRows.length + 1"
              :loading="loading"
              :paged="false"
              :rows="activeRows"
              @row-click="row => openContract(row.contractId)"
            >
              <template #col-plannedEnd="{ row }">
                <span :class="{ 'text-error': row.overdue }">{{ row.plannedEnd }}</span>
              </template>
            </DlDataTable>
          </DlSectionCard>
        </template>

        <template #onSite>
          <DlSectionCard :description="t('financial.closing.onSite.description')" :padded="false" :title="t('financial.closing.onSite.title')">
            <DlDataTable
              bare
              :columns="onSiteColumns"
              :empty-description="t('financial.closing.onSite.emptyDescription')"
              :empty-title="t('financial.closing.onSite.emptyTitle')"
              :limit="onSiteRows.length + 1"
              :loading="loading"
              :paged="false"
              :rows="onSiteRows"
              @row-click="row => openContract(row.contractId)"
            />
          </DlSectionCard>
        </template>

        <template #maintenance>
          <DlSectionCard :description="t('financial.closing.maintenance.description')" :padded="false" :title="t('financial.closing.maintenance.title')">
            <DlDataTable
              bare
              :columns="maintenanceColumns"
              :empty-description="t('financial.closing.maintenance.emptyDescription')"
              :empty-title="t('financial.closing.maintenance.emptyTitle')"
              :limit="maintenanceRows.length + 1"
              :loading="loading"
              :paged="false"
              :rows="maintenanceRows"
              @row-click="row => openContract(row.contractId)"
            />
          </DlSectionCard>
        </template>

        <template #stolen>
          <DlSectionCard :description="t('financial.closing.stolen.description')" :padded="false" :title="t('financial.closing.stolen.title')">
            <DlDataTable
              bare
              :columns="stolenColumns"
              :empty-description="t('financial.closing.stolen.emptyDescription')"
              :empty-title="t('financial.closing.stolen.emptyTitle')"
              :limit="stolenRows.length + 1"
              :loading="loading"
              :paged="false"
              :rows="stolenRows"
              @row-click="row => openContract(row.contractId)"
            />
          </DlSectionCard>
        </template>
      </DlTabs>
    </template>
  </div>
</template>

<script lang="ts" setup>
  import type { MonthlyClosing } from '@/types/krloc'
  import {
    type Column,
    DlButton,
    DlDataTable,
    DlEmptyState,
    DlPageHeader,
    DlSectionCard,
    DlSelect,
    DlStatCard,
    DlTabs,
    type HeaderAction,
    type TabItem,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, shallowRef, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { STAT_CARD_MIN_WIDTH } from '@/constants/layout'
  import { errorMessage } from '@/services/http'
  import { useFinancialStore } from '@/stores/financial'
  import { useSessionStore } from '@/stores/session'
  import { saveDocument } from '@/utils/files'
  import { formatDate, formatDateTime, formatMoney, queryString } from '@/utils/format'
  import { asOption } from '@/utils/forms'
  import { currentMonth, isMonth, monthLabel, recentMonths } from '@/utils/months'

  /**
   * O fechamento do mes, pelas clausulas do contrato: o que fechou e quanto se
   * cobra, os contratos que atravessaram o fim do mes ainda ativos, com o que
   * correu ate la, e a frota na obra, em manutencao e roubada.
   *
   * O mes fica na URL: o link leva ao mesmo fechamento, e voltar no navegador
   * volta ao mes anterior.
   */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const store = useFinancialStore()

  /** Quantos meses o seletor oferece, do atual para tras. */
  const MONTHS_OFFERED = 24

  const month = computed(() => {
    const requested = queryString(route.query.month)

    return isMonth(requested) && requested <= currentMonth() ? requested : currentMonth()
  })

  const monthOptions = computed(() => {
    const months = recentMonths(MONTHS_OFFERED)

    // Mes mais antigo pedido pela URL tambem aparece, senao o seletor ficaria vazio.
    if (!months.includes(month.value)) {
      months.push(month.value)
    }

    return months.map(value => ({ title: monthLabel(value), value }))
  })

  function onMonth (value: unknown): void {
    const next = asOption(value)

    if (next && next !== month.value) {
      void router.push({ query: { ...route.query, month: next } })
    }
  }

  /* -------------------------------- carga -------------------------------- */

  const closing = shallowRef<MonthlyClosing | null>(null)
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  /** Trocar de mes no meio de um pedido nao deixa o pedido velho vencer. */
  let latest = 0

  async function load (): Promise<void> {
    const ticket = ++latest

    loading.value = true
    loadError.value = null

    try {
      const result = await store.closing(month.value)

      if (ticket === latest) {
        closing.value = result
      }
    } catch (error) {
      if (ticket === latest) {
        closing.value = null
        loadError.value = errorMessage(error)
      }
    } finally {
      if (ticket === latest) {
        loading.value = false
      }
    }
  }

  // Sair da tela tira o `month` da URL: o pedido so parte enquanto ela e a tela aberta.
  watch(month, () => {
    if (route.name === 'closing') {
      void load()
    }
  }, { immediate: true })

  /** Mes em curso: ativos e frota contados ate agora, nao ate o fim do mes. */
  const partial = computed(() => !!closing.value && new Date(closing.value.asOf).getTime() < new Date(closing.value.to).getTime() - 1000)

  /* ------------------------------ indicadores ----------------------------- */

  const tab = ref('closed')

  function selectTab (key: string): void {
    tab.value = key
  }

  interface Stat {
    key: string
    label: string
    value: number | null
    money: boolean
    icon: string
    tone: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
    hint?: string
    /** A aba que o cartao abre. */
    tab?: string
  }

  const stats = computed<Stat[]>(() => {
    const summary = closing.value?.summary

    if (!summary) {
      return [
        { key: 'billed', label: t('financial.closing.stats.billed'), value: null, money: true, icon: 'mdi-cash-check', tone: 'success' },
        { key: 'active', label: t('financial.closing.stats.active'), value: null, money: false, icon: 'mdi-play-circle-outline', tone: 'info' },
        { key: 'accrued', label: t('financial.closing.stats.accrued'), value: null, money: true, icon: 'mdi-calendar-range', tone: 'primary' },
        { key: 'onSite', label: t('financial.closing.stats.onSite'), value: null, money: false, icon: 'mdi-truck-outline', tone: 'neutral' },
      ]
    }

    return [
      {
        key: 'billed',
        label: t('financial.closing.stats.billed'),
        value: summary.billed,
        money: true,
        icon: 'mdi-cash-check',
        tone: 'success',
        hint: t('financial.closing.stats.billedHint', summary.closedContracts),
        tab: 'closed',
      },
      {
        // Os roubos do mes, com contrato fechado ou nao: o cartao conta o mesmo que a aba.
        key: 'indemnity',
        label: t('financial.closing.stats.indemnity'),
        value: summary.stolenIndemnity,
        money: true,
        icon: 'mdi-alert-octagon-outline',
        tone: summary.stolenIndemnity > 0 ? 'error' : 'neutral',
        hint: t('financial.closing.stats.stolenHint', summary.stolen),
        tab: 'stolen',
      },
      {
        key: 'active',
        label: t('financial.closing.stats.active'),
        value: summary.activeContracts,
        money: false,
        icon: 'mdi-play-circle-outline',
        tone: summary.overdueContracts > 0 ? 'warning' : 'info',
        hint: summary.overdueContracts > 0
          ? t('financial.closing.stats.overdue', summary.overdueContracts)
          : t('financial.closing.stats.noneOverdue'),
        tab: 'active',
      },
      {
        key: 'contracted',
        label: t('financial.closing.stats.contracted'),
        value: summary.activeContracted,
        money: true,
        icon: 'mdi-file-sign',
        tone: 'primary',
        hint: t('financial.closing.stats.contractedHint'),
        tab: 'active',
      },
      {
        key: 'accrued',
        label: t('financial.closing.stats.accrued'),
        value: summary.activeAccrued,
        money: true,
        icon: 'mdi-calendar-range',
        tone: 'primary',
        hint: t('financial.closing.stats.accruedHint', { date: formatDate(closing.value?.asOf) }),
        tab: 'active',
      },
      {
        key: 'onSite',
        label: t('financial.closing.stats.onSite'),
        value: summary.onSite,
        money: false,
        icon: 'mdi-truck-outline',
        tone: 'neutral',
        hint: t('financial.closing.stats.maintenanceHint', summary.maintenance),
        tab: 'onSite',
      },
    ]
  })

  const tabs = computed<TabItem[]>(() => {
    const current = closing.value

    return [
      { key: 'closed', label: t('financial.closing.tabs.closed'), icon: 'mdi-flag-checkered', count: current?.closed.length },
      { key: 'active', label: t('financial.closing.tabs.active'), icon: 'mdi-play-circle-outline', count: current?.active.length },
      { key: 'onSite', label: t('financial.closing.tabs.onSite'), icon: 'mdi-truck-outline', count: current?.onSite.length },
      { key: 'maintenance', label: t('financial.closing.tabs.maintenance'), icon: 'mdi-wrench-outline', count: current?.maintenance.length },
      { key: 'stolen', label: t('financial.closing.tabs.stolen'), icon: 'mdi-alert-octagon-outline', count: current?.stolen.length },
    ]
  })

  /* -------------------------------- tabelas ------------------------------- */

  interface ClosedRow extends Record<string, unknown> {
    id: string
    contractId: string
    lessee: string
    client: string
    start: string
    finish: string
    rental: string
    indemnity: string
    total: string
  }

  const closedRows = computed<ClosedRow[]>(() =>
    (closing.value?.closed ?? []).map(row => ({
      id: row.contractId,
      contractId: row.contractId,
      lessee: row.lessee,
      client: row.client,
      start: formatDate(row.startDate),
      finish: formatDate(row.finishDate),
      rental: formatMoney(row.rental),
      indemnity: formatMoney(row.indemnity),
      total: formatMoney(row.total),
    })),
  )

  const closedColumns = computed<Column<ClosedRow>[]>(() => [
    { key: 'lessee', label: t('contracts.lessee') },
    { key: 'client', label: t('lessees.client'), secondary: true },
    { key: 'start', label: t('contracts.start'), width: '120px', secondary: true },
    { key: 'finish', label: t('financial.closing.closed.finish'), width: '120px' },
    { key: 'rental', label: t('financial.statement.rental'), align: 'end', width: '130px', secondary: true },
    { key: 'indemnity', label: t('financial.statement.indemnity'), align: 'end', width: '130px', secondary: true },
    { key: 'total', label: t('financial.closing.closed.total'), align: 'end', width: '140px' },
  ])

  interface ActiveRow extends Record<string, unknown> {
    id: string
    contractId: string
    lessee: string
    client: string
    start: string
    plannedEnd: string
    overdue: boolean
    contracted: string
    accrued: string
  }

  const activeRows = computed<ActiveRow[]>(() =>
    (closing.value?.active ?? []).map(row => ({
      id: row.contractId,
      contractId: row.contractId,
      lessee: row.lessee,
      client: row.client,
      start: formatDate(row.startDate),
      plannedEnd: row.overdue
        ? t('financial.closing.active.overdue', { date: formatDate(row.plannedEndDate) })
        : formatDate(row.plannedEndDate),
      overdue: row.overdue,
      contracted: formatMoney(row.contracted),
      accrued: formatMoney(row.accrued),
    })),
  )

  const activeColumns = computed<Column<ActiveRow>[]>(() => [
    { key: 'lessee', label: t('contracts.lessee') },
    { key: 'client', label: t('lessees.client'), secondary: true },
    { key: 'start', label: t('contracts.start'), width: '120px', secondary: true },
    { key: 'plannedEnd', label: t('contracts.end'), width: '170px' },
    { key: 'contracted', label: t('financial.statement.contracted'), align: 'end', width: '140px' },
    { key: 'accrued', label: t('financial.closing.active.accrued'), align: 'end', width: '150px' },
  ])

  interface UnitRow extends Record<string, unknown> {
    id: string
    contractId: string
    code: string
    name: string
    lessee: string
    date: string
    extra: string
  }

  const onSiteRows = computed<UnitRow[]>(() =>
    (closing.value?.onSite ?? []).map(row => ({
      id: `${row.contractId}:${row.code}`,
      contractId: row.contractId,
      code: row.code,
      name: row.name,
      lessee: row.lessee,
      date: formatDate(row.since),
      extra: '',
    })),
  )

  const maintenanceRows = computed<UnitRow[]>(() =>
    (closing.value?.maintenance ?? []).map(row => ({
      id: `${row.contractId}:${row.code}:${row.date}`,
      contractId: row.contractId,
      code: row.code,
      name: row.name,
      lessee: row.lessee,
      date: formatDate(row.date),
      extra: row.replaced ? t('financial.closing.maintenance.replaced') : t('financial.closing.maintenance.notReplaced'),
    })),
  )

  const stolenRows = computed<UnitRow[]>(() =>
    (closing.value?.stolen ?? []).map(row => ({
      id: `${row.contractId}:${row.code}:${row.date}`,
      contractId: row.contractId,
      code: row.code,
      name: row.name,
      lessee: row.lessee,
      date: formatDate(row.date),
      extra: formatMoney(row.indemnity),
    })),
  )

  function unitColumns (dateLabel: string, extra?: Column<UnitRow>): Column<UnitRow>[] {
    return [
      { key: 'code', label: t('equipment.code'), mono: true, width: '130px' },
      { key: 'name', label: t('common.name') },
      { key: 'lessee', label: t('contracts.lessee'), secondary: true },
      { key: 'date', label: dateLabel, width: '130px' },
      ...(extra ? [extra] : []),
    ]
  }

  const onSiteColumns = computed(() => unitColumns(t('financial.closing.onSite.since')))

  const maintenanceColumns = computed(() =>
    unitColumns(t('financial.closing.maintenance.date'), { key: 'extra', label: t('financial.closing.maintenance.replacement'), width: '150px' }),
  )

  const stolenColumns = computed(() =>
    unitColumns(t('financial.closing.stolen.date'), { key: 'extra', label: t('rates.indemnity'), align: 'end', width: '140px' }),
  )

  function openContract (contractId: string): void {
    if (session.can('GET', '/elease/:id')) {
      void router.push({ name: 'contract', params: { id: contractId } })
    }
  }

  /* ------------------------------- documento ------------------------------ */

  const headerActions = computed<HeaderAction[]>(() => [
    {
      key: 'document',
      label: t('financial.closing.download'),
      icon: 'mdi-file-download-outline',
      method: 'POST',
      path: '/generate/finantial',
      variant: 'outlined',
    },
  ])

  const downloading = ref(false)

  async function download (): Promise<void> {
    if (downloading.value) {
      return
    }

    downloading.value = true

    try {
      saveDocument(await store.closingDocument(month.value), t('documents.closingFile'))
      toast.success(t('documents.downloaded'))
    } catch (error) {
      toast.error(t('documents.failed'), { description: errorMessage(error) })
    } finally {
      downloading.value = false
    }
  }

  function onAction (key: string): void {
    if (key === 'document') {
      void download()
    }
  }
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
</style>
