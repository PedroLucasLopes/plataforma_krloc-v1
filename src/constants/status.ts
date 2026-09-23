import type {
  EquipmentStatus,
  LeaseStatus,
  PositionEnd,
  ReturnStatus,
} from '@/types/krloc'
import type {
  LifecycleExit,
  LifecycleStep,
  StatusDefinition,
} from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

/**
 * Pastilhas de situacao. Tom e icone moram aqui; o rotulo, na traducao.
 *
 * O rotulo e um getter: ele le a lingua na hora em que a pastilha desenha, e
 * troca junto com o resto da tela. O mapa em si e constante, e pode ir direto
 * para o `:map` do `DlStatusChip`.
 */
function labelled<Key extends string> (
  group: string,
  looks: Record<Key, Omit<StatusDefinition, 'label'>>,
): Record<Key, StatusDefinition> {
  const entries = Object.entries(looks) as [
    Key,
    Omit<StatusDefinition, 'label'>,
  ][]

  return Object.fromEntries(
    entries.map(([key, look]) => [
      key,
      {
        ...look,
        get label () {
          return t(`status.${group}.${key}`)
        },
      },
    ]),
  ) as Record<Key, StatusDefinition>
}

/**
 * Situacao do equipamento. `PENDING` e `REPLACE` sao do contrato: reservado
 * para um contrato que ainda nao comecou, e posto no lugar de outro.
 */
export const EQUIPMENT_STATUS = labelled<EquipmentStatus>('equipment', {
  AVAILABLE: { tone: 'success', icon: 'mdi-check-circle-outline' },
  PENDING: { tone: 'neutral', icon: 'mdi-clock-outline' },
  LEASED: { tone: 'info', icon: 'mdi-truck-outline' },
  REPLACE: { tone: 'info', icon: 'mdi-swap-horizontal' },
  MAINTENANCE: { tone: 'warning', icon: 'mdi-wrench-outline' },
  STOLEN: { tone: 'error', icon: 'mdi-alert-octagon-outline' },
  RETIRED: { tone: 'dark', icon: 'mdi-archive-outline' },
})

/** Situacao que a propria tela de equipamento pode gravar. O resto e do contrato. */
export const EDITABLE_EQUIPMENT_STATUS: EquipmentStatus[] = [
  'AVAILABLE',
  'MAINTENANCE',
  'STOLEN',
]

/** Situacao que so o contrato muda. Nelas a API recusa editar e desativar o equipamento. */
export const CONTRACT_EQUIPMENT_STATUS: EquipmentStatus[] = [
  'PENDING',
  'LEASED',
  'REPLACE',
]

export const LEASE_STATUS = labelled<LeaseStatus>('lease', {
  PENDING: { tone: 'warning', icon: 'mdi-clock-outline' },
  ACTIVE: { tone: 'success', icon: 'mdi-play-circle-outline' },
  COMPLETED: { tone: 'info', icon: 'mdi-flag-checkered' },
  CANCELLED: { tone: 'dark', icon: 'mdi-cancel' },
})

/**
 * Como terminou a posicao de um equipamento no extrato: o original e os
 * substitutos dele, cobrados como um aluguel so.
 */
export const POSITION_END = labelled<PositionEnd>('position', {
  returned: { tone: 'success', icon: 'mdi-check-circle-outline' },
  defect: { tone: 'warning', icon: 'mdi-wrench-outline' },
  stolen: { tone: 'error', icon: 'mdi-alert-octagon-outline' },
  open: { tone: 'info', icon: 'mdi-truck-outline' },
})

/** O que se registra na volta de um equipamento, na ordem em que a tela oferece. */
export const RETURN_STATUS: ReturnStatus[] = [
  'AVAILABLE',
  'MAINTENANCE',
  'STOLEN',
]

/** O caminho do contrato. Cancelar nao e etapa: e a saida, e so antes de comecar. */
export function leaseSteps (
  captions: Partial<Record<LeaseStatus, string>> = {},
): LifecycleStep[] {
  return (['PENDING', 'ACTIVE', 'COMPLETED'] as const).map(key => ({
    key,
    label: LEASE_STATUS[key].label,
    icon:
      key === 'PENDING'
        ? 'mdi-file-document-edit-outline'
        : LEASE_STATUS[key].icon,
    caption: captions[key],
  }))
}

export function leaseExits (caption?: string): LifecycleExit[] {
  return [
    {
      key: 'CANCELLED',
      label: LEASE_STATUS.CANCELLED.label,
      icon: 'mdi-cancel',
      tone: 'dark',
      caption,
    },
  ]
}

/** Os papeis com que todo projeto nasce no SSO. */
const DEFAULT_ROLES = new Set(['SUPERADMIN', 'ADMIN', 'MANAGER', 'VIEWER'])

/**
 * Papel de nome livre escrito como os padrao aparecem, como no console do SSO:
 * `MESTRE_DE_OBRAS` vira "Mestre de obras". O nome gravado no SSO nao muda.
 */
function customRoleLabel (name: string): string {
  const words = name.replaceAll('_', ' ').trim().toLowerCase()

  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function roleLabel (roles: readonly string[]): string | undefined {
  const [role] = roles

  if (!role) {
    return undefined
  }

  return DEFAULT_ROLES.has(role)
    ? customRoleLabel(role)
    : customRoleLabel(role)
}
