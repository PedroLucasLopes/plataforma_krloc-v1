/** Nome da aplicacao no menu e no titulo da aba. E nome proprio: nao se traduz. */
export const APP_NAME = 'KRLoc'

/**
 * Marca da aplicacao no topo do menu: a escavadeira que `public/favicon.svg` desenha
 * na aba. Arquivo estatico nao le constante; trocou a marca aqui, troque o icone da aba.
 */
export const APP_LOGO = 'mdi-excavator'

/** Largura maxima do conteudo. Acima disso sobra margem, nao linha comprida. */
export const CONTENT_MAX_WIDTH = 1280

/** Linhas por pagina nas listas paginadas pelo servidor. O backend tem piso de 10. */
export const PAGE_SIZE = 20

/**
 * Teto das consultas de apoio: seletor de obra e de equipamento, nome no lugar
 * de id e painel. O backend nao impoe teto ao `limit`; este e o nosso.
 */
export const LOOKUP_LIMIT = 500

/** Espera antes de buscar enquanto a pessoa digita um filtro. */
export const FILTER_DEBOUNCE_MS = 350

/** Largura minima de cada cartao na grade de indicadores. */
export const STAT_CARD_MIN_WIDTH = '210px'

/** Contrato ativo que termina dentro deste prazo entra no aviso do painel. */
export const DUE_SOON_DAYS = 7

/** Preferencia de menu recolhido, por navegador. */
export const NAV_COLLAPSED_STORAGE_KEY = 'krloc.nav-collapsed'
