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

  it('hotels deep-links to the Ostrovok country page by ISO code, with {subid}', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'PL', country: 'Польша', travelId: 384 })
    expect(offer.url).toContain('marker=123456.travel384')
    expect(offer.url).toContain(encodeURIComponent('https://ostrovok.ru/hotel/poland/'))
    expect(offer.subtitle).toContain('Польша')
  })

  it('hotels falls back to the Ostrovok homepage for an unmapped country', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'ZZ', country: 'Нигде' })
    expect(offer.url).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(offer.url).not.toContain(encodeURIComponent('/hotel/'))
  })

  it('tours deep-links to the Tripster country page by ISO code', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'PL' })
    expect(offer.key).toBe('tours')
    expect(offer.url).toContain(encodeURIComponent('https://experience.tripster.ru/experience/poland/'))
  })

  it('tours falls back to the Tripster homepage for an unmapped country', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = TOURS_TPL
    const [offer] = getAffiliateOffers({ countryCode: 'ZZ' })
    expect(offer.url).toContain(encodeURIComponent('https://experience.tripster.ru/'))
    expect(offer.url).not.toContain(encodeURIComponent('/experience/'))
  })

  it('still builds offers from a country name when no countryCode resolves', () => {
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '123456'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = HOTELS_TPL
    const [offer] = getAffiliateOffers({ country: 'Беларусь' })
    // no ISO code → homepage, but the offer still renders with the country in copy
    expect(offer.url).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(offer.subtitle).toContain('Беларусь')
  })
})
