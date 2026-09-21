/**
 * Espelho do que a API do KRLoc devolve e recebe. O nome dos campos e o do
 * banco (`p_diary`, `tax_id`, `contract_generated`): a tela traduz o rotulo, nao
 * a chave.
 */

export type EquipmentStatus =
  | "AVAILABLE"
  | "LEASED"
  | "PENDING"
  | "REPLACE"
  | "MAINTENANCE"
  | "STOLEN"
  | "RETIRED";

export type LeaseStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

/** O que se registra quando um equipamento volta de um contrato ativo. */
export type ReturnStatus = "AVAILABLE" | "MAINTENANCE" | "STOLEN";

export type Order = "asc" | "desc";

export interface ListQuery {
  page?: number;
  limit?: number;
  order?: Order;
}

export interface Permission {
  path: string;
  method: string;
}

/** `GET /auth/me`, do `@pedrolucaslopes/sso-client`. */
export interface Me {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Permission[];
  csrfToken: string;
  csrfCookieName: string;
}

export interface AccessorySummary {
  id: string;
  name: string;
  p_indemnity: number;
}

export interface Equipment {
  id: string;
  name: string;
  /** Tipo do equipamento, com o prefixo `KR`. A unidade e o `suffix`. */
  code: string;
  suffix: number;
  p_diary: number;
  p_weekly: number | null;
  p_biweekly: number | null;
  p_monthly: number | null;
  p_indemnity: number;
  status: EquipmentStatus;
  eleaseId: string | null;
  createdAt: string;
  updatedAt: string;
  equipmentAccessories?: { accessory: AccessorySummary }[];
}

export interface EquipmentInput {
  name: string;
  code: string;
  p_diary: number;
  p_weekly: number | null;
  p_biweekly: number | null;
  p_monthly: number | null;
  p_indemnity: number;
  status?: EquipmentStatus;
}

export interface EquipmentFilters {
  name?: string;
  code?: string;
  status?: EquipmentStatus;
}

export interface Accessory {
  id: string;
  name: string;
  /** Unidades em estoque. Associar a um equipamento consome uma. */
  quantity: number;
  p_indemnity: number;
}

export interface AccessoryInput {
  name: string;
  quantity: number;
  p_indemnity: number;
}

/** Endereco conferido contra o CEP. `address` e o logradouro. */
export interface Address {
  address: string;
  number: number | null;
  neighborhood: string | null;
  city: string;
  state: string | null;
  zipcode: string;
  country: string | null;
}

