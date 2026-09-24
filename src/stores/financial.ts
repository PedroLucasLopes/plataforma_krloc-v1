import type { ContractStatement, SimulationInput } from '@/types/krloc'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { documentsApi, financialApi } from '@/services/krloc'

export const useFinancialStore = defineStore('financial', () => {
  const lastSimulation = shallowRef<{ input: SimulationInput, result: ContractStatement } | null>(null)

  async function simulate (input: SimulationInput): Promise<ContractStatement> {
    const result = await financialApi.simulate(input)

    lastSimulation.value = { input, result }

    return result
  }

  return {
    lastSimulation,
    simulate,
    closing: (month: string) => financialApi.closing(month),
    statement: (contractId: string) => financialApi.statement(contractId),
    closingDocument: (month: string) => documentsApi.closing(month),
  }
})
