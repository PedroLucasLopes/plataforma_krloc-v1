<template>
  <DlFormDialog
    v-model="open"
    :description="t('financialReport.description')"
    :error="state.error"
    :submit-label="t('financialReport.submit')"
    :submitting="state.submitting"
    :title="t('financialReport.title')"
    @submit="generate"
  >
    <div class="form-grid">
      <DlTextField
        :error="state.attempted && !state.form.startDate ? t('financialReport.enterStart') : null"
        :label="t('financialReport.from')"
        :model-value="state.form.startDate"
        required
        type="date"
        @update:model-value="value => (state.form.startDate = asText(value))"
      />

      <DlTextField
        :error="endError"
        :label="t('financialReport.to')"
        :model-value="state.form.endDate"
        required
        type="date"
        @update:model-value="value => (state.form.endDate = asText(value))"
      />
    </div>
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { Contract } from '@/types/krloc'
  import { DlFormDialog, DlTextField, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { useContractsStore } from '@/stores/contracts'
  import { saveDocument } from '@/utils/files'
  import { dateInputToIso, isoToDateInput, todayInput } from '@/utils/format'
  import { asText } from '@/utils/forms'

  /**
   * Relatorio financeiro de um contrato ativo, num periodo. Entram os
   * equipamentos que estiveram na obra em algum dia do periodo.
   */
  const props = defineProps<{ contract: Contract }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useContractsStore()

  const state = useForm(() => ({ startDate: '', endDate: '' }))

  watch(open, isOpen => {
    if (isOpen) {
      state.reset({ startDate: isoToDateInput(props.contract.startDate), endDate: todayInput() })
    }
  })

  const endError = computed(() => {
    if (!state.attempted) {
      return null
    }

    if (!state.form.endDate) {
      return t('financialReport.enterEnd')
    }

    return state.form.endDate < state.form.startDate ? t('financialReport.endBeforeStart') : null
  })

  async function generate (): Promise<void> {
    const { startDate, endDate } = state.form

    const ok = await state.submit(!!startDate && !!endDate && !endError.value, async () => {
      const document_ = await store.financialReport(props.contract.id, {
        startDate: dateInputToIso(startDate),
        endDate: dateInputToIso(endDate),
      })

      saveDocument(document_, t('documents.financialFile'))
    })

    if (ok) {
      toast.success(t('documents.downloaded'))
      open.value = false
    }
  }
</script>
