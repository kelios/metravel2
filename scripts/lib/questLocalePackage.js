/**
 * scripts/lib/questLocalePackage.js
 * Shared build-time helpers of the quest SSR projection
 * (`scripts/lib/questWebProjection.js`).
 *
 * #2766: the static v1 quest SEO package (#2365 B) — the build-time generator,
 * R1/R2 revision receipts, the private candidate, manifest and package
 * verification — is retired: quest pages are rendered per request by the SSR
 * loaders from the immutable projection. What remains is what the projection
 * reads:
 *   - `createSsgTranslator` — build-time labels from the app catalogs plus the
 *     SSG-only `ssg/` catalogs (`loadSsgCatalogs`); a missing key fails, so a
 *     localized page never silently shows RU;
 *   - `assertCatalogMatchesReceipt` — the published catalog and the private
 *     snapshot's revision records must name exactly the same detail identities.
 */

const { selectPluralCategory } = require('../../i18n/pluralRules')

const LOCALES = Object.freeze(['ru', 'be', 'uk', 'pl', 'en'])
// Kept in parity with `LOCALE_REGISTRY` of i18n/config.ts by
// __tests__/scripts/questLocalePackage.test.ts.
const LOCALE_META = Object.freeze({
  ru: { languageTag: 'ru-RU', ogLocale: 'ru_RU' },
  be: { languageTag: 'be-BY', ogLocale: 'be_BY' },
  uk: { languageTag: 'uk-UA', ogLocale: 'uk_UA' },
  pl: { languageTag: 'pl-PL', ogLocale: 'pl_PL' },
  en: { languageTag: 'en-US', ogLocale: 'en_US' },
})

// ---------------------------------------------------------------------------
// Translation for build-time pages (runtime catalogs + SSG-only `ssg/` catalogs, see loadSsgCatalogs)
// ---------------------------------------------------------------------------

function interpolate(template, params = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => (params[key] == null ? '' : String(params[key])))
}

/** A missing key fails the build: a localized page never silently shows RU. */
function createSsgTranslator(catalogs, locale) {
  const catalog = catalogs && catalogs.get(locale)
  if (!catalog || !LOCALE_META[locale]) throw new Error(`No i18n catalog for quest SSG locale ${locale}`)
  const read = (key) => {
    const value = catalog.get(key)
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${locale} translation: ${key}`)
    return value
  }
  const t = (key, params) => interpolate(read(key.includes(':') ? key : `seo:${key}`), params)
  const tp = (key, count, params = {}) => {
    const full = key.includes(':') ? key : `seo:${key}`
    const category = selectPluralCategory(count, LOCALE_META[locale].languageTag)
    const value = catalog.get(`${full}_${category}`) ?? catalog.get(full)
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${locale} plural translation: ${full}_${category}`)
    return interpolate(value, { ...params, count })
  }
  return { locale, languageTag: LOCALE_META[locale].languageTag, ogLocale: LOCALE_META[locale].ogLocale, t, tp }
}

/** Catalog and receipt must name exactly the same published detail identities. */
function assertCatalogMatchesReceipt(quests, receipt, questRouteKey) {
  const byIdentity = new Map(receipt.quests.map((record) => [`${record.city_id}/${record.quest_slug}`, record]))
  const catalog = new Set()
  for (const quest of quests) {
    const route = questRouteKey(quest)
    if (!route) continue
    catalog.add(`${Number(route.cityId)}/${route.questId}`)
  }
  const missing = [...catalog].filter((key) => !byIdentity.has(key))
  const extra = [...byIdentity.keys()].filter((key) => !catalog.has(key))
  if (missing.length || extra.length) {
    throw new Error(
      `quest catalog ≠ revision receipt (catalog-only: ${missing.slice(0, 10).join(', ') || '—'}; ` +
      `receipt-only: ${extra.slice(0, 10).join(', ') || '—'}) — candidate rejected`,
    )
  }
  return byIdentity
}

module.exports = {
  LOCALES,
  LOCALE_META,
  assertCatalogMatchesReceipt,
  createSsgTranslator,
}
