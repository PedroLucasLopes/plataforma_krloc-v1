<template>
  <DlFormDialog
    v-model="open"
    :description="t('associate.description')"
    :dirty="state.dirty"
    :error="state.error"
    :submit-label="t('associate.submit')"
    :submitting="state.submitting"
    :title="t('associate.title', { code: unitCode(equipment.code, equipment.suffix) })"
    @submit="save"
  >
    <DlSelect
      :error="state.attempted && state.form.accessoryIds.length === 0 ? t('associate.choose') : null"
      :hint="options.length === 0 && !lookups.state.accessories.loading ? t('associate.noneInStock') : t('associate.hint')"
      :label="t('nav.accessories')"
      :loading="lookups.state.accessories.loading"
      :model-value="state.form.accessoryIds"
      multiple
      :options="options"
      required
      searchable
      @update:model-value="value => (state.form.accessoryIds = asOptions(value))"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Equipment } from '@/types/krloc'
  import { DlFormDialog, DlSelect, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { errorMessage } from '@/services/http'
  import { useEquipmentStore } from '@/stores/equipment'
  import { useLookupsStore } from '@/stores/lookups'
  import { formatMoney, unitCode } from '@/utils/format'
  import { asOptions } from '@/utils/forms'

  /**
   * Associa acessorios a um equipamento disponivel. Cada associacao consome uma
   * unidade do estoque, e so aparece acessorio com estoque que ainda nao esta
   * no equipamento.
   */
  const props = defineProps<{ equipment: Equipment }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useEquipmentStore()
  const lookups = useLookupsStore()

  const state = useForm(() => ({ accessoryIds: [] as string[] }))

  watch(open, async isOpen => {
    if (!isOpen) {
      return
    }

    state.reset()

    try {
      await lookups.ensure('accessories', true)
    } catch (error) {
      toast.error(t('associate.loadFailed'), { description: errorMessage(error) })
    }
  })

  const options = computed(() => {
    const taken = new Set((props.equipment.equipmentAccessories ?? []).map(link => link.accessory.id))

    return lookups.accessories
      .filter(accessory => accessory.quantity > 0 && !taken.has(accessory.id))
      .map(accessory => ({
        title: t('associate.option', { name: accessory.name, count: accessory.quantity, indemnity: formatMoney(accessory.p_indemnity) }),
        value: accessory.id,
      }))
  })

  async function save (): Promise<void> {
    const ids = state.form.accessoryIds

    const ok = await state.submit(ids.length > 0, () => store.associate(props.equipment.id, ids))

    if (ok) {
      toast.success(t('associate.done', ids.length))
      open.value = false
    }
  }
</script>
