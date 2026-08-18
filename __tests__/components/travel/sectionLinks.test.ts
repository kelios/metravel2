let mockCanRenderBelkraj = true

// Ссылка «Экскурсии» гейтится тем же предикатом, что и сама ExcursionsSection
// (координаты + production + страна каталога). В jest предикат закрыт, поэтому
// открываем его явно — иначе тест проверял бы не инвариант, а окружение.
jest.mock('@/components/belkraj/belkrajAvailability', () => ({
  ...(jest.requireActual('@/components/belkraj/belkrajAvailability') as object),
  canRenderBelkrajWidget: () => mockCanRenderBelkraj,
}))

import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'

const travelWithPoints = {
  description: 'Описание маршрута',
  gallery: [],
  travelAddress: [{ name: 'Точка', lat: 53.9, lng: 27.56 }],
} as any

describe('buildTravelSectionLinks', () => {
  beforeEach(() => {
    mockCanRenderBelkraj = true
  })

  it('keeps excursions on web where the section is rendered', () => {
    const links = buildTravelSectionLinks(travelWithPoints, { platform: 'web' })

    expect(links.map((link) => link.key)).toContain('excursions')
  })

  it('keeps excursions on Android where the native section is rendered', () => {
    const links = buildTravelSectionLinks(travelWithPoints, { platform: 'android' })

    expect(links.map((link) => link.key)).toContain('excursions')
    expect(links.map((link) => link.key)).toEqual(
      expect.arrayContaining(['description', 'excursions', 'map', 'points']),
    )
  })

  // Инвариант: пункт навигации существует ровно там, где рендерится секция.
  // Если Belkraj-виджет ничего не отдаст, ExcursionsSection возвращает null —
  // ссылка, ведущая в никуда, появляться не должна.
  it.each(['web', 'android'] as const)(
    'drops the excursions link on %s when the widget cannot render',
    (platform) => {
      mockCanRenderBelkraj = false

      const links = buildTravelSectionLinks(travelWithPoints, { platform })

      expect(links.map((link) => link.key)).not.toContain('excursions')
      // Соседние ссылки не задеты — режем только экскурсии.
      expect(links.map((link) => link.key)).toEqual(
        expect.arrayContaining(['description', 'map', 'points']),
      )
    },
  )
})
