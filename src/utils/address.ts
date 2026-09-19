import type { AddressForm } from '@/components/AddressFields.vue'
import type { Address, AddressInput } from '@/types/krloc'
import { formatZipcode, zipcodeDigits } from './documents'
import { asInteger, STATE_PATTERN } from './forms'

/** Logradouro, numero e bairro numa linha: "Rua Augusta, 1200 · Consolacao". */
export function addressLine (record: Address): string {
  const street = [record.address, record.number].filter(part => part !== null && part !== '').join(', ')

  return [street, record.neighborhood].filter(Boolean).join(' · ')
}

/** O endereco de um registro no formato do formulario. Sem registro, vazio. */
export function addressOf (record: Address | null): AddressForm {
  return {
    zipcode: record ? formatZipcode(record.zipcode) : '',
    street: record?.address ?? '',
    number: record?.number === null || record?.number === undefined ? '' : String(record.number),
    neighborhood: record?.neighborhood ?? '',
    city: record?.city ?? '',
    state: record?.state ?? '',
  }
}

/**
 * CEP completo e rua: a da base do CEP, ou a digitada quando o CEP nao desce ate
 * a rua. Sem nenhuma das duas, a API recusa com `address_required`.
 */
export function addressValid (form: AddressForm): boolean {
  return zipcodeDigits(form.zipcode).length === 8
    && !!form.street.trim()
    && (!form.number.trim() || asInteger(form.number) !== null)
    && (!form.state || STATE_PATTERN.test(form.state))
}

type AddressField = 'address' | 'neighborhood' | 'city' | 'state'

/**
 * O que vai para a API. Ela confere o endereco contra a base do CEP, grava o que
 * a base disser, e completa com o que veio no corpo o que a base deixa vazio.
 *
 * **Cadastro, ou CEP novo na edicao,** leva o endereco inteiro: com CEP novo, o
 * endereco gravado deixa de valer, e a API so usa o que chegar.
 *
 * **Edicao com o mesmo CEP** leva so o que mudou. Sem campo de endereco, a API
 * nem consulta a base; com um, confere e completa o resto pelo gravado.
 */
export function addressInput (form: AddressForm, editing?: Address | null): AddressInput {
  const zipcode = zipcodeDigits(form.zipcode)
  const number = asInteger(form.number)
  const typed: Record<AddressField, string> = {
    address: form.street.trim(),
    neighborhood: form.neighborhood.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
  }
  const whole = { zipcode, ...Object.fromEntries(Object.entries(typed).filter(([, value]) => value)) }

  if (!editing) {
    return { ...whole, ...(number === null ? {} : { number }) }
  }

  // Numero apagado vai como `null`: sem o campo, o gravado ficaria.
  const numberInput = number === editing.number ? {} : { number }

  if (zipcode !== zipcodeDigits(editing.zipcode)) {
    return { ...whole, ...numberInput }
  }

  const saved: Record<AddressField, string> = {
    address: editing.address.trim(),
    neighborhood: editing.neighborhood?.trim() ?? '',
    city: editing.city.trim(),
    state: editing.state?.trim() ?? '',
  }

  return {
    ...Object.fromEntries(Object.entries(typed).filter(([field, value]) => value !== saved[field as AddressField])),
    ...numberInput,
  }
}
