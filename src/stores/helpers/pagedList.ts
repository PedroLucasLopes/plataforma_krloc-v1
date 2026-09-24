import { reactive, ref, shallowRef } from 'vue'
import { PAGE_SIZE } from '@/constants/layout'
import { errorMessage } from '@/services/http'

export interface PagedQuery {
  page: number
  limit: number
}

export function usePagedList<Row, Filters extends object> (
  fetchPage: (query: PagedQuery & Filters) => Promise<Row[]>,
  initialFilters: Filters,
) {
  const rows = shallowRef<Row[]>([])
  const page = ref(1)
  const limit = ref(PAGE_SIZE)
  const filters = reactive({ ...initialFilters }) as Filters
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  let generation = 0

  async function load (): Promise<void> {
    const current = ++generation

    loading.value = true
    error.value = null

    try {
      const result = await fetchPage({ ...filters, page: page.value, limit: limit.value })

      if (current === generation) {
        rows.value = result
        loaded.value = true
      }
    } catch (error_) {
      if (current === generation) {
        error.value = errorMessage(error_)
      }
    } finally {
      if (current === generation) {
        loading.value = false
      }
    }
  }

  function setPage (next: number): Promise<void> {
    page.value = Math.max(1, next)

    return load()
  }

  function applyFilters (next: Partial<Filters>): Promise<void> {
    Object.assign(filters, next)
    page.value = 1

    return load()
  }

  return { rows, page, limit, filters, loading, loaded, error, load, setPage, applyFilters }
}
