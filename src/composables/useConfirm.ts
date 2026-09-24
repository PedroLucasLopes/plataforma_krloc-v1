import { reactive, ref, shallowRef } from 'vue'
import { errorMessage } from '@/services/http'

export function useConfirm<Target> () {
  const target = shallowRef<Target | null>(null)
  const open = ref(false)
  const processing = ref(false)
  const error = ref<string | null>(null)

  function ask (item: Target): void {
    target.value = item
    error.value = null
    open.value = true
  }

  async function confirm (action: (item: Target) => Promise<void>): Promise<boolean> {
    const item = target.value

    if (item === null) {
      return false
    }

    processing.value = true
    error.value = null

    try {
      await action(item)
      open.value = false

      return true
    } catch (error_) {
      error.value = errorMessage(error_)

      return false
    } finally {
      processing.value = false
    }
  }

  return reactive({ target, open, processing, error, ask, confirm })
}
