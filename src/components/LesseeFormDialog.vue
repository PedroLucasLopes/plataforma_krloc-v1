<template>
  <DlFormDialog
    v-model="open"
    :description="lessee ? undefined : t('lesseeForm.createDescription')"
    :dirty="state.dirty"
    :error="state.error"
    :mode="lessee ? 'edit' : 'create'"
    :submitting="state.submitting"
    :title="lessee ? t('lesseeForm.editTitle') : t('lesseeForm.createTitle')"
    :width="720"
    @submit="save"
  >
    <div class="form-grid">
      <DlTextField
        :error="state.attempted && !state.form.name.trim() ? t('lesseeForm.enterName') : null"
        :label="t('common.name')"
        :model-value="state.form.name"
        :placeholder="t('lesseeForm.namePlaceholder')"
        required
        @update:model-value="value => (state.form.name = asText(value))"
      />

      <DlSelect
        :disabled="!!lessee || !!clientId"
        :error="state.attempted && !state.form.clientId ? t('lesseeForm.chooseClient') : null"
        :hint="lessee ? t('lesseeForm.clientFixed') : undefined"
        :label="t('lessees.client')"
        :loading="lookups.state.clients.loading"
        :model-value="state.form.clientId || null"
        :options="clientOptions"
        required
        @update:model-value="value => (state.form.clientId = asOption(value) ?? '')"
      />
    </div>

    <AddressFields
      :key="round"
      v-model="state.form.address"
      :attempted="state.attempted"
      :derived="!!lessee"
      :disabled="state.submitting"
      :verified="!!lessee"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { AddressForm } from '@/components/AddressFields.vue'
  import type { Lessee, LesseeInput } from '@/types/krloc'
  import { DlFormDialog, DlSelect, DlTextField, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import AddressFields from '@/components/AddressFields.vue'
  import { useForm } from '@/composables/useForm'
  import { errorMessage } from '@/services/http'
  import { useLesseesStore } from '@/stores/lessees'
  import { useLookupsStore } from '@/stores/lookups'
  import { addressInput, addressOf, addressValid } from '@/utils/address'
  import { formatTaxId } from '@/utils/documents'
  import { asOption, asText } from '@/utils/forms'

  /**
   * Cadastro e edicao de obra. A obra nasce de um cliente e nao troca de dono:
   * na edicao o cliente fica travado, e a API nem recebe o campo.
   */
  const props = defineProps<{
    /** Sem valor, cadastra. */
    lessee?: Lessee | null
    /** Cliente ja escolhido, como na ficha do cliente. */
    clientId?: string | null
  }>()

  const emit = defineEmits<{ saved: [lessee: Lessee | null] }>()

  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()
  const store = useLesseesStore()
  const lookups = useLookupsStore()

  const round = ref(0)

  const state = useForm(() => ({
    name: '',
    clientId: '',
    address: addressOf(null) as AddressForm,
  }))

  watch(open, async isOpen => {
    if (!isOpen) {
      return
    }

    round.value += 1

    const current = props.lessee

    state.reset(current
      ? { name: current.name, clientId: current.clientId, address: addressOf(current) }
      : { clientId: props.clientId ?? '' })

    try {
      await lookups.ensure('clients')
    } catch (error) {
      toast.error(t('lesseeForm.clientsLoadFailed'), { description: errorMessage(error) })
    }
  })

  const clientOptions = computed(() => {
    const options = lookups.clients.map(client => ({ title: `${client.name} · ${formatTaxId(client.tax_id)}`, value: client.id }))
    const current = props.lessee?.client

    // O cliente da obra aparece mesmo que o catalogo tenha chegado ao teto.
    if (current && !options.some(option => option.value === current.id)) {
      options.push({ title: current.name, value: current.id })
    }

    return options
  })

  async function save (): Promise<void> {
    const { form } = state
    const editing = props.lessee
    const valid = !!form.name.trim() && !!form.clientId && addressValid(form.address, !!editing)

    const input: LesseeInput = {
      name: form.name.trim(),
      ...(editing ? {} : { clientId: form.clientId }),
      ...addressInput(form.address, editing),
    }

    let saved: Lessee | null = null

    const ok = await state.submit(valid, async () => {
      if (editing) {
        await store.update(editing.id, input)
      } else {
        saved = await store.create(input)
      }
    })

    if (ok) {
      toast.success(editing ? t('lesseeForm.updated') : t('lesseeForm.created'))
      open.value = false
      emit('saved', saved)
    }
  }
</script>
