import { ZIPCODE_LOOKUP_URL } from '@/constants/api'

/** O que o CEP diz do endereco. Campo vazio e o CEP que nao desce ate ali. */
export interface ZipcodeAddress {
  street: string
  neighborhood: string
  city: string
  state: string
}

/**
 * Endereco de um CEP, na mesma base que a API usa para conferir.
 *
 * E a unica chamada que sai da origem do front, e so leva o CEP: sem cookie,
 * sem `Referer`. `null` e CEP que nao existe; falha de rede sobe como erro, e a
 * tela deixa a pessoa digitar o endereco.
 */
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

  // O servico responde 200 com `erro` para CEP bem formado que nao existe.
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
