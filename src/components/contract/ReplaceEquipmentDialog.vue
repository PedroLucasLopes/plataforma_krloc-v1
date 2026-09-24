<template>
  <DlFormDialog
    v-model="open"
    :description="t('replaceEquipment.description')"
    :dirty="state.dirty"
    :error="state.error"
    :submit-label="t('replaceEquipment.submit')"
    :submitting="state.submitting"
    :title="t('replaceEquipment.title')"
    @submit="save"
  >
    <DlSelect
      :error="state.attempted && !state.form.oldId ? t('replaceEquipment.chooseOld') : null"
      :label="t('replaceEquipment.old')"
      :model-value="state.form.oldId || null"
      :options="oldOptions"
      required
      @update:model-value="value => selectOld(asOption(value) ?? '')"
    />

    <DlSelect
      :disabled="!state.form.oldId"
      :error="state.attempted && !state.form.newId ? t('replaceEquipment.chooseNew') : null"
      :hint="newHint"
      :label="t('replaceEquipment.new')"
      :loading="lookups.state.equipment.loading"
      :model-value="state.form.newId || null"
      :options="newOptions"
      required
      @update:model-value="value => (state.form.newId = asOption(value) ?? '')"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Contract, LeaseItem } from '@/types/krloc'
  import { DlFormDialog, DlSelect, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { EQUIPMENT_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useContractsStore } from '@/stores/contracts'
  import { useLookupsStore } from '@/stores/lookups'
  import { unitCode } from '@/utils/format'
  import { asOption } from '@/utils/forms'

  const props = defineProps<{
    contract: Contract
    items: LeaseItem[]
  }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useContractsStore()
  const lookups = useLookupsStore()

  const state = useForm(() => ({ oldId: '', newId: '' }))

  watch(open, async isOpen => {
    if (!isOpen) {
      return
    }

    state.reset({ oldId: props.items.length === 1 ? (props.items[0]?.equipmentId ?? '') : '' })

    try {
      await lookups.ensure('equipment', true)
    } catch (error) {
      toast.error(t('contractForm.loadFailed'), { description: errorMessage(error) })
    }
  })

  const oldItem = computed(() => props.items.find(item => item.equipmentId === state.form.oldId) ?? null)

  const oldOptions = computed(() =>
    props.items.map(item => ({
      title: t('replaceEquipment.oldOption', {
        code: unitCode(item.equipmentCode, item.equipmentSuffix),
        name: item.equipmentName,
        status: item.finalStatus ? EQUIPMENT_STATUS[item.finalStatus].label : '',
      }),
      value: item.equipmentId,
    })),
  )

  function accessoryCount (equipmentId: string): number {
    return lookups.equipment.find(item => item.id === equipmentId)?.equipmentAccessories?.length ?? 0
  }

  const newOptions = computed(() => {
    const old = oldItem.value

    if (!old) {
      return []
    }

    const accessories = accessoryCount(old.equipmentId)

    return lookups.equipment
      .filter(item =>
        item.status === 'AVAILABLE'
        && item.code === old.equipmentCode
        && item.suffix !== old.equipmentSuffix
        && (item.equipmentAccessories?.length ?? 0) === accessories)
      .map(item => ({ title: `${unitCode(item.code, item.suffix)} · ${item.name}`, value: item.id }))
  })

  const newHint = computed(() => {
    const old = oldItem.value

    if (!old || lookups.state.equipment.loading) {
      return undefined
    }

    return newOptions.value.length === 0
      ? t('replaceEquipment.noCandidates', { code: old.equipmentCode })
      : t('replaceEquipment.newHint', { code: old.equipmentCode })
  })

  function selectOld (equipmentId: string): void {
    state.form.oldId = equipmentId
    state.form.newId = ''
  }

  async function save (): Promise<void> {
    const { oldId, newId } = state.form

    const ok = await state.submit(!!oldId && !!newId, () =>
      store.replace(props.contract.id, [{ oldEquipmentId: oldId, newEquipmentId: newId }]).then(() => undefined),
    )

    if (ok) {
      toast.success(t('replaceEquipment.done'))
      open.value = false
    }
  }
</script>
