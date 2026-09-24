import type { GeneratedDocument } from '@/types/krloc'

export function saveDocument (document_: GeneratedDocument, fallback: string): void {
  const url = URL.createObjectURL(document_.blob)
  const link = document.createElement('a')

  link.href = url
  link.download = document_.fileName ?? fallback
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
