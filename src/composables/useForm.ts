import { computed, reactive, ref } from 'vue'
import { errorMessage } from '@/services/http'

export function useForm<Form extends object> (initial: () => Form) {
  const form = reactive(initial()) as Form
  const snapshot = ref(JSON.stringify(form))
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const attempted = ref(false)

  const dirty = computed(() => JSON.stringify(form) !== snapshot.value)

  function reset (values: Partial<Form> = {}): void {
    Object.assign(form, initial(), values)
    snapshot.value = JSON.stringify(form)
    error.value = null
    attempted.value = false
  }

  async function submit (valid: boolean, action: () => Promise<void>): Promise<boolean> {
    attempted.value = true

    if (!valid) {
      return false
    }

    submitting.value = true
    error.value = null

    try {
      await action()

      return true
    } catch (error_) {
      error.value = errorMessage(error_)

      return false
    } finally {
      submitting.value = false
    }
  }

  return reactive({ form, submitting, error, attempted, dirty, reset, submit })
}
