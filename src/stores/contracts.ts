import type { Contract, ContractFilters, ContractInput, GeneratedDocument, Replacement, ReturnStatus } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { contractsApi, documentsApi } from '@/services/krloc'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

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
    contractDocument: (contractId: string): Promise<GeneratedDocument> =>
      act(contractId, () => documentsApi.contract(contractId)),
    statementDocument: (contractId: string) => documentsApi.statement(contractId),
    closureDocument: (contractId: string) => documentsApi.closure(contractId),
  }
})
