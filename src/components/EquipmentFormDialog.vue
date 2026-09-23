<template>
  <DlFormDialog
    v-model="open"
    :description="equipment ? undefined : t('equipmentForm.createDescription')"
    :dirty="state.dirty"
    :error="state.error"
    :mode="equipment ? 'edit' : 'create'"
    :submitting="state.submitting"
    :title="equipment ? t('equipmentForm.editTitle', { code: unitCode(equipment.code, equipment.suffix) }) : t('equipmentForm.createTitle')"
    :width="640"
    @submit="save"
  >
    <div class="form-grid">
      <DlTextField
        :error="state.attempted && !state.form.name.trim() ? t('equipmentForm.enterName') : null"
        :label="t('common.name')"
        :model-value="state.form.name"
        :placeholder="t('equipmentForm.namePlaceholder')"
        required
        @update:model-value="value => (state.form.name = asText(value))"
      />

      <DlTextField
        :error="codeError"
        :hint="t('equipmentForm.codeHint')"
        :label="t('equipment.code')"
        :model-value="state.form.code"
        mono
        placeholder="KRBET"
        required
        @update:model-value="value => (state.form.code = asText(value).toUpperCase())"
      />
    </div>

    <DlSelect
      :clearable="false"
      :hint="t('equipmentForm.statusHint')"
      :label="t('common.status')"
      :model-value="state.form.status"
      :options="statusOptions"
      @update:model-value="value => (state.form.status = (asOption(value) as EquipmentStatus | null) ?? state.form.status)"
    />

    <p class="section-label">{{ t('equipmentForm.rates') }}</p>

    <div class="form-grid">
      <DlMoneyField
        v-model="state.form.p_diary"
        :currency="CURRENCY"
        :error="state.attempted && state.form.p_diary === null ? t('equipmentForm.enterDaily') : null"
        :label="t('rates.daily')"
        required
      />

      <DlMoneyField v-model="state.form.p_weekly" :currency="CURRENCY" :label="t('rates.weekly')" />
      <DlMoneyField v-model="state.form.p_biweekly" :currency="CURRENCY" :label="t('rates.biweekly')" />
      <DlMoneyField v-model="state.form.p_monthly" :currency="CURRENCY" :label="t('rates.monthly')" />

      <DlMoneyField
        v-model="state.form.p_indemnity"
        :currency="CURRENCY"
        :error="state.attempted && state.form.p_indemnity === null ? t('equipmentForm.enterIndemnity') : null"
        :hint="t('equipmentForm.indemnityHint')"
        :label="t('rates.indemnity')"
        required
      />
    </div>
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Equipment, EquipmentInput, EquipmentStatus } from '@/types/krloc'
  import { DlFormDialog, DlMoneyField, DlSelect, DlTextField, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { CURRENCY } from '@/constants/api'
  import { EDITABLE_EQUIPMENT_STATUS, EQUIPMENT_STATUS } from '@/constants/status'
  import { useEquipmentStore } from '@/stores/equipment'
  import { unitCode } from '@/utils/format'
  import { asOption, asText, EQUIPMENT_CODE_PATTERN } from '@/utils/forms'

  /**
   * Cadastro e edicao de equipamento.
   *
   * O numero da unidade nao e digitado: a API numera em sequencia. O codigo e o
   * tipo, com o prefixo `KR`. Reservado, locado e substituto nao chegam aqui: so
   * o contrato os muda. Desativado tambem nao: a volta dele e a reativacao, e o
   * cadastro so grava disponivel, manutencao e roubado.
   */
  const props = defineProps<{
    /** Sem valor, cadastra. */
    equipment?: Equipment | null
  }>()

  const emit = defineEmits<{ saved: [] }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useEquipmentStore()

  interface EquipmentForm {
    name: string
    code: string
    status: EquipmentStatus
    p_diary: number | null
    p_weekly: number | null
    p_biweekly: number | null
    p_monthly: number | null
    p_indemnity: number | null
  }

  const state = useForm<EquipmentForm>(() => ({
    name: '',
    code: '',
    status: 'AVAILABLE',
    p_diary: null,
    p_weekly: null,
    p_biweekly: null,
    p_monthly: null,
    p_indemnity: null,
  }))

  watch(open, isOpen => {
    if (!isOpen) {
      return
    }

    const current = props.equipment

    state.reset(current
      ? {
        name: current.name,
        code: current.code,
        status: current.status,
        p_diary: current.p_diary,
        p_weekly: current.p_weekly,
        p_biweekly: current.p_biweekly,
        p_monthly: current.p_monthly,
        p_indemnity: current.p_indemnity,
      }
      : {})
  })

  const statusOptions = computed(() => {
    // No cadastro, roubado nao faz sentido: a unidade acabou de entrar na frota.
    const allowed: EquipmentStatus[] = props.equipment ? EDITABLE_EQUIPMENT_STATUS : ['AVAILABLE', 'MAINTENANCE']

    return allowed.map(status => ({ title: EQUIPMENT_STATUS[status].label, value: status }))
  })

  const codeError = computed(() => {
    if (!state.attempted) {
      return null
    }

    const code = state.form.code.trim()

    return code.length >= 3 && EQUIPMENT_CODE_PATTERN.test(code) ? null : t('equipmentForm.codeRule')
  })

  async function save (): Promise<void> {
    const { form } = state
    const valid = !!form.name.trim() && !codeError.value && form.p_diary !== null && form.p_indemnity !== null
    const editing = props.equipment

    const input: EquipmentInput = {
      name: form.name.trim(),
      code: form.code.trim(),
      p_diary: form.p_diary ?? 0,
      p_weekly: form.p_weekly,
      p_biweekly: form.p_biweekly,
      p_monthly: form.p_monthly,
      p_indemnity: form.p_indemnity ?? 0,
      // Uma das tres do cadastro, sempre: o campo esta na tela, e quem o abriu ve
      // qual e. A API mantem a gravada quando a situacao nao vai no corpo.
      status: form.status,
    }

    const ok = await state.submit(valid, async () => {
      await (editing ? store.update(editing.id, input) : store.create(input))
    })

    if (ok) {
      toast.success(editing ? t('equipmentForm.updated') : t('equipmentForm.created'))
      open.value = false
      emit('saved')
    }
  }
</script>
