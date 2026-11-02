import { i18n } from '@/i18n'
import { getMapSeoDescription, getMapSeoTitle } from '@/constants/mapSeo'
import { SEO_TITLE_MAX_LENGTH } from '@/utils/seoText'
import { formatMapPoints, getMapPointLabel, qualifyMapPointCount } from '@/utils/mapPointCount'
import { getPlacesLabel, buildTravelListSummaryHint } from '@/components/MapPage/TravelListPanel/helpers'

const cases = [
  ['ru', ['точка', 'точки', 'точек'], 'Загружено: 5 точек'],
  ['be', ['кропка', 'кропкі', 'кропак'], 'Загружана: 5 кропак'],
  ['uk', ['точка', 'точки', 'точок'], 'Завантажено: 5 точок'],
  ['pl', ['punkt', 'punkty', 'punktów'], 'Wczytano: 5 punktów'],
  ['en', ['point', 'points', 'points'], 'Loaded: 5 points'],
] as const

describe('map point identity and loaded scope in every production locale', () => {
  afterEach(async () => { await i18n.changeLanguage('ru') })

  it.each(cases)('uses point plural forms and distinguishes loaded counts in %s', async (locale, forms, loaded) => {
    await i18n.changeLanguage(locale)
    for (const [index, count] of [1, 2, 5].entries()) {
      expect(getMapPointLabel(count)).toBe(forms[index])
      expect(getPlacesLabel(count)).toBe(forms[index])
      expect(formatMapPoints(count)).toBe(`${count} ${forms[index]}`)
    }
    expect(qualifyMapPointCount(formatMapPoints(5), 'loaded')).toBe(loaded)
    expect(qualifyMapPointCount(formatMapPoints(5), 'radius')).toBe(`5 ${forms[2]}`)
    // #2938: owner decision 2026-11-02 brings the country back (reverses
    // #2382); the brand is spelled "Metravel" like on every other page.
    expect(getMapSeoTitle()).toMatch(/Беларус|Білорус|Belarus|Białoru/)
    expect(getMapSeoDescription()).toMatch(/Беларус|Білорус|Belarus|Białoru/)
    expect(getMapSeoTitle()).toMatch(/ \| Metravel$/)
    expect(getMapSeoTitle().length).toBeLessThanOrEqual(SEO_TITLE_MAX_LENGTH)
    expect(getMapSeoDescription().length).toBeLessThanOrEqual(160)
  })

  it('describes multiple point records at the same coordinate without inferring unique places', () => {
    expect(buildTravelListSummaryHint({ travelsCount: 332, compactPreview: false, currentRadiusKm: 50 }))
      .toContain('332 точки в радиусе 50 км')
  })
})
