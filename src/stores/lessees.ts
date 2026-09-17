import type { Lessee, LesseeInput } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { lesseesApi } from '@/services/krloc'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

/** Obras: onde o equipamento fica. Cada uma pertence a um cliente e nao troca de dono. */
export const useLesseesStore = defineStore('lessees', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Lessee, { name?: string, city?: string }>(
    query => lesseesApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')
  const city = ref('')
  const current = ref<Lessee | null>(null)

  function applySearch (term: string, cityTerm: string): Promise<void> {
    search.value = term
    city.value = cityTerm

    return list.applyFilters({ name: term.trim() || undefined, city: cityTerm.trim() || undefined })
  }

  async function fetchOne (lesseeId: string): Promise<Lessee> {
    current.value = await lesseesApi.get(lesseeId)

    return current.value
  }

  async function reload (lesseeId?: string): Promise<void> {
    lookups.invalidate('lessees', 'clients')

    if (list.loaded.value) {
      await list.load()
    }

    if (lesseeId && current.value?.id === lesseeId) {
      await fetchOne(lesseeId)
    }
  }

  async function create (input: LesseeInput): Promise<Lessee> {
    const lessee = await lesseesApi.create(input)

    await reload()

    return lessee
  }

  async function update (lesseeId: string, input: LesseeInput): Promise<void> {
    await lesseesApi.update(lesseeId, input)
    await reload(lesseeId)
  }

  async function remove (lesseeId: string): Promise<void> {
    await lesseesApi.remove(lesseeId)

    if (current.value?.id === lesseeId) {
      current.value = null
    }

    await reload()
  }

  return { ...list, search, city, current, applySearch, fetchOne, create, update, remove }
})
