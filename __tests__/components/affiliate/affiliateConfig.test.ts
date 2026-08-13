import {
  getAffiliateOffers,
  isAffiliateEnabled,
} from '@/components/affiliate/affiliateConfig'

const ENV_KEYS = [
  'EXPO_PUBLIC_TRAVELPAYOUTS_MARKER',
  'EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE',
  'EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE',
] as const

const HOTELS_TPL = 'https://tp.media/r?marker=123456.{subid}&p=7038&trs=423278&u={url}'
const TOURS_TPL = 'https://tp.media/r?marker=123456.{subid}&p=652&trs=423278&u={url}'

describe('affiliateConfig', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    ENV_KEYS.forEach((k) => {
      original[k] = process.env[k]
      delete process.env[k]
    })
  })

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    })
  })

  it('is disabled and yields no offers without a marker', () => {
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    expect(isAffiliateEnabled()).toBe(false)
    expect(getAffiliateOffers({ countryCode: 'BY' })).toEqual([])
  })

  it('returns only offers whose template is configured', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const offers = getAffiliateOffers({ countryCode: 'BY' })
    expect(offers.map((o) => o.key)).toEqual(['hotels'])
  })

  it.each([
    ['http protocol', 'http://tp.media/r?marker=123456.{subid}&p=7038&trs=423278&u={url}'],
    ['lookalike host', 'https://tp.media.evil.test/r?marker=123456.{subid}&p=7038&trs=423278&u={url}'],
    ['wrong marker', 'https://tp.media/r?marker=999999.{subid}&p=7038&trs=423278&u={url}'],
    ['missing destination', 'https://tp.media/r?marker=123456.{subid}&p=7038&trs=423278'],
    ['missing program id', 'https://tp.media/r?marker=123456.{subid}&trs=423278&u={url}'],
    ['missing source id', 'https://tp.media/r?marker=123456.{subid}&p=7038&u={url}'],
    ['non-numeric program id', 'https://tp.media/r?marker=123456.{subid}&p=hotel&trs=423278&u={url}'],
    ['unexpected marker suffix', 'https://tp.media/r?marker=123456.other&p=7038&trs=423278&u={url}'],
    [
      'placeholder outside redirect destination',
      'https://tp.media/r?marker=123456.{subid}&p=7038&trs=423278&u=https%3A%2F%2Fevil.test%2F&extra={url}',
    ],
    [
      'duplicate destination',
      'https://tp.media/r?marker=123456.{subid}&p=7038&trs=423278&u={url}&u=https%3A%2F%2Fevil.test%2F',
    ],
  ])('fails closed for a malformed affiliate template: %s', (_label, template) => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = template

    expect(getAffiliateOffers({ countryCode: 'BY' })).toEqual([])
  })

  it('hotels deep-links to the Ostrovok country page by ISO code, with {subid}', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'PL', country: 'Польша', travelId: 384 })
    expect(offer.url).toContain('marker=123456.travel384')
    expect(offer.url).toContain(encodeURIComponent('https://ostrovok.ru/hotel/poland/'))
    expect(offer.subtitle).toContain('Польша')
  })

  // #1386: страны, которые резолвер научился определять по координатам. Слаги
  // проверены на живых страницах обеих площадок (с контролем на заведомо
  // несуществующем слаге), поэтому ссылка обязана быть страновой, а не homepage.
  it.each([
    ['FI', 'finland'],
    ['KG', 'kyrgyzstan'],
    ['MN', 'mongolia'],
    ['NO', 'norway'],
    ['SE', 'sweden'],
    ['DK', 'denmark'],
  ])('deep-links both partners to the %s country page', (countryCode, slug) => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL

    const [tours, hotels] = getAffiliateOffers({ countryCode })
    expect(tours.url).toContain(encodeURIComponent(`https://experience.tripster.ru/destinations/${slug}/`))
    expect(hotels.url).toContain(encodeURIComponent(`https://ostrovok.ru/hotel/${slug}/`))
  })

  it('hotels falls back to the Ostrovok homepage for an unmapped country', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'ZZ', country: 'Нигде' })
    expect(offer.url).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(offer.url).not.toContain(encodeURIComponent('/hotel/'))
  })

  it('tours deep-links to the Tripster /destinations/ country page by ISO code', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'PL' })
    expect(offer.key).toBe('tours')
    expect(offer.url).toContain(encodeURIComponent('https://experience.tripster.ru/destinations/poland/'))
    // /experience/<country>/ is a soft-404 shell on Tripster — must never be used
    expect(offer.url).not.toContain(encodeURIComponent('/experience/'))
  })

  it('tours falls back to the Tripster homepage for an unmapped country', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'ZZ' })
    expect(offer.url).toContain(encodeURIComponent('https://experience.tripster.ru/'))
    expect(offer.url).not.toContain(encodeURIComponent('/destinations/'))
  })

  // Callers that know a real place name (quest city, trip region) keep it in the copy;
  // travel details deliberately passes only the country (its `cityName` is an address).
  it('prefers an explicit city over the country in the offer copy', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    const [offer] = getAffiliateOffers({ city: 'Минск', country: 'Беларусь', countryCode: 'BY' })
    expect(offer.subtitle).toContain('Минск')
    expect(offer.subtitle).not.toContain('Беларусь')
  })

  it('still builds offers from a country name when no countryCode resolves, without naming it', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const [offer] = getAffiliateOffers({ country: 'Беларусь' })
    // no ISO code → homepage: the offer still renders, but the copy goes neutral,
    // because the click no longer takes the reader to Belarus.
    expect(offer.url).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(offer.subtitle).toBe('Отели и апартаменты рядом с маршрутом')
  })

  // #1371. Инвариант «копия ⇔ фактическая ссылка» для стран без страновой
  // страницы у партнёров: CZ/DO нет в COUNTRY_SLUG, UA исключена намеренно, обе
  // ссылки уходят на homepage — значит подпись не имеет права называть страну.
  // Живой баг: travel 642/158 показывали «Отели и апартаменты — Чехия», а вели
  // на ostrovok.ru/. Гард ловит любую новую страну, добавленную без слага.
  // `city` здесь не для красоты: квесты передают city вместе с countryCode
  // (questWizardSections), и без страновой страницы у партнёра настоящий город
  // тоже нельзя ставить в подпись — ссылка ведёт не в Прагу, а на homepage.
  it.each([
    ['CZ', 'Чехия', 'Прага'],
    ['DO', 'Доминиканская Республика', 'Пунта-Кана'],
    ['UA', 'Украина', 'Львов'],
    // #1386: geoCountry научился резолвить KR, но страновой страницы у Ostrovok
    // для неё нет ни под одним слагом — значит подпись страну не называет.
    ['KR', 'Южная Корея', 'Сеул'],
  ])('keeps both offers but names no place for %s when the link is the homepage', (countryCode, country, city) => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL

    const offers = getAffiliateOffers({ countryCode, country, city, travelId: 642 })
    expect(offers.map((o) => o.key)).toEqual(['tours', 'hotels'])
    const [tours, hotels] = offers

    // Точная копия, а не отсутствие подстроки: «Отели и апартаменты — » с
    // отвалившимся местом тоже не содержит страны, но остаётся сломанной.
    expect(tours.subtitle).toBe('Авторские экскурсии и местные гиды')
    expect(tours.url).toContain(encodeURIComponent('https://experience.tripster.ru/'))
    expect(tours.url).not.toContain(encodeURIComponent('/destinations/'))

    expect(hotels.subtitle).toBe('Отели и апартаменты рядом с маршрутом')
    expect(hotels.url).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(hotels.url).not.toContain(encodeURIComponent('/hotel/'))
  })
})
