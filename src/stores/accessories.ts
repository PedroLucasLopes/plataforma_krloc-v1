import type { Accessory, AccessoryInput, BatchResult } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { accessoriesApi } from '@/services/krloc'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

/**
 * Acessorios: itens avulsos com estoque, associados a equipamentos.
 *
 * Remover e do jeito da API: com estoque, sai uma unidade; sem estoque, sai o
 * cadastro. Acessorio associado a algum equipamento nao sai.
 */
export const useAccessoriesStore = defineStore('accessories', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Accessory, { name?: string }>(
    query => accessoriesApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')

  function applySearch (term: string): Promise<void> {
    search.value = term

    return list.applyFilters({ name: term.trim() || undefined })
  }

  async function reload (): Promise<void> {
    lookups.invalidate('accessories')

    if (list.loaded.value) {
      await list.load()
    }
  }

  async function create (input: AccessoryInput): Promise<void> {
    await accessoriesApi.create(input)
    await reload()
  }

  async function update (accessoryId: string, input: Partial<AccessoryInput>): Promise<void> {
    await accessoriesApi.update(accessoryId, input)
    await reload()
  }

  async function remove (accessoryId: string): Promise<void> {
    await accessoriesApi.remove(accessoryId)
    await reload()
  }

  async function importCsv (file: File): Promise<BatchResult> {
    const result = await accessoriesApi.importCsv(file)

    await reload()

    return result
  }

  return { ...list, search, applySearch, create, update, remove, importCsv }
})
