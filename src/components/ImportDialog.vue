<template>
  <DlFormDialog
    v-model="open"
    :description="description"
    :dirty="!!state.form.file && !state.submitting"
    :error="state.error"
    :submit-label="t('spreadsheet.submit')"
    :submitting="state.submitting"
    :title="title"
    @submit="send"
  >
    <DlFileDrop
      :accept="IMPORT_ACCEPT"
      :disabled="state.submitting"
      :error="state.attempted && !state.form.file ? t('spreadsheet.chooseFile') : null"
      :hint="t('spreadsheet.columns', { columns: columns.join(', ') })"
      :label="t('spreadsheet.file')"
      :max-size="IMPORT_MAX_BYTES"
      :model-value="state.form.file"
      required
      @update:model-value="file => (state.form.file = file)"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { BatchResult } from '@/types/krloc'
  import { DlFileDrop, DlFormDialog, toast } from '@pedrolucaslopes/dotlog-ui'
  import { watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useForm } from '@/composables/useForm'
  import { IMPORT_ACCEPT, IMPORT_MAX_BYTES } from '@/constants/api'

  const props = defineProps<{
    title: string
    description: string
    columns: string[]
    upload: (file: File) => Promise<BatchResult>
  }>()

  const emit = defineEmits<{ imported: [registers: number] }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()

  const state = useForm<{ file: File | null }>(() => ({ file: null }))

  watch(open, isOpen => {
    if (isOpen) {
      state.reset()
    }
  })

  async function send (): Promise<void> {
    const file = state.form.file
    let registers = 0

    const ok = await state.submit(!!file, async () => {
      registers = (await props.upload(file as File)).registers
    })

    if (ok) {
      toast.success(t('spreadsheet.done', registers), { description: t('spreadsheet.doneDescription') })
      open.value = false
      emit('imported', registers)
    }
  }
</script>
