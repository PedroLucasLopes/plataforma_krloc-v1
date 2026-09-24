import type { Client, ClientFilters, ClientInput, Lessee } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientsApi, lesseesApi } from '@/services/krloc'
import { isValidTaxId, normalizeTaxId } from '@/utils/documents'
import { EMAIL_PATTERN } from '@/utils/forms'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

const TAX_ID_FRAGMENT = /^(?=.*\d)[\d\s./-]+$/

function searchFilters (value: string): ClientFilters {
  if (!value) {
    return {}
  }

  if (EMAIL_PATTERN.test(value)) {
    return { email: value }
  }

  if (TAX_ID_FRAGMENT.test(value) || isValidTaxId(value)) {
    return { taxId: normalizeTaxId(value) }
  }

  return { name: value }
}

export const useClientsStore = defineStore('clients', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Client, ClientFilters>(
    query => clientsApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')
  const current = ref<Client | null>(null)
  const lessees = ref<Lessee[]>([])
  const lesseesOf = ref<string | null>(null)

  function applySearch (term: string): Promise<void> {
    search.value = term

    return list.applyFilters({ name: undefined, email: undefined, taxId: undefined, ...searchFilters(term.trim()) })
  }

  async function fetchOne (clientId: string): Promise<Client> {
    current.value = await clientsApi.get(clientId)

    return current.value
  }

  async function fetchLessees (clientId: string): Promise<Lessee[]> {
    lessees.value = await lesseesApi.byClient(clientId)
    lesseesOf.value = clientId

    return lessees.value
  }

  async function reload (clientId?: string): Promise<void> {
    lookups.invalidate('clients', 'lessees')

    if (list.loaded.value) {
      await list.load()
    }

    if (clientId && current.value?.id === clientId) {
      await fetchOne(clientId)
    }
  }

  async function create (input: ClientInput): Promise<Client> {
    const client = await clientsApi.create(input)

    await reload()

    return client
  }

  async function update (clientId: string, input: ClientInput): Promise<void> {
    await clientsApi.update(clientId, input)
    await reload(clientId)
  }

  async function remove (clientId: string): Promise<void> {
    await clientsApi.remove(clientId)

    if (current.value?.id === clientId) {
      current.value = null
    }

    await reload()
  }

  return { ...list, search, current, lessees, lesseesOf, applySearch, fetchOne, fetchLessees, create, update, remove }
})
