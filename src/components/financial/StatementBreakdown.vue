<template>
  <div class="statement">
    <section :aria-label="t('financial.statement.totals')" class="stats">
      <DlStatCard
        v-for="stat in stats"
        :key="stat.key"
        :format="formatMoney"
        :hint="stat.hint"
        :icon="stat.icon"
        :label="stat.label"
        :tone="stat.tone"
        :value="stat.value"
      />
    </section>

    <p v-if="missingPrice.length > 0" class="note note--warning">
      <VIcon icon="mdi-tag-off-outline" size="18" />
      <span>{{ t('financial.statement.missingPrice', { units: missingPrice.join(', ') }) }}</span>
    </p>

    <DlEmptyState
      v-if="panels.length === 0"
      compact
      :description="t('financial.statement.emptyDescription')"
      icon="mdi-cash-remove"
      :title="t('financial.statement.emptyTitle')"
    />

    <DlExpansion v-else v-model:open="openPanels" :panels="panels">
      <template v-for="position in positions" :key="position.key" #[position.key]>
        <p class="period">{{ position.period }}</p>

        <DlDataTable
          v-if="position.units.length > 1"
          bare
          class="units"
          :columns="unitColumns"
          :limit="position.units.length + 1"
          :paged="false"
          row-key="itemId"
          :rows="position.units"
        >
          <template #col-outcome="{ row }">
            <DlStatusChip :map="EQUIPMENT_STATUS" :status="String(row.outcome)" />
          </template>
        </DlDataTable>

        <DlDataTable
          bare
          :columns="lineColumns"
          :limit="position.lines.length + 1"
          :paged="false"
          :rows="position.lines"
        >
          <template #col-amount="{ row }">
            <strong v-if="row.subtotal">{{ row.amount }}</strong>
            <template v-else>{{ row.amount }}</template>
          </template>
        </DlDataTable>
      </template>
    </DlExpansion>

    <p class="clauses">{{ t('financial.statement.clauses') }}</p>
  </div>
</template>

