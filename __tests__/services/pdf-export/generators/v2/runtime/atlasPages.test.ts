import {
  getAtlasPageCount,
  renderAtlasPages,
  shouldRenderAtlas,
} from '@/services/pdf-export/generators/v2/runtime/atlasPages'
import type { TravelSectionMeta } from '@/services/pdf-export/generators/v2/runtime/types'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'

function makeMeta(
  travelName: string,
  countryName: string,
  year: string,
  startPage: number,
  mapPage: number,
  locations: Array<{ name: string; lat?: number; lng?: number }>,
): TravelSectionMeta {
  return {
    travel: {
      id: travelName,
      name: travelName,
      countryName,
      year,
      slug: travelName.toLowerCase().replace(/\s+/g, '-'),
      gallery: [],
      travelAddress: [],
      description: '',
    } as any,
    hasGallery: false,
    hasMap: true,
    locations: locations.map((l, idx) => ({
      id: `${travelName}-${idx}`,
      address: l.name,
      lat: l.lat,
      lng: l.lng,
      coord: l.lat && l.lng ? `${l.lat},${l.lng}` : undefined,
    })),
    startPage,
    mapPage,
  }
}

describe('Travel atlas (global map + index)', () => {
  const theme = getThemeConfig('minimal')

  const meta: TravelSectionMeta[] = [
    makeMeta('Грузия 2024', 'Грузия', '2024', 6, 8, [
      { name: 'Тбилиси · столица', lat: 41.7151, lng: 44.8271 },
      { name: 'Мцхета', lat: 41.8455, lng: 44.7203 },
      { name: 'Казбеги · Степанцминда', lat: 42.6597, lng: 44.6418 },
      { name: 'Кутаиси', lat: 42.2679, lng: 42.7186 },
    ]),
    makeMeta('Армения 2024', 'Армения', '2024', 12, 14, [
      { name: 'Ереван', lat: 40.1872, lng: 44.5152 },
      { name: 'Гарни', lat: 40.1196, lng: 44.7298 },
      { name: 'Севан', lat: 40.5594, lng: 45.0028 },
    ]),
    makeMeta('Турция 2025', 'Турция', '2025', 18, 20, [
      { name: 'Стамбул', lat: 41.0082, lng: 28.9784 },
      { name: 'Каппадокия · Гёреме', lat: 38.6431, lng: 34.8285 },
      { name: 'Памуккале', lat: 37.9211, lng: 29.1212 },
      { name: 'Эфес', lat: 37.9398, lng: 27.3415 },
      { name: 'Анталья', lat: 36.8969, lng: 30.7133 },
    ]),
  ]

  test('shouldRenderAtlas only when 2+ travels have map points and includeMap is on', () => {
    expect(shouldRenderAtlas(meta, true)).toBe(true)
    expect(shouldRenderAtlas(meta, false)).toBe(false)
    expect(shouldRenderAtlas([meta[0]], true)).toBe(false)
  })

  test('getAtlasPageCount returns 1 map page + N index pages', () => {
    const count = getAtlasPageCount(meta)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('renderAtlasPages emits map page and index pages with correct page numbers', () => {
    const pages = renderAtlasPages({
      meta,
      theme,
      bookTitle: 'Мои путешествия',
      startPageNumber: 4,
    })

    expect(pages.length).toBe(getAtlasPageCount(meta))

    // Map page (first)
    expect(pages[0]).toContain('atlas-map-page')
    expect(pages[0]).toContain('Все точки на карте')
    expect(pages[0]).toContain('Грузия 2024')
    expect(pages[0]).toContain('Армения 2024')
    expect(pages[0]).toContain('Турция 2025')
    // Нативная нумерация: JS-бейдж номера страницы удалён, остаётся текстовый колонтитул
    expect(pages[0]).not.toContain('data-page-num')
    expect(pages[0]).toContain('АТЛАС 1 /')

    // Index page (second)
    expect(pages[1]).toContain('atlas-index-page')
    expect(pages[1]).toContain('УКАЗАТЕЛЬ ТОЧЕК')
    // Map pages from meta should appear in index
    expect(pages[1]).toMatch(/data-atlas-page[^>]*>\s*8\s*</)
    expect(pages[1]).toMatch(/data-atlas-page[^>]*>\s*14\s*</)
    expect(pages[1]).toMatch(/data-atlas-page[^>]*>\s*20\s*</)
  })

  test('renderAtlasPages returns [] when only one travel has map points', () => {
    expect(renderAtlasPages({ meta: [meta[0]], theme, startPageNumber: 4 })).toEqual([])
  })

  test('atlas map page colors points by travel (palette cycling)', () => {
    const pages = renderAtlasPages({
      meta,
      theme,
      startPageNumber: 4,
    })
    // Палитра первых трёх путешествий — coral / azure / amber
    expect(pages[0]).toContain('#D2604A')
    expect(pages[0]).toContain('#3F7CAC')
    expect(pages[0]).toContain('#D9A445')
  })

  test('atlas map ignores non-finite coordinates and fills the first map card', () => {
    const pages = renderAtlasPages({
      meta: [
        makeMeta('Валидное путешествие', 'Грузия', '2024', 6, 8, [
          { name: 'Тбилиси', lat: 41.7151, lng: 44.8271 },
          { name: 'Битая точка', lat: Number.NaN, lng: 44.8271 },
        ]),
        makeMeta('Второе путешествие', 'Армения', '2024', 12, 14, [
          { name: 'Ереван', lat: 40.1872, lng: 44.5152 },
          { name: 'Битая долгота', lat: 40.1872, lng: Number.POSITIVE_INFINITY },
        ]),
      ],
      theme,
      startPageNumber: 4,
    })

    expect(pages[0]).toContain('atlas-map-page')
    expect(pages[0]).toContain('style="width:100%;height:100%;display:block;"')
    expect(pages[0]).not.toContain('NaN')
    expect(pages[0]).not.toContain('Infinity')
  })
})
