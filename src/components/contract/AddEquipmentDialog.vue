<template>
  <DlFormDialog
    v-model="open"
    :description="t('addEquipment.description')"
    :dirty="state.dirty"
    :error="state.error"
    :submit-label="t('addEquipment.submit')"
    :submitting="state.submitting"
    :title="t('addEquipment.title')"
    @submit="save"
  >
    <DlSelect
      :error="state.attempted && state.form.equipmentIds.length === 0 ? t('contractForm.chooseEquipment') : null"
      :hint="options.length === 0 && !lookups.state.equipment.loading ? t('contractForm.noEquipment') : t('contractForm.equipmentHint')"
      :label="t('nav.equipment')"
      :loading="lookups.state.equipment.loading"
      :model-value="state.form.equipmentIds"
      multiple
      :options="options"
      required
      searchable
      @update:model-value="value => (state.form.equipmentIds = asOptions(value))"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Contract } from '@/types/krloc'
  import { DlFormDialog, DlSelect, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { errorMessage } from '@/services/http'
  import { useContractsStore } from '@/stores/contracts'
  import { useLookupsStore } from '@/stores/lookups'
  import { formatMoney, unitCode } from '@/utils/format'
  import { asOptions } from '@/utils/forms'

  const props = defineProps<{ contract: Contract }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useContractsStore()
  const lookups = useLookupsStore()

  const state = useForm(() => ({ equipmentIds: [] as string[] }))

  watch(open, async isOpen => {
    if (!isOpen) {
      return
    }

    state.reset()

    try {
      await lookups.ensure('equipment', true)
    } catch (error) {
      toast.error(t('contractForm.loadFailed'), { description: errorMessage(error) })
    }
  })

  const options = computed(() =>
    lookups.equipment
      .filter(item => item.status === 'AVAILABLE')
      .map(item => ({
        title: t('contractForm.equipmentOption', { code: unitCode(item.code, item.suffix), name: item.name, daily: formatMoney(item.p_diary) }),
        value: item.id,
      })),
  )

  async function save (): Promise<void> {
    const ids = state.form.equipmentIds

    const ok = await state.submit(ids.length > 0, () => store.addEquipment(props.contract.id, ids).then(() => undefined))

    if (ok) {
      toast.success(t('addEquipment.done', ids.length))
      open.value = false
    }
  }
</script>