<script lang="ts" setup>
  import type { ContractStatement, EquipmentStatus, PackageLine, StatementLine, StatementPosition } from '@/types/krloc'
  import {
    type Column,
    DlDataTable,
    DlEmptyState,
    DlExpansion,
    DlStatCard,
    DlStatusChip,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { STAT_CARD_MIN_WIDTH } from '@/constants/layout'
  import { EQUIPMENT_STATUS, POSITION_END } from '@/constants/status'
  import { formatDate, formatMoney } from '@/utils/format'

  /**
   * O extrato de um contrato pelas clausulas: os totais e, por equipamento, de
   * onde sai cada valor. A conta e toda da API; aqui so se escreve.
   *
   * Cada posicao e um equipamento do contrato com os substitutos que vieram
   * depois dele, cobrados como um aluguel so. A linha diz a clausula que a manda.
   */
  const props = defineProps<{
    statement: ContractStatement
    /** Resultado da calculadora: a devolucao e simulada, nao registrada. */
    simulation?: boolean
  }>()

  const { t } = useI18n()

  const days = (count: number): string => t('counts.days', count)

  /** Pendente ainda nao correu: so o contratado. Ativo corre ate hoje. */
  const pending = computed(() => props.statement.status === 'PENDING')
  const running = computed(() => props.statement.status === 'ACTIVE')

  /* -------------------------------- totais -------------------------------- */

  interface Stat {
    key: string
    label: string
    value: number
    icon: string
    tone: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
    hint?: string
  }

  const stats = computed<Stat[]>(() => {
    const { totals, plannedDays, asOf, finishDate, frozen } = props.statement

    const contracted: Stat = {
      key: 'contracted',
      label: t('financial.statement.contracted'),
      value: totals.contracted,
      icon: 'mdi-file-sign',
      tone: 'primary',
      hint: t('financial.statement.contractedHint', { days: days(plannedDays) }),
    }

    if (pending.value) {
      return [contracted]
    }

    let rentalHint: string | undefined

    if (running.value) {
      rentalHint = t('financial.statement.untilToday', { date: formatDate(asOf) })
    } else if (totals.rental > totals.contracted) {
      rentalHint = t('financial.statement.beyondContracted')
    }

    let totalHint: string | undefined

    if (props.simulation) {
      totalHint = t('financial.statement.onReturn', { date: formatDate(finishDate) })
    } else if (frozen) {
      totalHint = t('financial.statement.frozen', { date: formatDate(finishDate) })
    }

    return [
      contracted,
      {
        key: 'rental',
        label: t('financial.statement.rental'),
        value: totals.rental,
        icon: 'mdi-calendar-range',
        tone: 'info',
        hint: rentalHint,
      },
      {
        key: 'indemnity',
        label: t('financial.statement.indemnity'),
        value: totals.indemnity,
        icon: 'mdi-alert-octagon-outline',
        tone: totals.indemnity > 0 ? 'error' : 'neutral',
      },
      {
        key: 'total',
        label: running.value ? t('financial.statement.totalSoFar') : t('financial.statement.total'),
        value: totals.total,
        icon: 'mdi-cash-multiple',
        tone: 'success',
        hint: totalHint,
      },
    ]
  })

  /** Unidade sem diaria na tabela: a conta dela sai zerada, e isso precisa ser dito. */
  const missingPrice = computed(() =>
    props.statement.positions.filter(position => position.missingPrice).map(position => position.units[0]?.code ?? '—'),
  )

  /* ------------------------------- posicoes ------------------------------- */

  function packagesText (packages: PackageLine[]): string {
    return packages
      .map(line => `${t(`financial.package.${line.kind}`, line.count)} × ${formatMoney(line.unitPrice)}`)
      .join(' + ')
  }

  /** Descricao e detalhe de cada linha, com a clausula que a manda. */
  function lineText (line: StatementLine): [string, string] {
    switch (line.kind) {
      case 'contracted': {
        return [t('financial.line.contracted', { days: days(line.days) }), packagesText(line.packages)]
      }
      case 'usage': {
        return [t('financial.line.usage', { days: days(line.days) }), packagesText(line.packages)]
      }
      case 'renewal': {
        const count = line.count ?? 1
        const date = formatDate(line.from)

        return count === 1
          ? [t('financial.line.renewal', { index: line.index, date }), packagesText(line.packages)]
          : [
            t('financial.line.renewals', { first: line.index, last: line.index + count - 1, date }),
            t('financial.line.renewalsDetail', { count, packages: packagesText(line.packages) }),
          ]
      }
      case 'excess': {
        const rate = { days: days(line.days), rate: formatMoney(line.dailyRate) }

        return [
          t('financial.line.excess'),
          line.monthly === null
            ? t('financial.line.excessDaily', rate)
            : t('financial.line.excessMonthly', { ...rate, monthly: formatMoney(line.monthly) }),
        ]
      }
      case 'indemnity': {
        return [t('financial.line.indemnity', { code: line.code }), t('financial.line.indemnityDetail')]
      }
    }
  }

  interface UnitRow extends Record<string, unknown> {
    itemId: string
    code: string
    name: string
    from: string
    to: string
    outcome: EquipmentStatus
  }

  interface LineRow extends Record<string, unknown> {
    id: string
    description: string
    detail: string
    amount: string
    subtotal: boolean
  }

  /** Como a posicao se descreve fechada: dias, fim e total. Pendente so tem o contratado. */
  function summaryOf (position: StatementPosition): string {
    return pending.value
      ? [days(props.statement.plannedDays), formatMoney(position.contracted)].join(' · ')
      : [days(position.days), POSITION_END[position.end].label, formatMoney(position.total)].join(' · ')
  }

  function periodOf (position: StatementPosition): string {
    if (pending.value) {
      return t('financial.statement.plannedPeriod', {
        start: formatDate(props.statement.startDate),
        end: formatDate(props.statement.plannedEndDate),
      })
    }

    const range = { start: formatDate(position.start), end: formatDate(position.endDate), days: days(position.days) }

    return position.end === 'open' ? t('financial.statement.periodOpen', range) : t('financial.statement.period', range)
  }

  const positions = computed(() =>
    props.statement.positions.map((position, index) => {
      const [first] = position.units
      const codes = position.units.map(unit => unit.code).join(' → ')

      return {
        key: first?.itemId ?? `position-${index}`,
        title: `${codes} · ${first?.name ?? ''}`,
        summary: summaryOf(position),
        icon: pending.value ? 'mdi-file-sign' : POSITION_END[position.end].icon,
        period: periodOf(position),
        units: position.units.map<UnitRow>((unit, unitIndex) => ({
          itemId: unit.itemId,
          code: unit.code,
          name: unit.name,
          from: formatDate(unit.start),
          to: unit.end ? formatDate(unit.end) : t('financial.statement.onSite'),
          // Sem volta, o original esta locado e o substituto, como substituto.
          outcome: unit.finalStatus ?? (unitIndex === 0 ? 'LEASED' : 'REPLACE'),
        })),
        lines: [
          ...position.lines.map<LineRow>((line, lineIndex) => {
            const [description, detail] = lineText(line)

            return { id: String(lineIndex), description, detail, amount: formatMoney(line.amount), subtotal: false }
          }),
          {
            id: 'subtotal',
            description: t('financial.statement.positionTotal'),
            detail: '',
            amount: formatMoney(pending.value ? position.contracted : position.total),
            subtotal: true,
          },
        ],
      }
    }),
  )

  const panels = computed(() =>
    positions.value.map(({ key, title, summary, icon }) => ({ key, title, summary, icon })),
  )

  // Um equipamento so: aberto, que nao ha o que escolher.
  const openPanels = ref<string[]>([])

  watch(panels, current => {
    if (current.length === 1 && current[0]) {
      openPanels.value = [current[0].key]
    }
  }, { immediate: true })

  const unitColumns = computed<Column<UnitRow>[]>(() => [
    { key: 'code', label: t('equipment.code'), mono: true, width: '130px' },
    { key: 'name', label: t('common.name'), secondary: true },
    { key: 'from', label: t('financial.statement.from'), width: '130px' },
    { key: 'to', label: t('financial.statement.to'), width: '130px' },
    { key: 'outcome', label: t('common.status'), width: '150px' },
  ])

  const lineColumns = computed<Column<LineRow>[]>(() => [
    { key: 'description', label: t('financial.statement.description') },
    { key: 'detail', label: t('financial.statement.detail'), secondary: true },
    { key: 'amount', label: t('financial.statement.amount'), align: 'end', width: '140px' },
  ])
</script>

<style scoped>
.statement {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.stats > * {
  flex: 1 1 v-bind(STAT_CARD_MIN_WIDTH);
  min-width: 0;
}

.period {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--dl-on-surface-muted);
}

.units {
  margin-bottom: 12px;
}

.clauses {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dl-on-surface-muted);
}
</style>
