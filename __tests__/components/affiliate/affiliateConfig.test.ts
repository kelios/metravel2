import {
  getAffiliateOffers,
  isAffiliateEnabled,
  transliterate,
} from '@/components/affiliate/affiliateConfig'

const ENV_KEYS = [
  'EXPO_PUBLIC_TRAVELPAYOUTS_MARKER',
  'EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE',
  'EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE',
] as const

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
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = 'https://tp.media/r?u={query}'
    expect(isAffiliateEnabled()).toBe(false)
    expect(getAffiliateOffers({ city: 'Минск' })).toEqual([])
  })

  it('returns only offers whose template is configured', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = 'https://tp.media/r?u={query}'
    const offers = getAffiliateOffers({ city: 'Минск' })
    expect(offers.map((o) => o.key)).toEqual(['hotels'])
  })

  it('interpolates {query} (URL-encoded Cyrillic city) and {subid} for hotels', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE =
      'https://tp.media/r?marker=123456.{subid}&u=https%3A%2F%2Fostrovok.ru%2Fhotel%2Fsearch%2F%3Fq%3D{query}'
    const [offer] = getAffiliateOffers({ city: 'Минск', travelId: 384 })
    expect(offer.url).toContain('marker=123456.travel384')
    expect(offer.url).toContain('q%3D' + encodeURIComponent('Минск'))
  })

  it('transliterates the city to a Latin path slug for tours (Tripster)', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE =
      'https://tp.media/r?marker=123456.{subid}&u=https%3A%2F%2Fexperience.tripster.ru%2Fexperience%2F{query}%2F'
    const [offer] = getAffiliateOffers({ city: 'Краков', travelId: 384 })
    expect(offer.key).toBe('tours')
    // /experience/krakov/ — Cyrillic would 404 on Tripster
    expect(offer.url).toContain('experience%2Fkrakov%2F')
    expect(offer.url).not.toContain('%D0%9A') // no Cyrillic in the slug
  })

  it('falls back to country when city is absent', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = 'https://tp.media/r?u={query}'
    const [offer] = getAffiliateOffers({ country: 'Беларусь' })
    expect(offer.url).toContain(encodeURIComponent('Беларусь'))
  })

  it('skips a {query} offer when no destination is resolvable', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = 'https://tp.media/r?u={query}'
    expect(getAffiliateOffers({})).toEqual([])
  })
})

describe('transliterate', () => {
  it.each([
    ['Краков', 'krakov'],
    ['Гродно', 'grodno'],
    ['Минск', 'minsk'],
    ['Закопане', 'zakopane'],
    ['Щучин', 'shchuchin'],
  ])('%s → %s', (input, expected) => {
    expect(transliterate(input)).toBe(expected)
  })

  it('returns empty string for empty input', () => {
    expect(transliterate('')).toBe('')
  })
})
