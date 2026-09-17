/**
 * plugins/i18n.ts
 *
 * Os textos do KRLoc. Cada arquivo em `src/locales` e uma lingua, e o nome do
 * arquivo e o codigo dela: `en.json`, `es.json`, `pt-BR.json`.
 *
 * **Lingua nova e so um JSON.** O arquivo entra aqui sozinho, pelo
 * `import.meta.glob`, e o menu do usuario lista a lingua com nome e bandeira,
 * sem declaracao nenhuma. Ele precisa das mesmas chaves do `en.json`, que e a
 * referencia: `npm run check:locales` recusa o que faltar ou sobrar.
 *
 * **A lingua inicial** e a que a pessoa escolheu neste navegador, senao a do
 * navegador, senao o ingles. Ver `preferredLocale`, da biblioteca de UI.
 *
 * Fora de componente, como em store e servico, use o `t` exportado daqui. Ele
 * le a lingua na hora da chamada: dentro de `computed` ou do template, troca
 * junto com o resto da tela.
 */

import type en from '@/locales/en.json'
import { preferredLocale } from '@pedrolucaslopes/dotlog-ui'
import { createI18n } from 'vue-i18n'

export type MessageSchema = typeof en

declare module 'vue-i18n' {
  // Chaves do `en.json` conhecidas pelo editor em `t()` e `$t()`.
  export interface DefineLocaleMessage extends MessageSchema {}
}

export const FALLBACK_LOCALE = 'en'

const files = import.meta.glob<MessageSchema>('../locales/*.json', { eager: true, import: 'default' })

const messages: Record<string, MessageSchema> = Object.fromEntries(
  Object.entries(files).map(([path, message]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), message]),
)

export const i18n = createI18n({
  legacy: false,
  locale: preferredLocale(Object.keys(messages), FALLBACK_LOCALE),
  fallbackLocale: FALLBACK_LOCALE,
  messages,
})

export const t = i18n.global.t

/** Lingua corrente, para `Intl` e para o que formata data e numero. */
export const currentLocale = (): string => i18n.global.locale.value
