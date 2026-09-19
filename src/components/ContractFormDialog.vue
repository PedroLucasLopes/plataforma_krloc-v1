<template>
  <DlFormDialog
    v-model="open"
    :description="t('contractForm.description')"
    :dirty="state.dirty"
    :error="state.error"
    :submit-label="t('contractForm.submit')"
    :submitting="state.submitting"
    :title="t('contractForm.title')"
    :width="680"
    @submit="save"
  >
    <DlSelect
      :disabled="!!lesseeId"
      :error="state.attempted && !state.form.lesseeId ? t('contractForm.chooseLessee') : null"
      :hint="lesseeOptions.length === 0 && !lookups.state.lessees.loading ? t('contractForm.noLessees') : undefined"
      :label="t('contracts.lessee')"
      :loading="lookups.state.lessees.loading"
      :model-value="state.form.lesseeId || null"
      :options="lesseeOptions"
      required
      searchable
      @update:model-value="value => (state.form.lesseeId = asOption(value) ?? '')"
    />

    <div class="form-grid">
      <DlTextField
        :error="state.attempted && !state.form.startDate ? t('contractForm.enterStart') : null"
        :label="t('contracts.start')"
        :model-value="state.form.startDate"
        required
        type="date"
        @update:model-value="value => (state.form.startDate = asText(value))"
      />

      <DlTextField
        :error="endError"
        :hint="t('contractForm.endHint')"
        :label="t('contracts.end')"
        :model-value="state.form.endDate"
        required
        type="date"
        @update:model-value="value => (state.form.endDate = asText(value))"
      />
    </div>

    <DlSelect
      :error="state.attempted && state.form.equipmentIds.length === 0 ? t('contractForm.chooseEquipment') : null"
      :hint="equipmentOptions.length === 0 && !lookups.state.equipment.loading ? t('contractForm.noEquipment') : t('contractForm.equipmentHint')"
      :label="t('nav.equipment')"
      :loading="lookups.state.equipment.loading"
      :model-value="state.form.equipmentIds"
      multiple
      :options="equipmentOptions"
      required
      searchable
      @update:model-value="value => (state.form.equipmentIds = asOptions(value))"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Contract } from '@/types/krloc'
  import { DlFormDialog, DlSelect, DlTextField, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { MAX_CONTRACT_DAYS } from '@/constants/api'
  import { errorMessage } from '@/services/http'
  import { useContractsStore } from '@/stores/contracts'
  import { useLookupsStore } from '@/stores/lookups'
  import { dateInputDays, dateInputToIso, formatMoney, isDateInputInRange, todayInput, unitCode } from '@/utils/format'
  import { asOption, asOptions, asText } from '@/utils/forms'

  /**
   * Novo contrato: a obra, o periodo e os equipamentos.
   *
   * So equipamento disponivel entra. A API reserva todos de uma vez e recusa o
   * contrato inteiro se algum deixou de estar disponivel entre abrir o modal e
   * salvar. O preco de cada um fica congelado no contrato a partir daqui.
   */
  const props = defineProps<{
    /** Obra ja escolhida, como na ficha da obra. */
    lesseeId?: string | null
  }>()

  const emit = defineEmits<{ created: [contract: Contract] }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useContractsStore()
  const lookups = useLookupsStore()

  const state = useForm(() => ({
    lesseeId: '',
    startDate: todayInput(),
    endDate: '',
    equipmentIds: [] as string[],
  }))

  watch(open, async isOpen => {
    if (!isOpen) {
      return
    }

    state.reset({ lesseeId: props.lesseeId ?? '' })

    // Disponibilidade muda a todo momento: o modal sempre busca de novo.
    const results = await Promise.allSettled([lookups.ensure('lessees'), lookups.ensure('equipment', true)])
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')

    if (failure) {
      toast.error(t('contractForm.loadFailed'), { description: errorMessage(failure.reason) })
    }
  })

  const lesseeOptions = computed(() =>
    lookups.lessees.map(lessee => ({
      title: lessee.client ? `${lessee.name} · ${lessee.client.name}` : lessee.name,
      value: lessee.id,
    })),
  )

  const equipmentOptions = computed(() =>
    lookups.equipment
      .filter(item => item.status === 'AVAILABLE')
      .map(item => ({
        title: t('contractForm.equipmentOption', {
          code: unitCode(item.code, item.suffix),
          name: item.name,
          daily: formatMoney(item.p_diary),
        }),
        value: item.id,
      })),
  )

  const endError = computed(() => {
    if (!state.attempted) {
      return null
    }

    if (!state.form.endDate) {
      return t('contractForm.enterEnd')
    }

    if (!isDateInputInRange(state.form.endDate)) {
      return t('errors.field.date_out_of_range')
    }

    if (state.form.startDate && state.form.endDate < state.form.startDate) {
      return t('contractForm.endBeforeStart')
    }

    // A API recusa periodo acima disso: a conta percorre cada dia dele.
    const days = dateInputDays(state.form.startDate, state.form.endDate)

    return days !== null && days > MAX_CONTRACT_DAYS ? t('errors.field.period_too_long') : null
  })

  async function save (): Promise<void> {
    const { form } = state
    const valid = !!form.lesseeId && !!form.startDate && !!form.endDate && !endError.value && form.equipmentIds.length > 0
    let created: Contract | null = null

    const ok = await state.submit(valid, async () => {
      created = await store.create({
        lesseeId: form.lesseeId,
        startDate: dateInputToIso(form.startDate),
        endDate: dateInputToIso(form.endDate),
        equipments: form.equipmentIds,
      })
    })

    if (ok && created) {
      toast.success(t('contractForm.created'), { description: t('contractForm.createdDescription') })
      open.value = false
      emit('created', created)
    }
  }
</script>
