/**
 * Endpoints da API do KRLoc, um grupo por recurso.
 *
 * O caminho e o do catalogo de rotas do SSO, sem o prefixo global. E o mesmo
 * texto que as permissoes usam, o que deixa a tela perguntar
 * `can('POST', '/elease/start/:id')` com a mesma forma que vai na chamada.
 */
import type {
  Accessory,
  AccessoryInput,
  BatchResult,
  Client,
  ClientFilters,
  ClientInput,
  Contract,
  ContractFilters,
  ContractInput,
  ContractStatement,
  Equipment,
  EquipmentFilters,
  EquipmentInput,
  GeneratedDocument,
  Lessee,
  LesseeInput,
  ListQuery,
  Me,
  MonthlyClosing,
  Replacement,
  ReturnStatus,
  SimulationInput,
} from '@/types/krloc'
import { download, request } from './http'

const id = (value: string): string => encodeURIComponent(value)

/** Planilha no campo `file`, como o `FileInterceptor('file')` da API espera. */
function spreadsheet (file: File): FormData {
  const form = new FormData()

  form.append('file', file)

  return form
}

/** As rotas que o `@pedrolucaslopes/sso-client` instala. */
export const sessionApi = {
  me: () => request<Me>('/auth/me', { redirectOnUnauthorized: false }),
  logout: () => request<void>('/auth/logout', { method: 'POST', redirectOnUnauthorized: false }),
}

export const equipmentApi = {
  list: (query: ListQuery & EquipmentFilters = {}) =>
    request<Equipment[]>('/equipment', { query, emptyOn404: true }),
  get: (equipmentId: string) => request<Equipment>(`/equipment/${id(equipmentId)}`),
  create: (body: EquipmentInput) => request<Equipment>('/equipment', { method: 'POST', body }),
  update: (equipmentId: string, body: Partial<EquipmentInput>) =>
    request<Equipment>(`/equipment/${id(equipmentId)}`, { method: 'PUT', body }),
  /** Soft delete: o equipamento vira `RETIRED` e o historico fica. */
  retire: (equipmentId: string) => request<void>(`/equipment/${id(equipmentId)}`, { method: 'DELETE' }),
  importCsv: (file: File) =>
    request<BatchResult>('/equipment/upload', { method: 'POST', body: spreadsheet(file) }),
}

export const accessoriesApi = {
  list: (query: ListQuery & { name?: string } = {}) =>
    request<Accessory[]>('/accessory', { query, emptyOn404: true }),
  create: (body: AccessoryInput) => request<Accessory>('/accessory', { method: 'POST', body }),
  update: (accessoryId: string, body: Partial<AccessoryInput>) =>
    request<Accessory>(`/accessory/${id(accessoryId)}`, { method: 'PUT', body }),
  /** Com estoque, tira uma unidade; sem estoque, apaga o cadastro. */
  remove: (accessoryId: string) => request<void>(`/accessory/${id(accessoryId)}`, { method: 'DELETE' }),
  importCsv: (file: File) =>
    request<BatchResult>('/accessory/upload', { method: 'POST', body: spreadsheet(file) }),
  /** Cada acessorio associado consome uma unidade do estoque. */
  associate: (body: { equipmentId: string, accessoryIds: string[] }) =>
    request<BatchResult>('/accessory/associate', { method: 'POST', body }),
}

export const clientsApi = {
  list: (query: ListQuery & ClientFilters = {}) =>
    request<Client[]>('/client', { query, emptyOn404: true }),
  get: (clientId: string) => request<Client>(`/client/${id(clientId)}`),
  create: (body: ClientInput) => request<Client>('/client', { method: 'POST', body }),
  update: (clientId: string, body: ClientInput) =>
    request<Client>(`/client/${id(clientId)}`, { method: 'PUT', body }),
  remove: (clientId: string) => request<void>(`/client/${id(clientId)}`, { method: 'DELETE' }),
}

