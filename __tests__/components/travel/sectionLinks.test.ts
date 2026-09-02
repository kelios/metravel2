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

  // Тот же инвариант для видео: TravelDetailsContentSection рисует секцию только
  // когда `safeGetYoutubeId` достаёт id, поэтому непарсящаяся ссылка не должна
  // давать пункт навигации. Сентинел `__draft_placeholder__` до экрана обычно не
  // доходит (его срезает normalizeTravelItem), но сюда травел попадает и мимо
  // нормализатора — в SSG и из скриптов.
  it.each([
    ['a parseable YouTube url', 'https://www.youtube.com/embed/dQw4w9WgXcQ?v=dQw4w9WgXcQ', true],
    ['a youtu.be short link', 'https://youtu.be/dQw4w9WgXcQ', true],
    ['the draft sentinel', '__draft_placeholder__', false],
    ['another video host', 'https://vimeo.com/76979871', false],
    ['an empty string', '', false],
    ['null', null, false],
  ] as const)('gates the video link on %s', (_label, youtube_link, expected) => {
    const links = buildTravelSectionLinks({ ...travelWithPoints, youtube_link } as any)

    expect(links.map((link) => link.key).includes('video')).toBe(expected)
    // Соседние ссылки не задеты — гейтим только видео.
    expect(links.map((link) => link.key)).toEqual(
      expect.arrayContaining(['description', 'map', 'points']),
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
