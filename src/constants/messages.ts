import type { LeaseStatus } from '@/types/krloc'
import type { SignInError } from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'
import { LEASE_STATUS } from './status'

/**
 * Os codigos que a API do KRLoc manda no campo `error`, com o texto em
 * `errors.code.<codigo>`. O backend diz qual erro foi; a tela escolhe as
 * palavras, na lingua dela.
 *
 * So codigo desta lista vira frase. O resto cai na mensagem do status, e o
 * texto que o servidor escreve em `message` nunca vai para a tela: ele e para
 * quem le a resposta crua, e e por ali que um detalhe interno ou um valor
 * repetido da requisicao chegaria a quem usa.
 *
 * `csrf_token_invalid` e `origin_not_allowed` sao do `@pedrolucaslopes/sso-client`,
 * que protege a escrita. Codigo novo na API precisa entrar aqui e nos JSON de
 * traducao; sem isso, a tela mostra a mensagem do status.
 */
export const ERROR_CODES: ReadonlySet<string> = new Set([
  // gerais
  'no_results',
  'validation_failed',
  'duplicate',
  'internal_error',
  // sessao, do sso-client
  'csrf_token_invalid',
  'origin_not_allowed',
  // endereco e arquivo
  'zipcode_not_found',
  'address_required',
  'address_mismatch',
  'file_missing',
  'file_too_large',
  'file_type_invalid',
  // equipamento e acessorio
  'equipment_not_found',
  'equipment_leased',
  'equipment_code_too_short',
  'equipment_code_prefix',
  'equipment_unavailable',
  'equipment_retired',
  'equipment_not_retired',
  'equipment_reserved',
  'equipment_not_leased',
  'accessory_not_found',
  'accessories_unavailable',
  'accessory_quantity_decrease',
  'accessory_in_use',
  // cliente e obra
  'client_not_found',
  'client_has_lessees',
  'lessee_not_found',
  'lessee_owner_change',
  'lessee_has_contracts',
  // contrato
  'contract_not_found',
  'contract_not_active',
  'contract_not_pending',
  'contract_in_state',
  'contract_equipment_not_reserved',
  'contract_document_missing',
  'contract_last_equipment',
  'contract_items_out',
  'no_activity_in_period',
  'period_too_long',
  // substituicao
  'replace_duplicate',
  'replace_old_state',
  'replace_new_unavailable',
  'replace_pair',
  'replace_type_mismatch',
  'replace_same_unit',
  'replace_accessories',
])

/**
 * Codigos de campo que a validacao dos DTOs manda em `fields`, com o texto em
 * `errors.field.<codigo>`. Campo recusado sem codigo desta lista entra na
 * recusa generica de `validation_failed`.
 */
const FIELD_ERROR_CODES: ReadonlySet<string> = new Set([
  'phone_invalid',
  'tax_id_invalid',
  'zipcode_invalid',
  'state_invalid',
  'end_before_start',
  'date_out_of_range',
  'period_too_long',
])

function leaseLabel (status: string): string {
  return status in LEASE_STATUS ? LEASE_STATUS[status as LeaseStatus].label : status
}

/** So texto e numero viram parametro de traducao. */
function value (raw: unknown): string {
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
}

/**
 * Os codigos que tem valor no texto. O valor vem de um membro proprio do corpo,
 * nunca da mensagem.
 */
const ERROR_PARAMS: Readonly<Record<string, (body: Record<string, unknown>) => Record<string, string>>> = {
  address_mismatch: body => ({ value: value(body.value) }),
  contract_in_state: body => ({ status: leaseLabel(value(body.status)) }),
  replace_type_mismatch: body => ({ from: value(body.from), to: value(body.to) }),
  replace_same_unit: body => ({ equipment: value(body.equipment) }),
}

/** A recusa da validacao: os campos com texto proprio, ou a recusa generica. */
function validationMessage (body: Record<string, unknown>): string {
  const fields = Array.isArray(body.fields) ? body.fields as unknown[] : []
  const codes = new Set<string>()

  for (const field of fields) {
    const code = field && typeof field === 'object' ? (field as { error?: unknown }).error : null

    if (typeof code === 'string' && FIELD_ERROR_CODES.has(code)) {
      codes.add(code)
    }
  }

  return codes.size > 0
    ? [...codes].map(code => t(`errors.field.${code}`)).join(' ')
    : t('errors.code.validation_failed')
}

/** O texto do erro na lingua da tela, ou `null` quando o codigo nao e desta lista. */
export function apiErrorText (code: string | null, body: Record<string, unknown>): string | null {
  if (!code || !ERROR_CODES.has(code)) {
    return null
  }

  if (code === 'validation_failed') {
    return validationMessage(body)
  }

  return t(`errors.code.${code}`, ERROR_PARAMS[code]?.(body) ?? {})
}

/**
 * Por que o login nao se completou, nos codigos que a API manda em `?auth_error=`
 * (`SsoLoginErrorCode`, do `@pedrolucaslopes/sso-client`).
 *
 * So codigo conhecido vira texto. O que vier fora da lista, ou nada, e a falha
 * generica de `login_failed`: texto lido da URL nunca vai para a tela, e um codigo
 * novo da biblioteca chega sem quebrar nada.
 */
const SIGN_IN_ERROR_CODES = new Set(['access_denied', 'login_expired', 'state_mismatch', 'sso_unavailable', 'login_failed'])

export function signInError (code: string | null): SignInError {
  const known = code && SIGN_IN_ERROR_CODES.has(code) ? code : 'login_failed'

  return { title: t(`signInError.${known}.title`), description: t(`signInError.${known}.description`) }
}

/**
 * Quando o codigo nao e conhecido, por status HTTP. Cobre tambem o que o
 * framework responde sozinho, sem codigo: o 404 de caminho, o 413 do upload e o
 * 429 do limite de requisicoes. `0` e a API que nao respondeu.
 */
export const STATUS_MESSAGE_KEYS: Readonly<Record<number, string>> = {
  0: 'errors.status.network',
  400: 'errors.status.badRequest',
  401: 'errors.status.unauthorized',
  403: 'errors.status.forbidden',
  404: 'errors.status.notFound',
  409: 'errors.status.conflict',
  413: 'errors.status.tooLarge',
  429: 'errors.status.tooManyRequests',
  500: 'errors.status.server',
}
