<template>
  <DlFormDialog
    v-model="open"
    :dirty="state.dirty"
    :error="state.error"
    :mode="accessory ? 'edit' : 'create'"
    :submitting="state.submitting"
    :title="accessory ? t('accessoryForm.editTitle') : t('accessoryForm.createTitle')"
    @submit="save"
  >
    <DlTextField
      :error="state.attempted && !state.form.name.trim() ? t('accessoryForm.enterName') : null"
      :label="t('common.name')"
      :model-value="state.form.name"
      :placeholder="t('accessoryForm.namePlaceholder')"
      required
      @update:model-value="value => (state.form.name = asText(value))"
    />

    <div class="form-grid">
      <DlTextField
        :error="quantityError"
        :hint="accessory ? t('accessoryForm.quantityCantDecrease', { count: accessory.quantity }) : t('accessoryForm.quantityHint')"
        :label="t('accessories.quantity')"
        :model-value="state.form.quantity"
        required
        type="number"
        @update:model-value="value => (state.form.quantity = asText(value))"
      />

      <DlMoneyField
        v-model="state.form.p_indemnity"
        :currency="CURRENCY"
        :error="state.attempted && state.form.p_indemnity === null ? t('accessoryForm.enterIndemnity') : null"
        :label="t('rates.indemnity')"
        required
      />
    </div>
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Accessory } from '@/types/krloc'
  import { DlFormDialog, DlMoneyField, DlTextField, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { CURRENCY } from '@/constants/api'
  import { useAccessoriesStore } from '@/stores/accessories'
  import { asInteger, asText } from '@/utils/forms'

  const props = defineProps<{
    accessory?: Accessory | null
  }>()

  const emit = defineEmits<{ saved: [] }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useAccessoriesStore()

  const state = useForm(() => ({ name: '', quantity: '', p_indemnity: null as number | null }))

  watch(open, isOpen => {
    if (!isOpen) {
      return
    }

    const current = props.accessory

    state.reset(current
      ? { name: current.name, quantity: String(current.quantity), p_indemnity: current.p_indemnity }
      : {})
  })

  const quantity = computed(() => asInteger(state.form.quantity))

  const quantityError = computed(() => {
    if (!state.attempted) {
      return null
    }

    if (quantity.value === null) {
      return t('accessoryForm.enterQuantity')
    }

    const minimum = props.accessory?.quantity ?? 0

    return quantity.value < minimum ? t('accessoryForm.quantityCantDecrease', { count: minimum }) : null
  })

  async function save (): Promise<void> {
    const editing = props.accessory
    const input = { name: state.form.name.trim(), quantity: quantity.value ?? 0, p_indemnity: state.form.p_indemnity ?? 0 }
    const valid = !!input.name && quantity.value !== null && !quantityError.value && state.form.p_indemnity !== null

    const ok = await state.submit(valid, async () => {
      await (editing ? store.update(editing.id, input) : store.create(input))
    })

    if (ok) {
      toast.success(editing ? t('accessoryForm.updated') : t('accessoryForm.created'))
      open.value = false
      emit('saved')
    }
  }
</script>
