import type { GeneratedDocument } from '@/types/krloc'

/**
 * Entrega ao navegador o documento que a API gerou.
 *
 * O nome vem do `Content-Disposition`, com o nome da obra e do cliente. Sem ele,
 * vale o `fallback`, que ja vem traduzido de quem chama.
 */
export function saveDocument (document_: GeneratedDocument, fallback: string): void {
  const url = URL.createObjectURL(document_.blob)
  const link = document.createElement('a')

  link.href = url
  link.download = document_.fileName ?? fallback
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()

  // Revogar na hora cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
