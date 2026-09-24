<template>
  <div class="page">
    <DlPageHeader
      :description="t('financial.calculator.description')"
      :title="t('pageTitles.calculator')"
      :with-menu="false"
    />

    <DlEmptyState
      v-if="!canEquipment"
      :description="t('financial.calculator.noEquipmentAccess')"
      icon="mdi-eye-off-outline"
      :title="t('financial.calculator.noEquipmentTitle')"
    />

    <template v-else>
      <DlSectionCard :description="t('financial.calculator.contractDescription')" :title="t('financial.calculator.contract')">
        <div class="calculator">
          <DlSelect
            :error="state.attempted && state.form.equipments.length === 0 ? t('financial.calculator.chooseEquipment') : null"
            :hint="t('financial.calculator.equipmentHint')"
            :label="t('nav.equipment')"
            :loading="lookups.state.equipment.loading"
            :model-value="state.form.equipments"
            multiple
            :options="equipmentOptions"
            required
            searchable
            @update:model-value="value => onEquipments(asOptions(value))"
          />

          <div class="form-grid">
            <DlTextField
              :error="state.attempted ? startProblem : null"
              :label="t('contracts.start')"
              :model-value="state.form.startDate"
              required
              type="date"
              @update:model-value="value => onStart(asText(value))"
            />

            <DlTextField
              :error="plannedEndError"
              :hint="plannedDays === null ? undefined : t('financial.calculator.plannedDays', { days: t('counts.days', plannedDays) })"
              :label="t('financial.calculator.plannedEnd')"
              :model-value="state.form.plannedEndDate"
              required
              type="date"
              @update:model-value="value => onPlannedEnd(asText(value))"
            />
          </div>

          <div :aria-label="t('financial.calculator.periodsLabel')" class="periods" role="group">
            <span class="periods__label">{{ t('financial.calculator.periodsLabel') }}</span>

            <DlButton
              v-for="period in PERIODS"
              :key="period.key"
              size="small"
              :variant="plannedDays === period.days ? 'tonal' : 'outlined'"
              @click="applyPeriod(period.days)"
            >
              {{ t(`financial.calculator.periods.${period.key}`) }}
            </DlButton>
          </div>

          <DlDataTable
            v-if="priceRows.length > 0"
            bare
            :columns="priceColumns"
            :limit="priceRows.length + 1"
            :paged="false"
            :rows="priceRows"
          />
        </div>
      </DlSectionCard>

      <DlSectionCard
        v-if="unitRows.length > 0"
        :count="unitRows.length"
        :description="t('financial.calculator.unitsDescription')"
        :title="t('financial.calculator.units')"
      >
        <div class="units">
          <div v-for="row in unitRows" :key="row.id" class="unit">
            <div class="unit__name">
              <span class="unit__code">{{ row.code }}</span>
              <span class="unit__label">{{ row.name }}</span>
            </div>

            <DlTextField
              v-if="row.countsReturn"
              density="compact"
              :error="state.attempted ? row.returnError : null"
              :hint="row.returnHint"
              :label="row.replaced ? t('financial.calculator.substituteReturn') : t('financial.calculator.returnDate')"
              :model-value="row.unit.returnDate"
              required
              type="date"
              @update:model-value="value => (row.unit.returnDate = asText(value))"
            />

            <p v-else class="unit__note">
              <VIcon icon="mdi-exit-run" size="16" />
              <span>{{ t('financial.calculator.leavesOnOccurrence') }}</span>
            </p>

            <DlSelect
              :clearable="false"
              density="compact"
              :label="t('financial.calculator.occurrence')"
              :model-value="row.unit.occurrence"
              :options="occurrenceOptions"
              @update:model-value="value => setOccurrence(row.id, asText(value))"
            />

            <DlTextField
              density="compact"
              :disabled="!row.unit.occurrence"
              :error="state.attempted ? row.occurrenceError : null"
              :label="t('financial.calculator.occurrenceDate')"
              :model-value="row.unit.occurrenceDate"
              type="date"
              @update:model-value="value => (row.unit.occurrenceDate = asText(value))"
            />
          </div>
        </div>
      </DlSectionCard>

      <div class="actions">
        <DlButton icon="mdi-calculator-variant-outline" :loading="state.submitting" @click="calculate">
          {{ t('financial.calculator.calculate') }}
        </DlButton>
      </div>

      <p v-if="state.error" class="note note--error" role="alert">
        <VIcon icon="mdi-alert-circle-outline" size="18" />
        <span>{{ state.error }}</span>
      </p>

      <DlSectionCard v-if="result" :description="resultDescription" :title="t('financial.calculator.result')">
        <div class="result">
          <p v-if="stale" class="note note--warning">
            <VIcon icon="mdi-refresh" size="18" />
            <span>{{ t('financial.calculator.stale') }}</span>
          </p>

          <StatementBreakdown simulation :statement="result" />
        </div>
      </DlSectionCard>
    </template>
  </div>
