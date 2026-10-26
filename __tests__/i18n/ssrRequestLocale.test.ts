/** @jest-environment node */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupportedLocale } from '@/i18n/config'
import type { TranslationKey } from '@/i18n/resources'
import type { RequestLocaleContext } from '@/utils/ssr/requestLocale'

jest.mock('@/i18n/instance', () => jest.requireActual('@/i18n/instance.web'))

const bridge = require('@/utils/ssr/requestLocale') as typeof import('@/utils/ssr/requestLocale')
const originalFlag = process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
const localeKey = Symbol.for('metravel.ssr.locale')
const catalogueKey = Symbol.for('metravel.ssr.localeCatalogs')
const scope = globalThis as typeof globalThis & Record<symbol, unknown>
const previousStore = scope[localeKey]
const previousCatalogues = scope[catalogueKey]
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const store = new AsyncLocalStorage<RequestLocaleContext>()
let runtime: typeof import('@/i18n/translate.web')
let i18n: typeof import('@/i18n/instance.web').default
let format: typeof import('@/i18n/format')

beforeAll(() => {
  delete (globalThis as { window?: unknown }).window
  process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
  delete scope[localeKey]
  delete scope[catalogueKey]
  bridge.installRequestLocaleStore(store)
  runtime = require('@/i18n/translate.web')
  i18n = require('@/i18n/instance.web').default
  format = require('@/i18n/format')
})

afterAll(() => {
  store.disable()
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
  else process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = originalFlag
  if (previousStore === undefined) delete scope[localeKey]
  else scope[localeKey] = previousStore
  if (previousCatalogues === undefined) delete scope[catalogueKey]
  else scope[catalogueKey] = previousCatalogues
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
})

describe('request-local web locale', () => {
  it('selects only canonical quest URL locales, including loader requests', () => {
    expect(bridge.resolveRequestLocale('/pl/quests/1/test')).toBe('pl')
    expect(bridge.resolveRequestLocale('/_expo/loaders/en/quests/1/test')).toBe('en')
    expect(bridge.resolveRequestLocale('/pl/search')).toBe('ru')
    expect(bridge.resolveRequestLocale('/xx/quests/1/test')).toBe('ru')
    expect(bridge.resolveRequestLocale('/pl/quests/0/test')).toBe('ru')
    expect(bridge.resolveRequestLocale('/travels/test?locale=en')).toBe('ru')
  })

  it('keeps translations, locale metadata and date formatting isolated across interleaved requests', async () => {
    const locales: SupportedLocale[] = ['en', 'ru', 'be', 'uk', 'pl']
    const expected = { ru: 'Русский', be: 'Руская', uk: 'Російська', pl: 'Rosyjski', en: 'Russian' }
    const key = { h: runtime.hashTranslationKey('common:language.ru'), v: 'Русский' } as unknown as TranslationKey
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    const requests = locales.map((locale) => store.run(Object.freeze({ locale }), async () => {
      await runtime.prepareServerWebLocale(locale)
      await barrier
      await Promise.resolve()
      expect(i18n.language).toBe(locale)
      expect(i18n.resolvedLanguage).toBe(locale)
      expect(runtime.translate(key)).toBe(expected[locale])
      expect(format.getActiveLocale()).toBe(locale)
      const sample = new Date('2026-09-02T09:05:00Z')
      expect(format.formatDate(sample, { month: 'long', timeZone: 'UTC' }))
        .toBe(format.formatDate(sample, { month: 'long', timeZone: 'UTC' }, locale))
    }))
    release()
    await Promise.all(requests)
    expect(bridge.readRequestLocale()).toBeNull()
    expect(i18n.resolvedLanguage).toBe('ru')
    expect(bridge.getServerLocaleCatalogState()?.loadedCatalogs.size).toBe(4)
  })

  it('shares finite readiness resources across independent Metro module instances', async () => {
    let second!: typeof import('@/i18n/translate.web')
    jest.isolateModules(() => { second = require('@/i18n/translate.web') })
    const first = runtime.prepareServerWebLocale('pl')
    expect(second.prepareServerWebLocale('pl')).toBe(first)
    await first
    expect(second.isWebLocaleLoaded('pl')).toBe(true)
    await expect(runtime.loadWebLocale('xx' as SupportedLocale)).rejects.toThrow('Unsupported locale')
    expect(bridge.getServerLocaleCatalogState()?.loadedCatalogs.size).toBe(4)
  })

  it('rejects global server language changes without affecting the current request', async () => {
    await store.run({ locale: 'be' }, async () => {
      await expect(i18n.changeLanguage('en')).rejects.toThrow('belongs to the request')
      expect(i18n.resolvedLanguage).toBe('be')
    })
    expect(i18n.resolvedLanguage).toBe('ru')
  })

  it('preloads through middleware only within a trusted request context', async () => {
    const middleware = (require('@/app/+middleware') as typeof import('@/app/+middleware')).default
    await expect(middleware()).rejects.toMatchObject({ httpStatus: 503 })
    await store.run({ locale: 'pl' }, async () => {
      await middleware()
      expect(runtime.isWebLocaleLoaded('pl')).toBe(true)
      expect(i18n.resolvedLanguage).toBe('pl')
    })
  })

  it('retries a failed catalogue on the next request instead of retaining a rejected readiness resource', async () => {
    const previous = scope[catalogueKey]
    delete scope[catalogueKey]
    jest.doMock('@/i18n/deferred/locale-uk', () => { throw new Error('temporary catalogue failure') })
    try {
      let isolated!: typeof import('@/i18n/translate.web')
      jest.isolateModules(() => { isolated = require('@/i18n/translate.web') })
      const failed = isolated.prepareServerWebLocale('uk')
      await expect(failed).rejects.toMatchObject({ httpStatus: 503 })
      expect(bridge.getServerLocaleCatalogState()?.readyPromises.has('uk')).toBe(false)
      jest.dontMock('@/i18n/deferred/locale-uk')
      const retry = isolated.prepareServerWebLocale('uk')
      expect(retry).not.toBe(failed)
      await retry
      expect(isolated.isWebLocaleLoaded('uk')).toBe(true)
    } finally {
      jest.dontMock('@/i18n/deferred/locale-uk')
      scope[catalogueKey] = previous
    }
  })
})
