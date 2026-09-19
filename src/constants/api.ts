import type { SignInProvider } from '@pedrolucaslopes/dotlog-ui'

/**
 * Prefixo global da API do KRLoc. O front fala com ela na mesma origem: proxy
 * do Vite em desenvolvimento, nginx no container, rewrite do hosting em producao.
 */
export const API_PREFIX = '/api'

/**
 * Rota do `@pedrolucaslopes/sso-client` que inicia o login no SSO. E navegacao
 * de pagina, nunca `fetch`: ela responde com redirect.
 */
export const LOGIN_PATH = '/auth/login'

/**
 * De quanto em quanto tempo a tela relê a sessao em `GET /api/auth/me`, enquanto
 * a aba esta visivel. E o prazo para uma mudanca feita no SSO aparecer no menu e
 * nas acoes: a API pergunta ao SSO a cada chamada dessa rota, e a propria API ja
 * decide pelo papel novo antes disso.
 */
export const SESSION_RECHECK_MS = 30_000

/**
 * Quem conduz o login, como a tela de login recusado o oferece: "Continuar com
 * SSO". Nome proprio, nao se traduz; o icone e a marca do SSO.
 */
export const SIGN_IN_PROVIDER: SignInProvider = { id: 'sso', label: 'SSO', icon: 'mdi-shield-key-outline' }

/**
 * Moeda da locadora. E fato do negocio, nao da lingua da tela: o contrato e
 * cobrado em reais com a interface em ingles.
 */
export const CURRENCY = 'BRL'

/**
 * Consulta de CEP, a mesma base que a API usa para conferir o endereco. A tela
 * preenche logradouro, bairro, cidade e UF com o que ela devolve, e a API recusa
 * endereco que nao bata com o CEP.
 */
export const ZIPCODE_LOOKUP_URL = 'https://viacep.com.br/ws'

/*
 * Limites de data da API, conferidos antes pela tela. A conta da cobranca
 * percorre os dias do periodo, e a API recusa o que passa daqui.
 */

/** Maior periodo contratado: cinco anos. */
export const MAX_CONTRACT_DAYS = 1830

/** Maior devolucao simulada, contada do inicio: dez anos. */
export const MAX_SIMULATION_DAYS = 3660

/** Datas aceitas: de 2000 ao fim de 2099, no formato do campo de data. */
export const DATE_INPUT_MIN = '2000-01-01'
export const DATE_INPUT_MAX = '2099-12-31'

/** Teto do upload de planilha na API (`FileSizeValidationPipe`). */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024

/** Tipos aceitos na importacao. O Windows costuma mandar CSV como planilha do Excel. */
export const IMPORT_ACCEPT = '.csv,text/csv'
