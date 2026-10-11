import { i18n } from '@/i18n'
import { getMapSeoDescription, getMapSeoTitle } from '@/constants/mapSeo'
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
    expect(getMapSeoTitle()).not.toMatch(/Беларус|Belarus|Białoru/i)
    expect(getMapSeoDescription()).not.toMatch(/Беларус|Belarus|Białoru/i)
    expect(getMapSeoTitle()).toContain('MeTravel')
  })

  it('describes multiple point records at the same coordinate without inferring unique places', () => {
    expect(buildTravelListSummaryHint({ travelsCount: 332, compactPreview: false, currentRadiusKm: 50 }))
      .toContain('332 точки в радиусе 50 км')
  })
})
