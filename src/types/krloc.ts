export type EquipmentStatus
  = | 'AVAILABLE'
    | 'LEASED'
    | 'PENDING'
    | 'REPLACE'
    | 'MAINTENANCE'
    | 'STOLEN'
    | 'RETIRED'

export type LeaseStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export type ReturnStatus = 'AVAILABLE' | 'MAINTENANCE' | 'STOLEN'

export type Order = 'asc' | 'desc'

export interface ListQuery {
  page?: number
  limit?: number
  order?: Order
}

export interface Permission {
  path: string
  method: string
}

export interface Me {
  id: string
  email: string
  name: string
  roles: string[]
  permissions: Permission[]
  csrfToken: string
  csrfCookieName: string
}

export interface AccessorySummary {
  id: string
  name: string
  p_indemnity: number
}

export interface Equipment {
  id: string
  name: string
  code: string
  suffix: number
  p_diary: number
  p_weekly: number | null
  p_biweekly: number | null
  p_monthly: number | null
  p_indemnity: number
  status: EquipmentStatus
  eleaseId: string | null
  createdAt: string
  updatedAt: string
  equipmentAccessories?: { accessory: AccessorySummary }[]
}

export interface EquipmentInput {
  name: string
  code: string
  p_diary: number
  p_weekly: number | null
  p_biweekly: number | null
  p_monthly: number | null
  p_indemnity: number
  status?: EquipmentStatus
}

export interface EquipmentFilters {
  name?: string
  code?: string
  status?: EquipmentStatus
}

export interface Accessory {
  id: string
  name: string
  quantity: number
  p_indemnity: number
}

export interface AccessoryInput {
  name: string
  quantity: number
  p_indemnity: number
}

export interface Address {
  address: string
  number: number | null
  neighborhood: string | null
  city: string
  state: string | null
  zipcode: string
  country: string | null
}

export interface AddressInput {
  zipcode?: string
  address?: string
  number?: number | null
  neighborhood?: string
  city?: string
  state?: string
}

export interface Client extends Address {
  id: string
  name: string
  email: string | null
  phone: string | null
  tax_id: string
  createdAt: string
  updatedAt: string
  lessees?: Lessee[]
}

export interface ClientFilters {
  name?: string
  email?: string
  taxId?: string
}

export interface ClientInput extends AddressInput {
  name?: string
  email?: string
  phone?: string
  tax_id?: string
}

export interface Lessee extends Address {
  id: string
  name: string
  clientId: string
  createdAt: string
  updatedAt: string
  client?: Client
  eleases?: Contract[]
}

export interface LesseeInput extends AddressInput {
  name?: string
  clientId?: string
}

export interface LeaseItem {
  id: string
  contractId: string
  equipmentId: string
  equipmentName: string
  equipmentCode: string
  equipmentSuffix: number
  p_diary: number
  p_weekly: number | null
  p_biweekly: number | null
  p_monthly: number | null
  p_indemnity: number
  startDate: string
  finishDate: string | null
  startStatus: EquipmentStatus
  finalStatus: EquipmentStatus | null
  replacesItemId: string | null
  createdAt: string
}

export interface LeaseItemAccessory {
  id: string
  name: string
  p_indemnity: number
  accessoryId: string
  contractId: string
}

export interface Contract {
  id: string
  lesseeId: string
  startDate: string
  endDate: string
  finishDate: string | null
  status: LeaseStatus
  contract_generated: string | null
  createdAt: string
  updatedAt: string
  lessee?: Lessee & { client?: Client }
  leaseItems?: LeaseItem[]
  leaseItemAccessories?: LeaseItemAccessory[]
}

export interface ContractInput {
  lesseeId: string
  startDate: string
  endDate: string
  equipments: string[]
}

export interface ContractFilters {
  status?: LeaseStatus
  lesseeId?: string
  equipmentName?: string
}

export interface Replacement {
  oldEquipmentId: string
  newEquipmentId: string
}

export interface BatchResult {
  message: string
  registers: number
  statusCode: number
}

export interface GeneratedDocument {
  blob: Blob
  fileName: string | null
}

export type PackageKind = 'monthly' | 'biweekly' | 'weekly' | 'daily'

export interface PackageLine {
  kind: PackageKind
  count: number
  unitPrice: number
  amount: number
}

export type StatementLine
  = | {
    kind: 'contracted' | 'usage'
    days: number
    packages: PackageLine[]
    amount: number
  }
  | {
    kind: 'renewal'
    index: number
    count?: number
    from: string
    days: number
    packages: PackageLine[]
    unitAmount?: number
    amount: number
  }
  | {
    kind: 'excess'
    days: number
    monthly: number | null
    dailyRate: number
    amount: number
  }
  | { kind: 'indemnity', itemId: string, code: string, amount: number }

export type PositionEnd = 'returned' | 'defect' | 'stolen' | 'open'

export interface StatementUnit {
  itemId: string
  equipmentId: string
  code: string
  name: string
  start: string
  end: string | null
  finalStatus: ReturnStatus | null
}

export interface StatementPosition {
  end: PositionEnd
  missingPrice: boolean
  start: string
  endDate: string
  days: number
  units: StatementUnit[]
  lines: StatementLine[]
  contracted: number
  rental: number
  indemnity: number
  total: number
}

export interface ContractStatement {
  contractId: string
  status: LeaseStatus
  startDate: string
  plannedEndDate: string
  finishDate: string | null
  asOf: string
  plannedDays: number
  frozen: boolean
  positions: StatementPosition[]
  totals: {
    contracted: number
    rental: number
    indemnity: number
    total: number
  }
}

export interface MonthlyClosing {
  month: string
  from: string
  to: string
  asOf: string
  summary: {
    closedContracts: number
    billed: number
    rental: number
    indemnity: number
    activeContracts: number
    activeContracted: number
    activeAccrued: number
    overdueContracts: number
    onSite: number
    maintenance: number
    stolen: number
    stolenIndemnity: number
  }
  closed: {
    contractId: string
    client: string
    lessee: string
    startDate: string
    finishDate: string
    rental: number
    indemnity: number
    total: number
  }[]
  active: {
    contractId: string
    client: string
    lessee: string
    startDate: string
    plannedEndDate: string
    overdue: boolean
    contracted: number
    accrued: number
  }[]
  onSite: {
    contractId: string
    lessee: string
    code: string
    name: string
    since: string
  }[]
  maintenance: {
    contractId: string
    lessee: string
    code: string
    name: string
    date: string
    replaced: boolean
  }[]
  stolen: {
    contractId: string
    lessee: string
    code: string
    name: string
    date: string
    indemnity: number
  }[]
}

export interface SimulationEvent {
  kind: 'defect' | 'stolen'
  date: string
  replaced: boolean
}

export interface SimulationItem {
  equipmentId: string
  returnDate: string
  event?: SimulationEvent
}

export interface SimulationInput {
  items: SimulationItem[]
  startDate: string
  plannedEndDate: string
}
