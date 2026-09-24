import type { SignInProvider } from '@pedrolucaslopes/dotlog-ui'

export const API_PREFIX = '/api'

export const LOGIN_PATH = '/auth/login'

export const SESSION_RECHECK_MS = 30_000

export const SIGN_IN_PROVIDER: SignInProvider = { id: 'sso', label: 'SSO', icon: 'mdi-shield-key-outline' }

export const CURRENCY = 'BRL'

export const ZIPCODE_LOOKUP_URL = 'https://viacep.com.br/ws'

export const MAX_CONTRACT_DAYS = 1830

export const MAX_SIMULATION_DAYS = 3660

export const DATE_INPUT_MIN = '2000-01-01'
export const DATE_INPUT_MAX = '2099-12-31'

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024

export const IMPORT_ACCEPT = '.csv,text/csv'
