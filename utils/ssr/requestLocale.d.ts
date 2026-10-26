import type { SupportedLocale } from '@/i18n/config'
import type { LoadedTranslation } from '@/i18n/catalogCompiler'

export type RequestLocaleContext = Readonly<{ locale: SupportedLocale }>
export type RequestLocaleStore = {
  getStore(): RequestLocaleContext | undefined
  run<T>(context: RequestLocaleContext, callback: () => T): T
}
export type ServerLocaleCatalogState = {
  loadedCatalogs: Map<SupportedLocale, Map<number, LoadedTranslation>>
  loadPromises: Map<SupportedLocale, Promise<void>>
  readyPromises: Map<SupportedLocale, Promise<void>>
}
export function isServerSsrRuntime(): boolean
export function resolveRequestLocale(url: string | undefined): SupportedLocale
export function getRequestLocaleStore(): RequestLocaleStore | undefined
export function installRequestLocaleStore(store: RequestLocaleStore): RequestLocaleStore
export function readRequestLocale(): SupportedLocale | null
export function getServerLocaleCatalogState(): ServerLocaleCatalogState | null
