/**
 * Build-time helpers the quest SSR projection reads (`scripts/lib/questWebProjection.js`).
 *
 * The static v1 quest SEO package (#2365 B) — generator-rendered member pages,
 * R1/R2 receipts, manifest and package verification — was retired with the
 * static generator (#2766). What remains: the shared SSG translator and the
 * catalog-vs-revision identity check of the private snapshot.
 */
const path = require('path')

const { LOCALES, LOCALE_META, assertCatalogMatchesReceipt, createSsgTranslator } = require('@/scripts/lib/questLocalePackage')
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin')
const { questRouteKey } = require('@/utils/questCityAlias')
const { LOCALE_REGISTRY } = require('@/i18n/config')

const CATALOGS = loadSsgCatalogs(path.resolve(__dirname, '..', '..')).catalogs

const QUESTS = ['alpha', 'bravo', 'charlie', 'delta'].map((slug) => ({
  quest_id: `quest-${slug}`, city_id: '4', city_name: 'Минск', title: `Квест ${slug}`, points: 2,
}))
const receiptFor = (quests: typeof QUESTS) => ({
  quests: quests.map((quest, index) => ({ quest_pk: index + 1, city_id: Number(quest.city_id), quest_slug: quest.quest_id })),
})

describe('shared SSG translator', () => {
  it('translates through the shipped catalogs and fails on a missing key', () => {
    const pl = createSsgTranslator(CATALOGS, 'pl')
    expect(pl.tp('seoSsg:questDetail.factRoute', 5)).toBe('Trasa: 5 punktów')
    expect(() => pl.t('seoSsg:questDetail.doesNotExist')).toThrow(/Missing pl translation/)
    expect(() => createSsgTranslator(CATALOGS, 'de')).toThrow(/No i18n catalog/)
  })

  it('keeps the SSG locale registry in parity with i18n/config.ts', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_META[locale]).toEqual({
        languageTag: LOCALE_REGISTRY[locale].languageTag, ogLocale: LOCALE_REGISTRY[locale].ogLocale,
      })
    }
  })
})

describe('catalog vs revision identities', () => {
  it('accepts a catalog that names exactly the snapshot identities', () => {
    const byIdentity = assertCatalogMatchesReceipt(QUESTS, receiptFor(QUESTS), questRouteKey)
    expect([...byIdentity.keys()]).toEqual(QUESTS.map((quest) => `4/${quest.quest_id}`))
  })

  it('rejects a catalog that disagrees with the snapshot identities', () => {
    expect(() => assertCatalogMatchesReceipt(QUESTS, receiptFor(QUESTS.slice(0, 2)), questRouteKey))
      .toThrow(/catalog ≠ revision receipt/)
    expect(() => assertCatalogMatchesReceipt(QUESTS.slice(0, 2), receiptFor(QUESTS), questRouteKey))
      .toThrow(/receipt-only: 4\/quest-charlie, 4\/quest-delta/)
  })
})
