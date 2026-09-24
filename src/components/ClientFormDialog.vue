<template>
  <DlFormDialog
    v-model="open"
    :description="client ? undefined : t('clientForm.createDescription')"
    :dirty="state.dirty"
    :error="state.error"
    :mode="client ? 'edit' : 'create'"
    :submitting="state.submitting"
    :title="client ? t('clientForm.editTitle') : t('clientForm.createTitle')"
    :width="720"
    @submit="save"
  >
    <DlTextField
      :error="state.attempted && !state.form.name.trim() ? t('clientForm.enterName') : null"
      :label="t('clientForm.name')"
      :model-value="state.form.name"
      :placeholder="t('clientForm.namePlaceholder')"
      required
      @update:model-value="value => (state.form.name = asText(value))"
    />

    <div class="form-grid">
      <DlTextField
        :error="state.attempted && !isValidTaxId(state.form.taxId) ? t('clientForm.taxIdInvalid') : null"
        :hint="t('clientForm.taxIdHint')"
        :label="t('clients.taxId')"
        :model-value="state.form.taxId"
        mono
        required
        @update:model-value="value => (state.form.taxId = asText(value))"
      />

      <DlTextField
        :error="state.attempted && state.form.email.trim() && !EMAIL_PATTERN.test(state.form.email.trim()) ? t('clientForm.emailInvalid') : null"
        :label="t('common.email')"
        :model-value="state.form.email"
        type="email"
        @update:model-value="value => (state.form.email = asText(value))"
      />

      <DlTextField
        :error="state.attempted && state.form.phone.trim() && phoneDigits.length < 10 ? t('clientForm.phoneInvalid') : null"
        :hint="t('clientForm.phoneHint')"
        :label="t('clients.phone')"
        :model-value="state.form.phone"
        type="tel"
        @update:model-value="value => (state.form.phone = asText(value))"
      />
    </div>

    <AddressFields
      :key="round"
      v-model="state.form.address"
      :attempted="state.attempted"
      :disabled="state.submitting"
      :verified="!!client"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { AddressForm } from '@/components/AddressFields.vue'
  import type { Client, ClientInput } from '@/types/krloc'
  import { DlFormDialog, DlTextField, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import AddressFields from '@/components/AddressFields.vue'
  import { useForm } from '@/composables/useForm'
  import { useClientsStore } from '@/stores/clients'
  import { addressInput, addressOf, addressValid } from '@/utils/address'
  import { isValidTaxId, normalizeTaxId } from '@/utils/documents'
  import { asText, EMAIL_PATTERN } from '@/utils/forms'

  const props = defineProps<{
    client?: Client | null
  }>()

  const emit = defineEmits<{ saved: [client: Client | null] }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useClientsStore()

  const round = ref(0)

  const state = useForm(() => ({
    name: '',
    taxId: '',
    email: '',
    phone: '',
    address: addressOf(null) as AddressForm,
  }))

  watch(open, isOpen => {
    if (!isOpen) {
      return
    }

    round.value += 1

    const current = props.client

    state.reset(current
      ? {
        name: current.name,
        taxId: current.tax_id,
        email: current.email ?? '',
        phone: current.phone ?? '',
        address: addressOf(current),
      }
      : {})
  })

  const phoneDigits = computed(() => state.form.phone.replaceAll(/\D/g, ''))

  async function save (): Promise<void> {
    const { form } = state
    const editing = props.client
    const email = form.email.trim()

    const valid = !!form.name.trim()
      && isValidTaxId(form.taxId)
      && (!email || EMAIL_PATTERN.test(email))
      && (!form.phone.trim() || phoneDigits.value.length >= 10)
      && addressValid(form.address)

    const input: ClientInput = {
      name: form.name.trim(),
      tax_id: normalizeTaxId(form.taxId),
      ...(email ? { email: email.toLowerCase() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...addressInput(form.address, editing),
    }

    let saved: Client | null = null

    const ok = await state.submit(valid, async () => {
      if (editing) {
        await store.update(editing.id, input)
      } else {
        saved = await store.create(input)
      }
    })

    if (ok) {
      toast.success(editing ? t('clientForm.updated') : t('clientForm.created'))
      open.value = false
      emit('saved', saved)
    }
  }
</script>
