import type { ContractStatement, SimulationInput } from '@/types/krloc'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { documentsApi, financialApi } from '@/services/krloc'

/**
 * O financeiro: fechamento do mes, extrato de contrato e calculadora. A conta e
 * toda da API, pelas clausulas do contrato; aqui so se pede e se guarda.
 *
 * A ultima simulacao fica no store: quem sai da calculadora para conferir um
 * contrato volta e encontra o que tinha montado.
 */
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
