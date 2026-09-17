import {
  deriveNavGroups,
  type NavGroup,
  type NavOverride,
  type Permission,
} from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

/**
 * O menu sai das permissoes do papel, por `deriveNavGroups`: cada `GET` de um
 * segmento vira item. Daqui vem so o que o banco do SSO nao guarda: rotulo,
 * icone, grupo, ordem e a rota do front.
 *
 * `/generate`, `/auth` e as acoes do contrato nao tem `GET` de um segmento e nao
 * viram item. `/home` e `/finantial` tem, e ficam fora: nenhum dos dois e tela.
 *
 * Os rotulos saem da traducao na hora de montar. Quem chama de dentro de um
 * `computed` ganha o menu trocado junto com a lingua.
 */
export function buildNavGroups (permissions: Permission[]): NavGroup[] {
  const overrides: Record<string, NavOverride> = {
    '/elease': { label: t('nav.contracts'), icon: 'mdi-file-document-multiple-outline', to: '/contracts', group: 'operation', order: 1 },
    '/equipment': { label: t('nav.equipment'), icon: 'mdi-excavator', to: '/equipment', group: 'inventory', order: 1 },
    '/accessory': { label: t('nav.accessories'), icon: 'mdi-toolbox-outline', to: '/accessories', group: 'inventory', order: 2 },
    '/client': { label: t('nav.clients'), icon: 'mdi-domain', to: '/clients', group: 'customers', order: 1 },
    '/lessee': { label: t('nav.lessees'), icon: 'mdi-account-hard-hat-outline', to: '/lessees', group: 'customers', order: 2 },
    '/home': { hidden: true },
    '/finantial': { hidden: true },
    '/health': { hidden: true },
  }

  const groups = [
    { key: 'operation', title: t('nav.operation') },
    { key: 'inventory', title: t('nav.inventory') },
    { key: 'customers', title: t('nav.customers') },
  ]

  return [
    // O painel nao corresponde a rota nenhuma da API, entao entra fixo.
    { key: 'home', items: [{ key: 'dashboard', label: t('nav.overview'), icon: 'mdi-view-dashboard-outline', to: '/' }] },
    ...deriveNavGroups(permissions, { overrides, groups }),
  ]
}
