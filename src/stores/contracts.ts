import type { Contract, ContractFilters, ContractInput, GeneratedDocument, Replacement, ReturnStatus } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { contractsApi, documentsApi } from '@/services/krloc'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

/**
 * Contratos e o ciclo de vida deles: criar, gerar o documento, comecar, mexer
 * nos equipamentos, fechar ou cancelar.
 *
 * Toda acao muda equipamento junto, entao toda acao relê o contrato e invalida
 * o catalogo de equipamentos. A regra de transicao e da API; a tela so oferece o
 * que a situacao permite.
 */
export const useContractsStore = defineStore('contracts', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Contract, ContractFilters>(
    query => contractsApi.list({ ...query, order: 'desc' }),
    {},
  )

  const current = ref<Contract | null>(null)

  async function fetchOne (contractId: string): Promise<Contract> {
    current.value = await contractsApi.get(contractId)

    return current.value
  }

  async function reload (contractId?: string): Promise<void> {
    lookups.invalidate('contracts', 'equipment', 'lessees')

    if (list.loaded.value) {
      await list.load()
    }

    if (contractId && current.value?.id === contractId) {
      await fetchOne(contractId)
    }
  }

  /** Roda a acao e relê. Erro sobe para o modal que a disparou. */
  async function act<T> (contractId: string, action: () => Promise<T>): Promise<T> {
    const result = await action()

    await reload(contractId)

    return result
  }

  async function create (input: ContractInput): Promise<Contract> {
    const contract = await contractsApi.create(input)

    await reload()

    return contract
  }

  return {
    ...list,
    current,
    fetchOne,
    create,
    start: (contractId: string) => act(contractId, () => contractsApi.start(contractId)),
    close: (contractId: string) => act(contractId, () => contractsApi.close(contractId)),
    cancel: (contractId: string) => act(contractId, () => contractsApi.cancel(contractId)),
    addEquipment: (contractId: string, equipmentIds: string[]) =>
      act(contractId, () => contractsApi.addEquipment(contractId, equipmentIds)),
    removeEquipment: (contractId: string, equipmentIds: string[]) =>
      act(contractId, () => contractsApi.removeEquipment(contractId, equipmentIds)),
    setEquipmentStatus: (contractId: string, equipmentId: string, status: ReturnStatus) =>
      act(contractId, () => contractsApi.setEquipmentStatus(contractId, [{ id: equipmentId, status }])),
    replace: (contractId: string, replacements: Replacement[]) =>
      act(contractId, () => contractsApi.replace(contractId, replacements)),
    /** Gerar o documento do contrato grava a data dele, que libera o inicio. */
    contractDocument: (contractId: string): Promise<GeneratedDocument> =>
      act(contractId, () => documentsApi.contract(contractId)),
    statementDocument: (contractId: string) => documentsApi.statement(contractId),
    closureDocument: (contractId: string) => documentsApi.closure(contractId),
  }
})
