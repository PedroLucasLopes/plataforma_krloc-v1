import type { LeaseStatus } from '@/types/krloc'
import type { SignInError } from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'
import { LEASE_STATUS } from './status'

/**
 * Mensagens da API escritas para quem opera o backend, traduzidas para quem usa
 * a tela. A chave e o texto exato que o servidor devolve; o valor, a chave de
 * traducao. `Map`, e nao objeto: o texto vem do servidor, e `constructor` nao
 * pode achar nada.
 *
 * Listagem vazia tambem responde 404 com texto proprio ("No clients found"),
 * mas essa nunca chega aqui: a camada HTTP a transforma em lista vazia.
 */
export const API_MESSAGE_KEYS = new Map<string, string>([
  // equipamento
  ['This equipment does not exist', 'errors.api.equipmentNotFound'],
  ['Equipment not found', 'errors.api.equipmentNotFound'],
  ['Equipment not found or is rented', 'errors.api.equipmentLeased'],
  ['The code needs at least 3 characters', 'errors.api.codeTooShort'],
  ['The code have to start with KR', 'errors.api.codePrefix'],
  ['No file uploaded', 'errors.api.noFile'],
  ['File size exceeds the 2MB limit', 'errors.api.fileTooLarge'],

  // acessorio
  ['Accessory not found', 'errors.api.accessoryNotFound'],
  ['Some accessories are not available', 'errors.api.accessoriesUnavailable'],
  ['You cant change quantity to less than you already have', 'errors.api.quantityDecrease'],
  ['You have equipments associated with this accessory', 'errors.api.accessoryInUse'],

  // cliente e obra
  ['Client not found', 'errors.api.clientNotFound'],
  ['Client Not Found!', 'errors.api.clientNotFound'],
  ['This client does not exist', 'errors.api.clientNotFound'],
  ['This client does not exist!', 'errors.api.clientNotFound'],
  ['This client has associated lessees and cannot be deleted', 'errors.api.clientHasLessees'],
  ['This lessee does not exist', 'errors.api.lesseeNotFound'],
  ['This lessee does not exist!', 'errors.api.lesseeNotFound'],
  ['This lessee do not exist', 'errors.api.lesseeNotFound'],
  ['Lessee cant change of owner', 'errors.api.lesseeOwner'],
  ['This lessee have an ongoing contract', 'errors.api.lesseeHasContracts'],
  ['Zipcode Not Found', 'errors.api.zipcodeNotFound'],

  // validacao dos DTOs, em ingles no servidor
  ['Please enter a valid phone number', 'errors.api.phoneInvalid'],
  ['Phone number must be at least 10 characters long', 'errors.api.phoneInvalid'],
  ['Tax ID must be at least 11 characters long', 'errors.api.taxIdInvalid'],
  ['Please enter a valid tax ID', 'errors.api.taxIdInvalid'],
  ['Zipcode must be a valid Brazilian postal code', 'errors.api.zipcodeInvalid'],
  ['Zipcode must be at least 8 characters long', 'errors.api.zipcodeInvalid'],
  ['The state has to be no longer 2 characters', 'errors.api.stateInvalid'],
  ['endDate cannot be before startDate', 'errors.api.endBeforeStart'],
  ['finishDate cannot be before startDate', 'errors.api.endBeforeStart'],

  // contrato
  ['This contract does not exist', 'errors.api.contractNotFound'],
  ['Contract not found', 'errors.api.contractNotFound'],
  ['contract not found', 'errors.api.contractNotFound'],
  ['Active contract not found', 'errors.api.contractNotActive'],
  ['Equipment Lease not Found', 'errors.api.contractNotPending'],
  ['The contract is already Active', 'errors.api.contractNotPending'],
  ['This contract is already Active', 'errors.api.contractNotPending'],
  ['Some equipments are not available', 'errors.api.equipmentUnavailable'],
  ['Some equipments are not found', 'errors.api.equipmentUnavailable'],
  ['Some equipments were already reserved', 'errors.api.equipmentReserved'],
  ['There are equipments associated with this contract that are not PENDING', 'errors.api.contractEquipmentNotReserved'],
  ['Please generate the equipment lease contract before starting.', 'errors.api.contractDocumentMissing'],
  ['The contract cannot be canceled, some equipments need to be paid', 'errors.api.contractHasEquipment'],
  ['You have only one equipment in your contract', 'errors.api.lastEquipment'],
  ['Some equipments are not available to change', 'errors.api.equipmentNotLeased'],
  ['Some equipment has not yet been returned', 'errors.api.contractItemsOut'],
  ['Duplicate equipment ids in replacements', 'errors.api.replaceDuplicate'],
  ['One or more equipments were not found as MAINTENANCE or STOLEN items in this contract', 'errors.api.replaceOldState'],
  ['One or more old equipments are not in MAINTENANCE or STOLEN status', 'errors.api.replaceOldState'],
  ['One or more new equipments are not available', 'errors.api.replaceNewUnavailable'],
  ['Some accessories are missing', 'errors.api.replaceAccessories'],
  ['No equipment activity found for this period', 'errors.api.noActivity'],

  // banco e sessao
  ['Unique Constraint violated', 'errors.api.duplicate'],
  ['origem nao permitida', 'errors.api.originNotAllowed'],
])

