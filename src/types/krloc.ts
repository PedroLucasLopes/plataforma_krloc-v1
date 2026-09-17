/**
 * Espelho do que a API do KRLoc devolve e recebe. O nome dos campos e o do
 * banco (`p_diary`, `tax_id`, `contract_generated`): a tela traduz o rotulo, nao
 * a chave.
 */

export type EquipmentStatus = 'AVAILABLE' | 'LEASED' | 'PENDING' | 'REPLACE' | 'MAINTENANCE' | 'STOLEN' | 'RETIRED'

export type LeaseStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

/** O que se registra quando um equipamento volta de um contrato ativo. */
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

/** `GET /auth/me`, do `@pedrolucaslopes/sso-client`. */
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
  /** Tipo do equipamento, com o prefixo `KR`. A unidade e o `suffix`. */
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
  /** Unidades em estoque. Associar a um equipamento consome uma. */
  quantity: number
  p_indemnity: number
}

export interface AccessoryInput {
  name: string
  quantity: number
  p_indemnity: number
}

/** Endereco conferido contra o CEP. `address` e o logradouro. */
export interface Address {
  address: string
  number: number | null
  neighborhood: string | null
  city: string
  state: string | null
  zipcode: string
  country: string | null
}

export interface Client extends Address {
  id: string
  name: string
  email: string | null
  phone: string | null
  /** CPF ou CNPJ. */
  tax_id: string
  createdAt: string
  updatedAt: string
  lessees?: Lessee[]
}

export interface ClientInput {
  name?: string
  email?: string
  phone?: string
  tax_id?: string
  address?: string
  number?: number
  zipcode?: string
  neighborhood?: string
  city?: string
  state?: string
}

/** Obra: onde o equipamento fica. Pertence a um cliente, que e o dono do contrato. */
export interface Lessee extends Address {
  id: string
  name: string
  clientId: string
  createdAt: string
  updatedAt: string
  client?: Client
  eleases?: Contract[]
}

export interface LesseeInput {
  name?: string
  clientId?: string
  address?: string
  number?: number
  zipcode?: string
  neighborhood?: string
  city?: string
  state?: string
}

/** Retrato do equipamento no contrato. O preco fica congelado aqui. */
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
  /** Quando o documento do contrato foi gerado. Sem ele, o contrato nao comeca. */
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

/** Resposta da importacao de planilha e da associacao de acessorios. */
export interface BatchResult {
  message: string
  registers: number
  statusCode: number
}

/** Documento `.docx` gerado pela API, pronto para salvar. */
export interface GeneratedDocument {
  blob: Blob
  fileName: string | null
}
