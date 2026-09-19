import type { Client, ClientFilters, ClientInput, Lessee } from '@/types/krloc'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientsApi, lesseesApi } from '@/services/krloc'
import { isValidTaxId, normalizeTaxId } from '@/utils/documents'
import { EMAIL_PATTERN } from '@/utils/forms'
import { usePagedList } from './helpers/pagedList'
import { useLookupsStore } from './lookups'

/** Trecho de CPF ou CNPJ: so digitos e a pontuacao do documento. Nome tem letra. */
const TAX_ID_FRAGMENT = /^(?=.*\d)[\d\s./-]+$/

/**
 * A busca e uma caixa so, e cada filtro da API tem a sua forma:
 *
 * - `email` exige o endereco completo, entao so texto com cara de e-mail vai nele;
 * - `taxId` e trecho do documento como foi gravado, e a tela grava so digitos e
 *   letras. Trecho de digitos vai limpo, e o documento inteiro que confere tambem,
 *   o CNPJ alfanumerico inclusive;
 * - o resto e trecho do nome.
 */
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

/** Clientes: os donos dos contratos, paginados no servidor. */
export const useClientsStore = defineStore('clients', () => {
  const lookups = useLookupsStore()

  const list = usePagedList<Client, ClientFilters>(
    query => clientsApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')
  const current = ref<Client | null>(null)
  const lessees = ref<Lessee[]>([])
  /** De qual cliente sao as obras em `lessees`: trocar de ficha nao mostra as do anterior. */
  const lesseesOf = ref<string | null>(null)

  function applySearch (term: string): Promise<void> {
    search.value = term

    // Um filtro por vez: o que a busca anterior usou sai.
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
