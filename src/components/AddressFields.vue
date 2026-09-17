<template>
  <div :aria-labelledby="titleId" class="address" role="group">
    <p :id="titleId" class="address__legend">{{ t('address.title') }}</p>

    <DlTextField
      class="address__zipcode"
      :disabled="disabled"
      :error="zipcodeError"
      :hint="zipcodeHint"
      icon="mdi-map-marker-outline"
      :label="t('address.zipcode')"
      :loading="lookup.state === 'loading'"
      :model-value="address.zipcode"
      placeholder="00000-000"
      required
      @update:model-value="onZipcode"
    />

    <DlTextField
      class="address__street"
      :disabled="disabled"
      :error="attempted && !derived && !address.street.trim() ? t('address.enterStreet') : null"
      :label="t('address.street')"
      :model-value="address.street"
      :readonly="derived || locked.has('street')"
      :required="!derived"
      @update:model-value="value => update('street', asText(value))"
    />

    <DlTextField
      class="address__number"
      :disabled="disabled"
      :error="attempted && address.number.trim() && asInteger(address.number) === null ? t('address.numberDigits') : null"
      :label="t('address.number')"
      :model-value="address.number"
      @update:model-value="value => update('number', asText(value))"
    />

    <DlTextField
      class="address__neighborhood"
      :disabled="disabled"
      :label="t('address.neighborhood')"
      :model-value="address.neighborhood"
      :readonly="derived || locked.has('neighborhood')"
      @update:model-value="value => update('neighborhood', asText(value))"
    />

    <DlTextField
      class="address__city"
      :disabled="disabled"
      :label="t('address.city')"
      :model-value="address.city"
      :readonly="derived || locked.has('city')"
      @update:model-value="value => update('city', asText(value))"
    />

    <DlTextField
      class="address__state"
      :disabled="disabled"
      :error="attempted && address.state && !STATE_PATTERN.test(address.state) ? t('address.stateLetters') : null"
      :label="t('address.state')"
      :model-value="address.state"
      placeholder="SP"
      :readonly="derived || locked.has('state')"
      @update:model-value="value => update('state', asText(value).toUpperCase().slice(0, 2))"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { ZipcodeAddress } from '@/services/zipcode'
  import { DlTextField } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, reactive, ref, useId } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { lookupZipcode } from '@/services/zipcode'
  import { zipcodeDigits } from '@/utils/documents'
  import { asInteger, asText, STATE_PATTERN } from '@/utils/forms'

  export interface AddressForm {
    zipcode: string
    street: string
    number: string
    neighborhood: string
    city: string
    state: string
  }

  type FilledField = 'street' | 'neighborhood' | 'city' | 'state'

  /**
   * Endereco conferido pelo CEP.
   *
   * A API compara logradouro, bairro, cidade e UF com a base de CEP e recusa o
   * que nao bater. Por isso a tela consulta a mesma base assim que o CEP fica
   * completo, preenche o que ela souber e trava esses campos: digitar "R. Augusta"
   * onde a base diz "Rua Augusta" so produziria um erro no servidor.
   *
   * CEP que nao desce ate a rua, comum em cidade pequena, deixa o logradouro
   * aberto. Consulta que falha deixa tudo aberto, e a API confere do mesmo jeito.
   */
  const props = withDefaults(defineProps<{
    /** Liga as mensagens de validacao, depois da primeira tentativa de salvar. */
    attempted?: boolean
    disabled?: boolean
    /** O endereco inicial veio do servidor, ja conferido: comeca travado. */
    verified?: boolean
    /**
     * O endereco so sai do CEP, como na edicao: a API grava o que a base de CEP
     * disser e recusa rua enviada. Logradouro, bairro, cidade e UF ficam so para ler.
     */
    derived?: boolean
  }>(), { attempted: false, disabled: false, verified: false, derived: false })

  const address = defineModel<AddressForm>({ required: true })

  const { t } = useI18n()

  const titleId = useId()

  const lookup = reactive<{ state: 'idle' | 'loading' | 'found' | 'missing' | 'failed' }>({ state: 'idle' })

  const FILLED: FilledField[] = ['street', 'neighborhood', 'city', 'state']

  function initiallyLocked (): Set<FilledField> {
    return new Set(props.verified ? FILLED.filter(field => address.value[field].trim()) : [])
  }

  const locked = ref<Set<FilledField>>(initiallyLocked())

  let controller: AbortController | null = null

  onBeforeUnmount(() => controller?.abort())

  function update (field: keyof AddressForm, value: string): void {
    address.value = { ...address.value, [field]: value }
  }

  const zipcodeError = computed(() => {
    if (lookup.state === 'missing') {
      return t('address.zipcodeNotFound')
    }

    if (props.attempted && zipcodeDigits(address.value.zipcode).length !== 8) {
      return t('address.enterZipcode')
    }

    return null
  })

  const zipcodeHint = computed(() => {
    if (lookup.state === 'found') {
      return t('address.filled')
    }

    if (lookup.state === 'failed') {
      return props.derived ? t('address.lookupFailedDerived') : t('address.lookupFailed')
    }

    return props.derived ? t('address.derivedHint') : t('address.zipcodeHint')
  })

  async function onZipcode (value: unknown): Promise<void> {
    const text = asText(value).replaceAll(/[^\d-]/g, '').slice(0, 9)
    const digits = zipcodeDigits(text)
    const changed = digits !== zipcodeDigits(address.value.zipcode)

    update('zipcode', text)

    if (!changed) {
      return
    }

    // O endereco travado era do CEP anterior. Com outro CEP, ele nao vale mais.
    if (locked.value.size > 0) {
      address.value = { ...address.value, street: '', neighborhood: '', city: '', state: '' }
      locked.value = new Set()
    }

    controller?.abort()
    lookup.state = 'idle'

    if (digits.length !== 8) {
      return
    }

    controller = new AbortController()
    lookup.state = 'loading'

    try {
      const found = await lookupZipcode(digits, controller.signal)

      if (found) {
        fill(found)
      } else {
        lookup.state = 'missing'
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        lookup.state = 'failed'
      }
    }
  }

  function fill (found: ZipcodeAddress): void {
    const values: Record<FilledField, string> = {
      street: found.street,
      neighborhood: found.neighborhood,
      city: found.city,
      state: found.state,
    }

    const known = FILLED.filter(field => values[field].trim())

    address.value = {
      ...address.value,
      ...Object.fromEntries(known.map(field => [field, values[field]])),
    }
    locked.value = new Set(known)
    lookup.state = 'found'
  }
</script>

<style scoped>
.address {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0 16px;
  min-width: 0;
}

.address__legend {
  grid-column: 1 / -1;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--dl-on-surface);
}

.address__zipcode { grid-column: span 2; }
.address__street { grid-column: span 4; }
.address__number { grid-column: span 1; }
.address__neighborhood { grid-column: span 2; }
.address__city { grid-column: span 2; }
.address__state { grid-column: span 1; }

@media (max-width: 599px) {
  .address {
    grid-template-columns: minmax(0, 1fr);
  }

  .address > * {
    grid-column: 1 / -1;
  }
}
</style>
