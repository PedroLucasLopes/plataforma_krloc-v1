<template>
  <DlFormDialog
    v-model="open"
    :description="item ? t('returnEquipment.description', { code: unitCode(item.equipmentCode, item.equipmentSuffix), name: item.equipmentName }) : undefined"
    :dirty="state.dirty"
    :error="state.error"
    :submit-label="t('returnEquipment.submit')"
    :submitting="state.submitting"
    :title="t('returnEquipment.title')"
    @submit="save"
  >
    <DlSelect
      :clearable="false"
      :hint="hint"
      :label="t('returnEquipment.outcome')"
      :model-value="state.form.status"
      :options="options"
      required
      @update:model-value="value => (state.form.status = (asOption(value) as ReturnStatus | null) ?? state.form.status)"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Contract, LeaseItem, ReturnStatus } from '@/types/krloc'
  import { DlFormDialog, DlSelect, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { RETURN_STATUS } from '@/constants/status'
  import { useContractsStore } from '@/stores/contracts'
  import { unitCode } from '@/utils/format'
  import { asOption } from '@/utils/forms'

  const props = defineProps<{
    contract: Contract
    item: LeaseItem | null
  }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useContractsStore()

  const state = useForm(() => ({ status: 'AVAILABLE' as ReturnStatus }))

  watch(open, isOpen => {
    if (isOpen) {
      state.reset()
    }
  })

  const options = computed(() => RETURN_STATUS.map(status => ({ title: t(`returnEquipment.options.${status}`), value: status })))

  const hint = computed(() => t(`returnEquipment.hints.${state.form.status}`))

  async function save (): Promise<void> {
    const item = props.item

    if (!item) {
      return
    }

    const ok = await state.submit(true, () =>
      store.setEquipmentStatus(props.contract.id, item.equipmentId, state.form.status).then(() => undefined),
    )

    if (ok) {
      toast.success(t(`returnEquipment.done.${state.form.status}`, { code: unitCode(item.equipmentCode, item.equipmentSuffix) }))
      open.value = false
    }
  }
</script>
