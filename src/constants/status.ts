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

export const EQUIPMENT_STATUS = labelled<EquipmentStatus>('equipment', {
  AVAILABLE: { tone: 'success', icon: 'mdi-check-circle-outline' },
  PENDING: { tone: 'neutral', icon: 'mdi-clock-outline' },
  LEASED: { tone: 'info', icon: 'mdi-truck-outline' },
  REPLACE: { tone: 'info', icon: 'mdi-swap-horizontal' },
  MAINTENANCE: { tone: 'warning', icon: 'mdi-wrench-outline' },
  STOLEN: { tone: 'error', icon: 'mdi-alert-octagon-outline' },
  RETIRED: { tone: 'dark', icon: 'mdi-archive-outline' },
})

export const EDITABLE_EQUIPMENT_STATUS: EquipmentStatus[] = [
  'AVAILABLE',
  'MAINTENANCE',
  'STOLEN',
]

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

export const POSITION_END = labelled<PositionEnd>('position', {
  returned: { tone: 'success', icon: 'mdi-check-circle-outline' },
  defect: { tone: 'warning', icon: 'mdi-wrench-outline' },
  stolen: { tone: 'error', icon: 'mdi-alert-octagon-outline' },
  open: { tone: 'info', icon: 'mdi-truck-outline' },
})

export const RETURN_STATUS: ReturnStatus[] = [
  'AVAILABLE',
  'MAINTENANCE',
  'STOLEN',
]

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

function customRoleLabel (name: string): string {
  const words = name.replaceAll('_', ' ').trim().toLowerCase()

  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function roleLabel (roles: readonly string[]): string | undefined {
  const [role] = roles

  return role ? customRoleLabel(role) : undefined
}