export const lesseesApi = {
  list: (query: ListQuery & { name?: string, city?: string } = {}) =>
    request<Lessee[]>('/lessee', { query, emptyOn404: true }),
  get: (lesseeId: string) => request<Lessee>(`/lessee/${id(lesseeId)}`),
  /** As obras de um cliente. Sem obra a API responde 404, que aqui vira lista vazia. */
  byClient: async (clientId: string): Promise<Lessee[]> => {
    const result = await request<(Client & { lessees?: Lessee[] }) | []>(
      `/lessee/lesseesbyclient/${id(clientId)}`,
      { emptyOn404: true },
    )

    return Array.isArray(result) ? [] : (result.lessees ?? [])
  },
  create: (body: LesseeInput) => request<Lessee>('/lessee', { method: 'POST', body }),
  update: (lesseeId: string, body: LesseeInput) =>
    request<Lessee>(`/lessee/${id(lesseeId)}`, { method: 'PUT', body }),
  remove: (lesseeId: string) => request<void>(`/lessee/${id(lesseeId)}`, { method: 'DELETE' }),
}

export const contractsApi = {
  list: (query: ListQuery & ContractFilters = {}) =>
    request<Contract[]>('/elease', { query, emptyOn404: true }),
  get: (contractId: string) => request<Contract>(`/elease/${id(contractId)}`),
  create: (body: ContractInput) => request<Contract>('/elease', { method: 'POST', body }),
  start: (contractId: string) => request<Contract>(`/elease/start/${id(contractId)}`, { method: 'POST' }),
  close: (contractId: string) => request<Contract>(`/elease/close/${id(contractId)}`, { method: 'POST' }),
  cancel: (contractId: string) => request<Contract>(`/elease/cancel/${id(contractId)}`, { method: 'POST' }),
  addEquipment: (contractId: string, equipments: string[]) =>
    request<Contract>(`/elease/add/${id(contractId)}`, { method: 'PUT', body: { equipments } }),
  removeEquipment: (contractId: string, equipments: string[]) =>
    request<Contract>(`/elease/remove/${id(contractId)}`, { method: 'PUT', body: { equipments } }),
  /** Volta, manutencao ou roubo de equipamento que esta na obra. */
  setEquipmentStatus: (contractId: string, equipments: { id: string, status: ReturnStatus }[]) =>
    request<unknown>(`/elease/status/${id(contractId)}`, { method: 'PUT', body: { equipments } }),
  replace: (contractId: string, replacements: Replacement[]) =>
    request<Contract>(`/elease/replace/${id(contractId)}`, { method: 'PUT', body: { replacements } }),
}

/**
 * A cobranca pelas clausulas do contrato. A conta mora na API, e a calculadora
 * usa a mesma: a tela nunca refaz a regra.
 */
export const financialApi = {
  statement: (contractId: string) => request<ContractStatement>(`/finantial/${id(contractId)}`),
  closing: (month: string) => request<MonthlyClosing>('/finantial', { query: { month } }),
  /** `POST` porque leva equipamentos e eventos no corpo; nao grava nada. */
  simulate: (body: SimulationInput) =>
    request<ContractStatement>('/finantial/simulate', { method: 'POST', body }),
}

/** Documentos `.docx`. Gerar o do contrato e o que libera o inicio dele. */
export const documentsApi = {
  contract: (contractId: string): Promise<GeneratedDocument> =>
    download(`/generate/contract/${id(contractId)}`, { method: 'POST' }),
  /** O extrato do contrato ativo: o que correu ate hoje. */
  statement: (contractId: string): Promise<GeneratedDocument> =>
    download(`/generate/finantial/${id(contractId)}`, { method: 'POST' }),
  /** A baixa do contrato concluido (clausula 10a). */
  closure: (contractId: string): Promise<GeneratedDocument> =>
    download(`/generate/closure/${id(contractId)}`, { method: 'POST' }),
  /** O fechamento do mes. */
  closing: (month: string): Promise<GeneratedDocument> =>
    download('/generate/finantial', { method: 'POST', body: { month } }),
}
