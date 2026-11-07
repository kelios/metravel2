import { RADIUS_OPTIONS } from '@/constants/mapConfig'
import { mapIntentToFilters, nearestRadiusOption, normalizeMapIntent } from '@/utils/mapIntent'
import { OSM_POI_CATEGORY_IDS } from '@/utils/overpass/buildOverpassQuery'

// #2887: JSON `/ai/intent` → что применяет панель карты.
describe('normalizeMapIntent', () => {
  it('оставляет только категории слоя POI, без повторов, и известные constraints', () => {
    expect(
      normalizeMapIntent({
        categories: ['viewpoints', 'castles', 'viewpoints', 7, 'history'],
        radius_km: 50,
        center: { name: '  Несвиж ' },
        constraints: { camper: true, pets: true, kids: 'yes', free: false },
      }),
    ).toEqual({ categories: ['viewpoints', 'history'], radius_km: 50, center: { name: 'Несвиж' }, constraints: { camper: true, free: false } })
  })

  it('null — не объект или ни одной категории карты', () => {
    expect(normalizeMapIntent(null)).toBeNull()
    expect(normalizeMapIntent(['history'])).toBeNull()
    expect(normalizeMapIntent({ categories: ['castles'], radius_km: 50, center: null })).toBeNull()
    expect(normalizeMapIntent({ radius_km: 50, center: null })).toBeNull()
  })

  it('кривой радиус и центр без имени → null-поля, а не отказ', () => {
    expect(normalizeMapIntent({ categories: ['culture'], radius_km: '50', center: { lat: 1 } })).toEqual({
      categories: ['culture'],
      radius_km: null,
      center: null,
      constraints: {},
    })
  })
})

describe('nearestRadiusOption', () => {
  it('ближайший из RADIUS_OPTIONS, при равном расстоянии — меньший', () => {
    expect(RADIUS_OPTIONS.map((option) => option.id)).toEqual(['10', '25', '50', '100', '200'])
    expect(nearestRadiusOption(50)).toBe('50')
    expect(nearestRadiusOption(30)).toBe('25')
    expect(nearestRadiusOption(40)).toBe('50')
    expect(nearestRadiusOption(75)).toBe('50')
    expect(nearestRadiusOption(3)).toBe('10')
    expect(nearestRadiusOption(1000)).toBe('200')
  })
})

describe('mapIntentToFilters', () => {
  it('категории → слой POI, радиус → id фильтра, центр → имя, true-constraints → список без фильтра', () => {
    expect(
      mapIntentToFilters({
        categories: ['viewpoints', 'history'],
        radius_km: 60,
        center: { name: 'Несвиж' },
        constraints: { camper: true, dogs: false, kids: true },
      }),
    ).toEqual({ osmCategories: ['viewpoints', 'history'], radius: '50', centerName: 'Несвиж', unsupportedConstraints: ['camper', 'kids'] })
  })

  it('без радиуса и центра — null, все категории схемы проходят', () => {
    const filters = mapIntentToFilters({ categories: [...OSM_POI_CATEGORY_IDS], radius_km: null, center: null, constraints: {} })
    expect(filters).toEqual({ osmCategories: [...OSM_POI_CATEGORY_IDS], radius: null, centerName: null, unsupportedConstraints: [] })
  })
})
