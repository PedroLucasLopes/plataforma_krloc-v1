import type { Accessory, Client, Contract, Equipment, Lessee } from '@/types/krloc'
import { defineStore } from 'pinia'
import { reactive, shallowRef } from 'vue'
import { LOOKUP_LIMIT } from '@/constants/layout'
import { errorMessage } from '@/services/http'
import { accessoriesApi, clientsApi, contractsApi, equipmentApi, lesseesApi } from '@/services/krloc'

export type LookupKind = 'equipment' | 'accessories' | 'clients' | 'lessees' | 'contracts'

interface LoadState {
  loading: boolean
  loaded: boolean
  error: string | null
}

const idle = (): LoadState => ({ loading: false, loaded: false, error: null })

/**
 * Cada recurso inteiro, ate `LOOKUP_LIMIT`.
 *
 * Serve ao que precisa de tudo de uma vez: o painel, e os seletores de obra, de
 * cliente, de equipamento e de acessorio. As telas de lista paginam no servidor,
 * cada uma no proprio store.
 *
 * Quem altera um recurso chama `invalidate`; a proxima tela que precisar busca
 * de novo.
 */
export const useLookupsStore = defineStore('lookups', () => {
  const equipment = shallowRef<Equipment[]>([])
  const accessories = shallowRef<Accessory[]>([])
  const clients = shallowRef<Client[]>([])
  const lessees = shallowRef<Lessee[]>([])
  const contracts = shallowRef<Contract[]>([])

  const state = reactive<Record<LookupKind, LoadState>>({
    equipment: idle(),
    accessories: idle(),
    clients: idle(),
    lessees: idle(),
    contracts: idle(),
  })

  const loaders: Record<LookupKind, () => Promise<void>> = {
    equipment: async () => {
      equipment.value = await equipmentApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
    accessories: async () => {
      accessories.value = await accessoriesApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
    clients: async () => {
      clients.value = await clientsApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
    lessees: async () => {
      lessees.value = await lesseesApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
    contracts: async () => {
      contracts.value = await contractsApi.list({ limit: LOOKUP_LIMIT, order: 'desc' })
    },
  }

  const inflight = new Map<LookupKind, Promise<void>>()

  function ensure (kind: LookupKind, force = false): Promise<void> {
    if (!force && state[kind].loaded) {
      return Promise.resolve()
    }

    const running = inflight.get(kind)

    if (running) {
      return running
    }

    const task = (async () => {
      state[kind].loading = true
      state[kind].error = null

      try {
        await loaders[kind]()
        state[kind].loaded = true
      } catch (error) {
        state[kind].error = errorMessage(error)
        throw error
      } finally {
        state[kind].loading = false
        inflight.delete(kind)
      }
    })()

    inflight.set(kind, task)

    return task
  }

  function invalidate (...kinds: LookupKind[]): void {
    for (const kind of kinds) {
      state[kind].loaded = false
    }
  }

  return { equipment, accessories, clients, lessees, contracts, state, ensure, invalidate }
})