/** O endereco que vai para a API. `number: null` apaga o numero gravado. */
export interface AddressInput {
  zipcode?: string;
  address?: string;
  number?: number | null;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface Client extends Address {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** CPF ou CNPJ. */
  tax_id: string;
  createdAt: string;
  updatedAt: string;
  lessees?: Lessee[];
}

/** `name` e `taxId` aceitam trecho; `email`, so o endereco completo. */
export interface ClientFilters {
  name?: string;
  email?: string;
  taxId?: string;
}

export interface ClientInput extends AddressInput {
  name?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
}

/** Obra: onde o equipamento fica. Pertence a um cliente, que e o dono do contrato. */
export interface Lessee extends Address {
  id: string;
  name: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  eleases?: Contract[];
}

export interface LesseeInput extends AddressInput {
  name?: string;
  clientId?: string;
}

/** Retrato do equipamento no contrato. O preco fica congelado aqui. */
export interface LeaseItem {
  id: string;
  contractId: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  equipmentSuffix: number;
  p_diary: number;
  p_weekly: number | null;
  p_biweekly: number | null;
  p_monthly: number | null;
  p_indemnity: number;
  startDate: string;
  finishDate: string | null;
  startStatus: EquipmentStatus;
  finalStatus: EquipmentStatus | null;
  /** O item que este substitui. A posicao do equipamento e o original e seus substitutos. */
  replacesItemId: string | null;
  createdAt: string;
}

export interface LeaseItemAccessory {
  id: string;
  name: string;
  p_indemnity: number;
  accessoryId: string;
  contractId: string;
}

export interface Contract {
  id: string;
  lesseeId: string;
  startDate: string;
  endDate: string;
  finishDate: string | null;
  status: LeaseStatus;
  /** Quando o documento do contrato foi gerado. Sem ele, o contrato nao comeca. */
  contract_generated: string | null;
  createdAt: string;
  updatedAt: string;
  lessee?: Lessee & { client?: Client };
  leaseItems?: LeaseItem[];
  leaseItemAccessories?: LeaseItemAccessory[];
}

export interface ContractInput {
  lesseeId: string;
  startDate: string;
  endDate: string;
  equipments: string[];
}

export interface ContractFilters {
  status?: LeaseStatus;
  lesseeId?: string;
  equipmentName?: string;
}

export interface Replacement {
  oldEquipmentId: string;
  newEquipmentId: string;
}

/** Resposta da importacao de planilha e da associacao de acessorios. */
export interface BatchResult {
  message: string;
  registers: number;
  statusCode: number;
}

/** Documento `.docx` gerado pela API, pronto para salvar. */
export interface GeneratedDocument {
  blob: Blob;
  fileName: string | null;
}

/* -------------------------------- financeiro -------------------------------- */

export type PackageKind = "monthly" | "biweekly" | "weekly" | "daily";

export interface PackageLine {
  kind: PackageKind;
  count: number;
  unitPrice: number;
  amount: number;
}

/** Uma linha da cobranca de uma posicao, com a clausula do contrato que a manda. */
export type StatementLine =
  | {
      kind: "contracted" | "usage";
      days: number;
      packages: PackageLine[];
      amount: number;
    }
  /** Prorrogacoes seguidas de mesmo preco: `count` delas, a partir da `index`. Extrato antigo nao tem `count`. */
  | {
      kind: "renewal";
      index: number;
      count?: number;
      from: string;
      days: number;
      packages: PackageLine[];
      unitAmount?: number;
      amount: number;
    }
  | {
      kind: "excess";
      days: number;
      monthly: number | null;
      dailyRate: number;
      amount: number;
    }
  | { kind: "indemnity"; itemId: string; code: string; amount: number };

/** Como a posicao terminou. `open` e a que ainda esta na obra. */
export type PositionEnd = "returned" | "defect" | "stolen" | "open";

export interface StatementUnit {
  itemId: string;
  equipmentId: string;
  code: string;
  name: string;
  start: string;
  end: string | null;
  finalStatus: ReturnStatus | null;
}

/** O lugar de um equipamento no contrato: o original e os substitutos, cobrados como um aluguel so. */
export interface StatementPosition {
  end: PositionEnd;
  /** Equipamento sem diaria na tabela: a conta sai zerada. */
  missingPrice: boolean;
  start: string;
  endDate: string;
  days: number;
  units: StatementUnit[];
  lines: StatementLine[];
  contracted: number;
  rental: number;
  indemnity: number;
  total: number;
}

/** `GET /finantial/:id`: o extrato do contrato pelas clausulas. */
export interface ContractStatement {
  contractId: string;
  status: LeaseStatus;
  startDate: string;
  plannedEndDate: string;
  finishDate: string | null;
  asOf: string;
  plannedDays: number;
  /** Concluido: o extrato gravado no fechamento, que nao muda mais. */
  frozen: boolean;
  positions: StatementPosition[];
  totals: {
    contracted: number;
    rental: number;
    indemnity: number;
    total: number;
  };
}

/** `GET /finantial?month=`: o fechamento do mes. */
export interface MonthlyClosing {
  month: string;
  from: string;
  to: string;
  asOf: string;
  summary: {
    closedContracts: number;
    billed: number;
    rental: number;
    indemnity: number;
    activeContracts: number;
    activeContracted: number;
    activeAccrued: number;
    overdueContracts: number;
    onSite: number;
    maintenance: number;
    stolen: number;
    /** Indenizacao dos roubos do mes, com contrato fechado ou nao. */
    stolenIndemnity: number;
  };
  closed: {
    contractId: string;
    client: string;
    lessee: string;
    startDate: string;
    finishDate: string;
    rental: number;
    indemnity: number;
    total: number;
  }[];
  active: {
    contractId: string;
    client: string;
    lessee: string;
    startDate: string;
    plannedEndDate: string;
    overdue: boolean;
    contracted: number;
    accrued: number;
  }[];
  onSite: {
    contractId: string;
    lessee: string;
    code: string;
    name: string;
    since: string;
  }[];
  maintenance: {
    contractId: string;
    lessee: string;
    code: string;
    name: string;
    date: string;
    replaced: boolean;
  }[];
  stolen: {
    contractId: string;
    lessee: string;
    code: string;
    name: string;
    date: string;
    indemnity: number;
  }[];
}

/** Defeito ou roubo de um equipamento da simulacao, com ou sem substituto. */
export interface SimulationEvent {
  kind: "defect" | "stolen";
  date: string;
  replaced: boolean;
}

/**
 * Um equipamento da simulacao e a devolucao dele. Com substituto, e a devolucao
 * do substituto; sem, a unidade sai da obra na ocorrencia.
 */
export interface SimulationItem {
  equipmentId: string;
  returnDate: string;
  event?: SimulationEvent;
}

/** `POST /finantial/simulate`: a calculadora. Cada equipamento volta no proprio dia. */
export interface SimulationInput {
  items: SimulationItem[];
  startDate: string;
  plannedEndDate: string;
}
