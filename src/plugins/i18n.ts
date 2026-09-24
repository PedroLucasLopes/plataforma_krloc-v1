import type en from '@/locales/en.json'
import { preferredLocale } from '@pedrolucaslopes/dotlog-ui'
import { createI18n } from 'vue-i18n'

export type MessageSchema = typeof en

declare module 'vue-i18n' {
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

export const currentLocale = (): string => i18n.global.locale.value
