import type { AddressForm } from '@/components/AddressFields.vue'
import type { Address, AddressInput } from '@/types/krloc'
import { formatZipcode, zipcodeDigits } from './documents'
import { asInteger, STATE_PATTERN } from './forms'

export function addressLine (record: Address): string {
  const street = [record.address, record.number].filter(part => part !== null && part !== '').join(', ')

  return [street, record.neighborhood].filter(Boolean).join(' · ')
}

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

export function addressValid (form: AddressForm): boolean {
  return zipcodeDigits(form.zipcode).length === 8
    && !!form.street.trim()
    && (!form.number.trim() || asInteger(form.number) !== null)
    && (!form.state || STATE_PATTERN.test(form.state))
}

type AddressField = 'address' | 'neighborhood' | 'city' | 'state'

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
