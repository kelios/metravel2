/**
 * Boot subset of a translated quest member's catalogue (board #2484).
 *
 * The document ships `locale-<lang>-boot-*.js` with the keys of its own
 * chunks; the complete catalogue follows off the critical path. Contract:
 *   1. the subset makes the locale usable at once (boot commits synchronously);
 *   2. the complete catalogue replaces it, and until then every lazily loaded
 *      chunk waits for it, so no later screen renders a key the subset lacks;
 *   3. without a boot subset the full catalogue loads exactly as before.
 */

import type { TranslationKey } from '@/i18n/resources'

type TranslateModule = typeof import('@/i18n/translate.web')
type Loader = (bundlePath: unknown) => Promise<void>

const scope = globalThis as unknown as Record<string, unknown>

const freshTranslate = (): TranslateModule => {
  let loaded: TranslateModule | undefined
  jest.isolateModules(() => {
    loaded = require('@/i18n/translate.web')
  })
  return loaded!
}

const compiled = (mod: TranslateModule, key: string, ru: string) =>
  ({ h: mod.hashTranslationKey(key), v: ru }) as unknown as TranslationKey

describe('web boot catalogue subset', () => {
  afterEach(() => {
    delete scope.__METRAVEL_BOOT_CATALOGS__
    delete scope.__loadBundleAsync
  })

  it('serves the subset at once, then the complete catalogue, holding lazy chunks until it lands', async () => {
    const mod = freshTranslate()
    const inSubset = compiled(mod, 'common:language.ru', 'Русский')
    const outside = compiled(mod, 'common:language.en', 'Английский')
    scope.__METRAVEL_BOOT_CATALOGS__ = { be: [[mod.hashTranslationKey('common:language.ru'), { value: 'Руская (boot)' }]] }
    const original: Loader = jest.fn(() => Promise.resolve())
    scope.__loadBundleAsync = original

    const boot = mod.loadWebLocale('be')
    expect(mod.isWebLocaleLoaded('be')).toBe(true)
    expect(mod.getFixedTranslator('be')(inSubset)).toBe('Руская (boot)')
    expect(mod.getFixedTranslator('be')(outside)).toBe('Английский')
    expect(scope.__METRAVEL_BOOT_CATALOGS__).toEqual({})

    const held = scope.__loadBundleAsync as Loader
    expect(held).not.toBe(original)
    const lazyChunk = held('/_expo/static/js/web/QuestWizard-1.js').then(() => mod.getFixedTranslator('be')(outside))
    await boot
    // The lazy chunk resolves only with the complete catalogue in place.
    expect(await lazyChunk).toBe('English')
    expect(original).toHaveBeenCalledWith('/_expo/static/js/web/QuestWizard-1.js')
    expect(mod.getFixedTranslator('be')(inSubset)).toBe('Руская')
    expect(scope.__loadBundleAsync).toBe(original)
  })

  it('loads the complete catalogue directly when the document ships no subset', async () => {
    const mod = freshTranslate()
    const original: Loader = jest.fn(() => Promise.resolve())
    scope.__loadBundleAsync = original
    const key = compiled(mod, 'common:language.ru', 'Русский')

    expect(mod.isWebLocaleLoaded('pl')).toBe(false)
    await mod.loadWebLocale('pl')
    expect(mod.getFixedTranslator('pl')(key)).toBe('Rosyjski')
    expect(scope.__loadBundleAsync).toBe(original)
  })

  it('a failed complete load keeps the subset, releases lazy chunks and is retried', async () => {
    const mod = freshTranslate()
    jest.doMock('@/i18n/deferred/locale-uk', () => {
      throw new Error('network')
    })
    try {
      const key = compiled(mod, 'common:language.ru', 'Русский')
      scope.__METRAVEL_BOOT_CATALOGS__ = { uk: [[mod.hashTranslationKey('common:language.ru'), { value: 'Російська' }]] }
      const original: Loader = jest.fn(() => Promise.resolve())
      scope.__loadBundleAsync = original

      const outside = compiled(mod, 'common:language.en', 'Английский')
      await mod.loadWebLocale('uk')
      await (scope.__loadBundleAsync as Loader)('/_expo/static/js/web/Footer-1.js')
      expect(mod.getFixedTranslator('uk')(key)).toBe('Російська')
      expect(mod.getFixedTranslator('uk')(outside)).toBe('Английский')

      // The next lazy chunk asks for the complete catalogue again and waits for it.
      jest.dontMock('@/i18n/deferred/locale-uk')
      const retrying = scope.__loadBundleAsync as Loader
      expect(retrying).not.toBe(original)
      await retrying('/_expo/static/js/web/Menu-1.js')
      expect(original).toHaveBeenCalledWith('/_expo/static/js/web/Menu-1.js')
      expect(mod.getFixedTranslator('uk')(outside)).toBe('English')
      expect(scope.__loadBundleAsync).toBe(original)
    } finally {
      jest.dontMock('@/i18n/deferred/locale-uk')
    }
  })
})
