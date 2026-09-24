import { ZIPCODE_LOOKUP_URL } from '@/constants/api'

export interface ZipcodeAddress {
  street: string
  neighborhood: string
  city: string
  state: string
}

export async function lookupZipcode (zipcode: string, signal?: AbortSignal): Promise<ZipcodeAddress | null> {
  const digits = zipcode.replaceAll(/\D/g, '')

  if (digits.length !== 8) {
    return null
  }

  const response = await fetch(`${ZIPCODE_LOOKUP_URL}/${digits}/json/`, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  })

  if (response.status === 400) {
    return null
  }

  if (!response.ok) {
    throw new Error(`consulta de CEP respondeu ${response.status}`)
  }

  const data = await response.json() as Record<string, unknown>

  if (data.erro === true || data.erro === 'true') {
    return null
  }

  const text = (value: unknown): string => (typeof value === 'string' ? value : '')

  return {
    street: text(data.logradouro),
    neighborhood: text(data.bairro),
    city: text(data.localidade),
    state: text(data.uf),
  }
}
