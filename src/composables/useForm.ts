import { computed, reactive, ref } from 'vue'
import { errorMessage } from '@/services/http'

/**
 * Estado do formulario de um modal que se abre e fecha sozinho.
 *
 * O erro do servidor fica dentro do modal, e o modal nao fecha quando falha: a
 * pessoa precisa ver o motivo ao lado do que digitou. `dirty` compara com o que
 * abriu, e liga a confirmacao de descarte do `DlFormDialog`. As mensagens de
 * validacao so aparecem depois da primeira tentativa.
 *
 * Devolve um objeto reativo, para o template ler `state.form.name` sem `.value`.
 */
export function useForm<Form extends object> (initial: () => Form) {
  const form = reactive(initial()) as Form
  const snapshot = ref(JSON.stringify(form))
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const attempted = ref(false)

  const dirty = computed(() => JSON.stringify(form) !== snapshot.value)

  /** Preenche para uma nova abertura. */
  function reset (values: Partial<Form> = {}): void {
    Object.assign(form, initial(), values)
    snapshot.value = JSON.stringify(form)
    error.value = null
    attempted.value = false
  }

  /** Roda a gravacao. `valid` e conferido antes: formulario invalido nao chega ao servidor. */
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
