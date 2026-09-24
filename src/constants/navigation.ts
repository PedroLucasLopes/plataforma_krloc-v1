import {
  deriveNavGroups,
  type NavGroup,
  type NavItem,
  type NavOverride,
  type Permission,
  permits,
} from '@pedrolucaslopes/dotlog-ui'
import { API_PREFIX } from '@/constants/api'
import { t } from '@/plugins/i18n'

export function buildNavGroups (permissions: Permission[]): NavGroup[] {
  const overrides: Record<string, NavOverride> = {
    '/elease': { label: t('nav.contracts'), icon: 'mdi-file-document-multiple-outline', to: '/contracts', group: 'operation', order: 1 },
    '/equipment': { label: t('nav.equipment'), icon: 'mdi-excavator', to: '/equipment', group: 'inventory', order: 1 },
    '/accessory': { label: t('nav.accessories'), icon: 'mdi-toolbox-outline', to: '/accessories', group: 'inventory', order: 2 },
    '/client': { label: t('nav.clients'), icon: 'mdi-domain', to: '/clients', group: 'customers', order: 1 },
    '/lessee': { label: t('nav.lessees'), icon: 'mdi-account-hard-hat-outline', to: '/lessees', group: 'customers', order: 2 },
    '/finantial': { label: t('nav.closing'), icon: 'mdi-finance', to: '/financial', group: 'financial', order: 1 },
    '/home': { hidden: true },
    '/health': { hidden: true },
  }

  const groups = [
    { key: 'operation', title: t('nav.operation') },
    { key: 'financial', title: t('nav.financial') },
    { key: 'inventory', title: t('nav.inventory') },
    { key: 'customers', title: t('nav.customers') },
  ]

  const derived = deriveNavGroups(permissions, { overrides, groups })

  const simulate = { method: 'POST', path: '/finantial/simulate' }
  const calculator: NavItem = {
    key: 'calculator',
    label: t('nav.calculator'),
    icon: 'mdi-calculator-variant-outline',
    to: '/financial/calculator',
    permission: simulate,
  }

  if (permits(permissions, simulate.method, simulate.path, API_PREFIX)) {
    const financial = derived.find(group => group.key === 'financial')

    if (financial) {
      financial.items.push(calculator)
    } else {
      const after = derived.findIndex(group => group.key === 'operation') + 1

      derived.splice(after, 0, { key: 'financial', title: t('nav.financial'), items: [calculator] })
    }
  }

  return [
    { key: 'home', items: [{ key: 'dashboard', label: t('nav.overview'), icon: 'mdi-view-dashboard-outline', to: '/' }] },
    ...derived,
  ]
}