</template>

<script lang="ts" setup>
  import type { ContractStatement, SimulationInput, SimulationItem } from '@/types/krloc'
  import {
    type Column,
    DlButton,
    DlDataTable,
    DlEmptyState,
    DlPageHeader,
    DlSectionCard,
    DlSelect,
    DlTextField,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import StatementBreakdown from '@/components/financial/StatementBreakdown.vue'
  import { useForm } from '@/composables/useForm'
  import { MAX_CONTRACT_DAYS, MAX_SIMULATION_DAYS } from '@/constants/api'
  import { errorMessage } from '@/services/http'
  import { useFinancialStore } from '@/stores/financial'
  import { useLookupsStore } from '@/stores/lookups'
  import { useSessionStore } from '@/stores/session'
  import {
    addDaysToDateInput,
    dateInputDays,
    dateInputDelta,
    dateInputToIso,
    formatDate,
    formatMoney,
    isDateInputInRange,
    isoToDateInput,
    todayInput,
    unitCode,
  } from '@/utils/format'
  import { asOptions, asText } from '@/utils/forms'

  const { t } = useI18n()
  const session = useSessionStore()
  const lookups = useLookupsStore()
  const store = useFinancialStore()

  const canEquipment = computed(() => session.can('GET', '/equipment'))

  const PERIODS = [
    { key: 'daily', days: 1 },
    { key: 'weekly', days: 7 },
    { key: 'biweekly', days: 15 },
    { key: 'monthly', days: 30 },
  ] as const

  type Occurrence = '' | 'defect' | 'defect:replaced' | 'stolen' | 'stolen:replaced'

  interface UnitForm {
    returnDate: string
    occurrence: Occurrence
    occurrenceDate: string
  }

  const DEFAULT_DAYS = 15

  function blank () {
    const start = todayInput()

    return {
      equipments: [] as string[],
      startDate: start,
      plannedEndDate: addDaysToDateInput(start, DEFAULT_DAYS),
      units: {} as Record<string, UnitForm>,
    }
  }

  const state = useForm(blank)

  const result = shallowRef<ContractStatement | null>(null)
  const calculatedWith = shallowRef<string | null>(null)

  const countsReturn = (unit: UnitForm): boolean => !unit.occurrence || unit.occurrence.endsWith(':replaced')

  const available = computed(() =>
    lookups.equipment
      .filter(item => item.status !== 'RETIRED' && item.status !== 'STOLEN')
      .toSorted((a, b) => a.code.localeCompare(b.code) || a.suffix - b.suffix),
  )

  const byId = computed(() => new Map(lookups.equipment.map(item => [item.id, item])))

  const equipmentOptions = computed(() =>
    available.value.map(item => ({ title: `${unitCode(item.code, item.suffix)} · ${item.name}`, value: item.id })),
  )

  function freshUnit (): UnitForm {
    return { returnDate: state.form.plannedEndDate, occurrence: '', occurrenceDate: '' }
  }

  function onEquipments (ids: string[]): void {
    state.form.equipments = ids
    state.form.units = Object.fromEntries(ids.map(id => [id, state.form.units[id] ?? freshUnit()]))
  }

  interface PriceRow extends Record<string, unknown> {
    id: string
    code: string
    daily: string
    weekly: string
    biweekly: string
    monthly: string
    indemnity: string
  }

  const priceRows = computed<PriceRow[]>(() =>
    state.form.equipments.flatMap(id => {
      const item = byId.value.get(id)

      return item
        ? [{
          id,
          code: unitCode(item.code, item.suffix),
          daily: formatMoney(item.p_diary),
          weekly: formatMoney(item.p_weekly || null),
          biweekly: formatMoney(item.p_biweekly || null),
          monthly: formatMoney(item.p_monthly || null),
          indemnity: formatMoney(item.p_indemnity),
        }]
        : []
    }),
  )

  const priceColumns = computed<Column<PriceRow>[]>(() => [
    { key: 'code', label: t('equipment.code'), mono: true, width: '130px' },
    { key: 'daily', label: t('rates.daily'), align: 'end' },
    { key: 'weekly', label: t('rates.weekly'), align: 'end', secondary: true },
    { key: 'biweekly', label: t('rates.biweekly'), align: 'end', secondary: true },
    { key: 'monthly', label: t('rates.monthly'), align: 'end' },
    { key: 'indemnity', label: t('rates.indemnity'), align: 'end', secondary: true },
  ])

  const plannedDays = computed(() => dateInputDays(state.form.startDate, state.form.plannedEndDate))

  const startProblem = computed(() => {
    if (!state.form.startDate) {
      return t('financial.calculator.enterStart')
    }

    return isDateInputInRange(state.form.startDate) ? null : t('errors.field.date_out_of_range')
  })

  function onStart (value: string): void {
    const delta = dateInputDelta(state.form.startDate, value)

    state.form.startDate = value

    if (!value || !delta) {
      return
    }

    const shift = (date: string): string => (date ? addDaysToDateInput(date, delta) : date)

    state.form.plannedEndDate = shift(state.form.plannedEndDate)
    state.form.units = Object.fromEntries(Object.entries(state.form.units).map(([id, unit]) => [id, {
      ...unit,
      returnDate: shift(unit.returnDate),
      occurrenceDate: shift(unit.occurrenceDate),
    }]))
  }

  function onPlannedEnd (value: string): void {
    const previous = state.form.plannedEndDate

    state.form.plannedEndDate = value

    for (const unit of Object.values(state.form.units)) {
      if (unit.returnDate === previous) {
        unit.returnDate = value
      }
    }
  }

  function applyPeriod (days: number): void {
    if (state.form.startDate) {
      onPlannedEnd(addDaysToDateInput(state.form.startDate, days))
    }
  }

  const plannedEndError = computed(() => (state.attempted ? plannedEndProblem.value : null))

  const plannedEndProblem = computed(() => {
    if (!state.form.plannedEndDate) {
      return t('financial.calculator.enterPlannedEnd')
    }

    if (!isDateInputInRange(state.form.plannedEndDate)) {
      return t('errors.field.date_out_of_range')
    }

    if (plannedDays.value === null && state.form.startDate) {
      return t('financial.calculator.endBeforeStart')
    }

    return plannedDays.value !== null && plannedDays.value > MAX_CONTRACT_DAYS ? t('errors.field.period_too_long') : null
  })

  const occurrenceOptions = computed(() => [
    { title: t('financial.calculator.occurrences.none'), value: '' },
    { title: t('financial.calculator.occurrences.defectReplaced'), value: 'defect:replaced' },
    { title: t('financial.calculator.occurrences.defect'), value: 'defect' },
    { title: t('financial.calculator.occurrences.stolenReplaced'), value: 'stolen:replaced' },
    { title: t('financial.calculator.occurrences.stolen'), value: 'stolen' },
  ])

  function returnProblem (unit: UnitForm): string | null {
    if (!countsReturn(unit)) {
      return null
    }

    if (!unit.returnDate) {
      return t('financial.calculator.enterReturn')
    }

    if (!isDateInputInRange(unit.returnDate)) {
      return t('errors.field.date_out_of_range')
    }

    if (unit.returnDate < state.form.startDate) {
      return t('financial.calculator.returnBeforeStart')
    }

    const kept = dateInputDays(state.form.startDate, unit.returnDate)

    return kept !== null && kept > MAX_SIMULATION_DAYS ? t('errors.field.period_too_long') : null
  }

  function occurrenceProblem (unit: UnitForm): string | null {
    if (!unit.occurrence) {
      return null
    }

    const late = countsReturn(unit) && !!unit.returnDate && unit.occurrenceDate > unit.returnDate

    if (!unit.occurrenceDate || unit.occurrenceDate < state.form.startDate || late) {
      return t('financial.calculator.occurrenceOutside')
    }

    return isDateInputInRange(unit.occurrenceDate) ? null : t('errors.field.date_out_of_range')
  }

  function returnHintOf (unit: UnitForm): string | undefined {
    const kept = dateInputDays(state.form.startDate, unit.returnDate)
    const planned = plannedDays.value

    if (kept === null) {
      return undefined
    }

    const onSite = t('financial.calculator.onSiteDays', { days: t('counts.days', kept) })

    if (planned !== null && kept > planned) {
      return `${onSite} · ${t('financial.calculator.late', { days: t('counts.days', kept - planned) })}`
    }

    return onSite
  }

  const unitRows = computed(() =>
    state.form.equipments.flatMap(id => {
      const unit = state.form.units[id]
      const item = byId.value.get(id)

      return unit
        ? [{
          id,
          unit,
          code: item ? unitCode(item.code, item.suffix) : '—',
          name: item?.name ?? '',
          countsReturn: countsReturn(unit),
          replaced: unit.occurrence.endsWith(':replaced'),
          returnHint: returnHintOf(unit),
          returnError: returnProblem(unit),
          occurrenceError: occurrenceProblem(unit),
        }]
        : []
    }),
  )

  function setOccurrence (id: string, value: string): void {
    const unit = state.form.units[id]

    if (!unit) {
      return
    }

    unit.occurrence = value as Occurrence

    if (unit.occurrence && !unit.occurrenceDate) {
      const kept = dateInputDays(state.form.startDate, unit.returnDate) ?? 2

      unit.occurrenceDate = addDaysToDateInput(state.form.startDate || todayInput(), Math.floor(kept / 2))
    }
  }

  function toItem (id: string, unit: UnitForm): SimulationItem {
    if (!unit.occurrence) {
      return { equipmentId: id, returnDate: dateInputToIso(unit.returnDate) }
    }

    const [kind, replaced] = unit.occurrence.split(':')
    const event = {
      kind: kind === 'stolen' ? 'stolen' as const : 'defect' as const,
      date: dateInputToIso(unit.occurrenceDate),
      replaced: replaced === 'replaced',
    }

    return {
      equipmentId: id,
      returnDate: dateInputToIso(event.replaced ? unit.returnDate : unit.occurrenceDate),
      event,
    }
  }

  function toInput (): SimulationInput {
    const { equipments, startDate, plannedEndDate, units } = state.form

    return {
      startDate: dateInputToIso(startDate),
      plannedEndDate: dateInputToIso(plannedEndDate),
      items: equipments.map(id => toItem(id, units[id] ?? freshUnit())),
    }
  }

  const valid = computed(() =>
    state.form.equipments.length > 0
    && !!state.form.startDate
    && isDateInputInRange(state.form.startDate)
    && plannedDays.value !== null
    && !plannedEndProblem.value
    && unitRows.value.every(row => !row.returnError && !row.occurrenceError),
  )

  async function calculate (): Promise<void> {
    const input = valid.value ? toInput() : null

    await state.submit(valid.value, async () => {
      if (!input) {
        return
      }

      result.value = await store.simulate(input)
      calculatedWith.value = JSON.stringify(input)
    })
  }

  const stale = computed(() => !!calculatedWith.value && valid.value && JSON.stringify(toInput()) !== calculatedWith.value)

  const resultDescription = computed(() => {
    const current = result.value

    return current
      ? t('financial.calculator.resultDescription', {
        start: formatDate(current.startDate),
        end: formatDate(current.plannedEndDate),
        returned: formatDate(current.finishDate),
      })
      : undefined
  })

  function restore (): void {
    const last = store.lastSimulation

    if (!last) {
      return
    }

    const units: Record<string, UnitForm> = {}

    for (const item of last.input.items) {
      const event = item.event

      units[item.equipmentId] = {
        returnDate: isoToDateInput(item.returnDate),
        occurrence: event ? ((event.replaced ? `${event.kind}:replaced` : event.kind) as Occurrence) : '',
        occurrenceDate: event ? isoToDateInput(event.date) : '',
      }
    }

    state.reset({
      equipments: last.input.items.map(item => item.equipmentId),
      startDate: isoToDateInput(last.input.startDate),
      plannedEndDate: isoToDateInput(last.input.plannedEndDate),
      units,
    })

    result.value = last.result
    calculatedWith.value = JSON.stringify(last.input)
  }

  onMounted(async () => {
    restore()

    if (!canEquipment.value) {
      return
    }

    try {
      await lookups.ensure('equipment', true)
    } catch (error) {
      toast.error(t('financial.calculator.loadFailed'), { description: errorMessage(error) })
    }
  })
</script>

<style scoped>
.calculator,
.result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.periods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.periods__label {
  margin-inline-end: 4px;
  font-size: 13px;
  color: var(--dl-on-surface-muted);
}

.units {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.unit {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) repeat(3, minmax(150px, 1fr));
  gap: 12px;
  align-items: start;
}

.unit + .unit {
  padding-top: 16px;
  border-top: 1px solid var(--dl-outline);
}

.unit__name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-top: 8px;
}

.unit__code {
  font-family: var(--dl-font-mono, monospace);
  font-size: 13px;
}

.unit__label {
  overflow: hidden;
  font-size: 13px;
  color: var(--dl-on-surface-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding-top: 10px;
  font-size: 13px;
  color: var(--dl-on-surface-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .unit {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 560px) {
  .unit {
    grid-template-columns: 1fr;
  }
}
</style>
