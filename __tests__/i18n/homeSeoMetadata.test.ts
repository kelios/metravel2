import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config'
import { resources } from '@/i18n/resources'

const PRIMARY_OFFER_TERMS: Record<SupportedLocale, RegExp[]> = {
  ru: [/квест/i, /выходн/i, /Беларус/i],
  be: [/квэст/i, /выходн/i, /Беларус/i],
  uk: [/квест/i, /вихідн/i, /Білорус/i],
  pl: [/quest/i, /weekend/i, /Białorus/i],
  en: [/quest/i, /weekend/i, /Belarus/i],
}

const FORMAT_TERMS: Record<SupportedLocale, RegExp[]> = {
  ru: [/городск/i, /маршрут/i, /задани/i, /карт/i],
  be: [/гарадск/i, /маршрут/i, /задан/i, /карц/i],
  uk: [/міськ/i, /маршрут/i, /завдан/i, /карт/i],
  pl: [/miejsk/i, /tras/i, /zadan/i, /map/i],
  en: [/city/i, /route/i, /challenge/i, /map/i],
}

const SECONDARY_PDF_OFFER = /(pdf|книг|кніг|książ|book)/i

describe('localized home SEO metadata', () => {
  it.each(SUPPORTED_LOCALES)('%s names the primary offer and geography without making PDF dominant', (locale) => {
    const title = resources[locale].seoStatic['root.home.title']
    const description = resources[locale].seoStatic['root.home.description']

    for (const term of PRIMARY_OFFER_TERMS[locale]) {
      expect(title).toMatch(term)
    }
    for (const term of FORMAT_TERMS[locale]) {
      expect(description).toMatch(term)
    }

    expect(`${title} ${description}`).not.toMatch(SECONDARY_PDF_OFFER)
    expect(title.length).toBeLessThanOrEqual(60)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it.each(SUPPORTED_LOCALES)('%s has one complete brand suffix and no trailing truncation', (locale) => {
    const title = resources[locale].seoStatic['root.home.title']
    const description = resources[locale].seoStatic['root.home.description']

    expect(title.endsWith('| Metravel')).toBe(true)
    expect(title.match(/\| Metravel/g)).toHaveLength(1)
    expect(title).not.toMatch(/(?:\.\.\.|…)\s*$/)
    expect(description).not.toMatch(/(?:\.\.\.|…)\s*$/)
  })
})
