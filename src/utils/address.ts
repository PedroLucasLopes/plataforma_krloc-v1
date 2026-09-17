import type { AddressForm } from '@/components/AddressFields.vue'
import type { Address } from '@/types/krloc'
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

/** Na edicao o endereco sai do CEP, e so CEP e numero sao conferidos. */
export function addressValid (form: AddressForm, editing = false): boolean {
  return zipcodeDigits(form.zipcode).length === 8
    && (editing || !!form.street.trim())
    && (!form.number.trim() || asInteger(form.number) !== null)
    && (!form.state || STATE_PATTERN.test(form.state))
}

/**
 * O que vai para a API.
 *
 * **Cadastro** leva o endereco inteiro: a API confere cada campo contra o CEP e
 * grava o que a base de CEP disser.
 *
 * **Edicao** leva so o CEP, quando mudou, e o numero. A API confere o endereco
 * enviado contra o endereco ANTIGO antes de olhar o CEP novo, entao mandar a rua
 * do CEP novo seria recusado. Sem ela, a API busca o endereco pelo CEP e grava.
 */
export function addressInput (form: AddressForm, editing?: Address | null): Record<string, string | number> {
  const zipcode = zipcodeDigits(form.zipcode)
  const number = asInteger(form.number)
  const withNumber: Record<string, number> = number === null ? {} : { number }

  if (editing) {
    return zipcode === zipcodeDigits(editing.zipcode) ? withNumber : { zipcode, ...withNumber }
  }

  const optional = (value: string): string | undefined => value.trim() || undefined

  return Object.fromEntries(Object.entries({
    zipcode,
    address: form.street.trim(),
    ...withNumber,
    neighborhood: optional(form.neighborhood),
    city: optional(form.city),
    state: optional(form.state),
  }).filter(([, value]) => value !== undefined)) as Record<string, string | number>
}
