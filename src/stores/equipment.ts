import type { BatchResult, Equipment, EquipmentFilters, EquipmentInput, EquipmentStatus } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { accessoriesApi, equipmentApi } from '@/services/krloc'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

/** Codigo de equipamento comeca com KR: texto assim busca pelo codigo, e o resto pelo nome. */
const CODE = /^kr\S*$/i

/**
 * Equipamentos, paginados no servidor e ordenados pelo numero da unidade.
 *
 * A busca e uma caixa so: o que tem cara de codigo vai como `code`, o resto
 * como `name`. Os dois aceitam trecho.
 */
export const useEquipmentStore = defineStore('equipment', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Equipment, EquipmentFilters>(
    query => equipmentApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')
  const current = ref<Equipment | null>(null)

  function applySearch (term: string, status: EquipmentStatus | null): Promise<void> {
    const value = term.trim()

    search.value = term

    return list.applyFilters({
      name: value && !CODE.test(value) ? value : undefined,
      code: value && CODE.test(value) ? value : undefined,
      status: status ?? undefined,
    })
  }

  async function fetchOne (equipmentId: string): Promise<Equipment> {
    current.value = await equipmentApi.get(equipmentId)

    return current.value
  }

  /** Depois de gravar, relê o que estiver na tela: nada de remendar estado local. */
  async function reload (equipmentId?: string): Promise<void> {
    lookups.invalidate('equipment')

    if (list.loaded.value) {
      await list.load()
    }

    if (equipmentId && current.value?.id === equipmentId) {
      await fetchOne(equipmentId)
    }
  }

  async function create (input: EquipmentInput): Promise<Equipment> {
    const equipment = await equipmentApi.create(input)

    await reload()

    return equipment
  }

  async function update (equipmentId: string, input: Partial<EquipmentInput>): Promise<void> {
    await equipmentApi.update(equipmentId, input)
    await reload(equipmentId)
  }

  async function retire (equipmentId: string): Promise<void> {
    await equipmentApi.retire(equipmentId)
    await reload(equipmentId)
  }

  /** Desativado volta a frota so por aqui, e volta disponivel. */
  async function reactivate (equipmentId: string): Promise<void> {
    await equipmentApi.reactivate(equipmentId)
    await reload(equipmentId)
  }

  async function importCsv (file: File): Promise<BatchResult> {
    const result = await equipmentApi.importCsv(file)

    await reload()

    return result
  }

  async function associate (equipmentId: string, accessoryIds: string[]): Promise<void> {
    await accessoriesApi.associate({ equipmentId, accessoryIds })
    lookups.invalidate('accessories')
    await reload(equipmentId)
  }

  return { ...list, search, current, applySearch, fetchOne, create, update, retire, reactivate, importCsv, associate }
})
