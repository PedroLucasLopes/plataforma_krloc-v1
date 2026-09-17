import type { Client, ClientInput, Lessee } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientsApi, lesseesApi } from '@/services/krloc'
import { EMAIL_PATTERN } from '@/utils/forms'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

/**
 * Clientes: os donos dos contratos, paginados no servidor.
 *
 * A busca e uma caixa so. O filtro `email` da API exige endereco completo, entao
 * texto com cara de e-mail vai como `email`, e o resto como `name`, que aceita
 * trecho. O filtro por CPF e CNPJ da API nao funciona e fica de fora.
 */
export const useClientsStore = defineStore('clients', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Client, { name?: string, email?: string }>(
    query => clientsApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')
  const current = ref<Client | null>(null)
  const lessees = ref<Lessee[]>([])
  /** De qual cliente sao as obras em `lessees`: trocar de ficha nao mostra as do anterior. */
  const lesseesOf = ref<string | null>(null)

  function applySearch (term: string): Promise<void> {
    const value = term.trim()

    search.value = term

    return list.applyFilters(
      EMAIL_PATTERN.test(value)
        ? { email: value, name: undefined }
        : { name: value || undefined, email: undefined },
    )
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