interface MessagePattern {
  pattern: RegExp
  key: string
  params?: (match: RegExpMatchArray) => Record<string, string>
}

function leaseLabel (status: string): string {
  return status in LEASE_STATUS ? LEASE_STATUS[status as LeaseStatus].label : status
}

/** Mensagens montadas com valor dentro. O valor vai como parametro da traducao. */
const API_MESSAGE_PATTERNS: MessagePattern[] = [
  { pattern: /^(.+) dont match with this zipcode$/, key: 'errors.api.addressMismatch', params: match => ({ value: match[1] ?? '' }) },
  { pattern: /^This contract is ([A-Z]+)$/, key: 'errors.api.contractInState', params: match => ({ status: leaseLabel(match[1] ?? '') }) },
  {
    pattern: /^Equipment type mismatch: cannot replace (\S+) with (\S+)$/,
    key: 'errors.api.replaceMismatch',
    params: match => ({ from: match[1] ?? '', to: match[2] ?? '' }),
  },
  {
    pattern: /^New equipment (\S+) must have a different suffix from the old one$/,
    key: 'errors.api.replaceSameUnit',
    params: match => ({ code: match[1] ?? '' }),
  },
  { pattern: /^Could not resolve equipment pair: /, key: 'errors.api.replacePair' },
  // O `@pedrolucaslopes/sso-client` recusa escrita sem o header anti-CSRF.
  { pattern: /^requisicao autenticada por cookie precisa do header/, key: 'errors.api.csrf' },
]

/** O texto do servidor na lingua da tela, ou `null` quando a tela nao conhece a mensagem. */
export function apiMessage (raw: string): string | null {
  const key = API_MESSAGE_KEYS.get(raw)

  if (key) {
    return t(key)
  }

  for (const { pattern, key: patternKey, params } of API_MESSAGE_PATTERNS) {
    const match = raw.match(pattern)

    if (match) {
      return t(patternKey, params?.(match) ?? {})
    }
  }

  return null
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

/** Ultimo recurso, por status HTTP. `0` e a API que nao respondeu. */
export const STATUS_MESSAGE_KEYS: Readonly<Record<number, string>> = {
  0: 'errors.status.network',
  401: 'errors.status.unauthorized',
  403: 'errors.status.forbidden',
  404: 'errors.status.notFound',
  406: 'errors.status.wrongState',
  409: 'errors.status.conflict',
  413: 'errors.status.tooLarge',
  500: 'errors.status.server',
}
