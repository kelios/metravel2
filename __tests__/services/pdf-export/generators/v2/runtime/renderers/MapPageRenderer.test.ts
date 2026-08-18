import { RuntimeMapRenderer } from '@/services/pdf-export/generators/v2/runtime/renderers/MapPageRenderer'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
import { i18n } from '@/i18n'

describe('RuntimeMapRenderer', () => {
  it('renders the snapshot image when snapshotDataUrl is available', () => {
    const renderer = new RuntimeMapRenderer({ theme: getThemeConfig('minimal') })

    const html = renderer.render({
      travelName: 'Test route',
      snapshotDataUrl: 'data:image/png;base64,test',
      mapSvg: '<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet"></svg>',
      locationCards: [],
      locationCount: 3,
      pageNumber: 5,
      routeInfo: 'Track',
      routePreview: null,
    })

    expect(html).toContain('<img src="data:image/png;base64,test"')
    expect(html).not.toContain('<svg viewBox="0 0 100 60"')
  })

  it('falls back to the deterministic svg map block when snapshotDataUrl is null', () => {
    const renderer = new RuntimeMapRenderer({ theme: getThemeConfig('minimal') })

    const html = renderer.render({
      travelName: 'Test route',
      snapshotDataUrl: null,
      mapSvg: '<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet"></svg>',
      locationCards: [],
      locationCount: 3,
      pageNumber: 5,
      routeInfo: 'Track',
      routePreview: null,
    })

    expect(html).toContain('<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet"></svg>')
    expect(html).not.toContain('<img src="data:image/png;base64,')
  })

  it('renders the elevation profile in the same chart-first order as the travel page block', () => {
    const renderer = new RuntimeMapRenderer({ theme: getThemeConfig('minimal') })

    const html = renderer.render({
      travelName: 'Mountain trail',
      snapshotDataUrl: null,
      mapSvg: '<svg></svg>',
      locationCards: [],
      locationCount: 2,
      pageNumber: 2,
      routeInfo: 'GPX',
      routePreview: {
        linePoints: [
          { coord: '53.9,27.56' },
          { coord: '53.95,27.6' },
          { coord: '54.0,27.65' },
        ],
        elevationProfile: [
          { distanceKm: 0, elevationM: 3 },
          { distanceKm: 4.2, elevationM: 160 },
          { distanceKm: 8.8, elevationM: 280 },
          { distanceKm: 12.1, elevationM: 121 },
        ],
      } as any,
    })

    // Header
    expect(html).toContain('Профиль высот')
    // 6 summary cards
    expect(html).toContain('Дистанция')
    expect(html).toContain('Набор')
    expect(html).toContain('Сброс')
    expect(html).toContain('Перепад')
    // Min/max badges
    expect(html).toContain('Мин 3 м')
    expect(html).toContain('Пик 280 м')
    // Chart SVG with new dimensions
    expect(html).toContain('<svg viewBox="0 0 500 120"')
    // Peak vertical line (info color dashed)
    expect(html).toContain('stroke-dasharray="4 3"')
    // Key point circles
    expect(html).toContain('Старт')
    expect(html).toContain('Высшая точка')
    expect(html).toContain('Финиш')
    // X-axis labels
    expect(html).toContain('0 км')
    // SVG chart is present
    expect(html.indexOf('<svg viewBox="0 0 500 120"')).toBeGreaterThan(-1)
  })

  /**
   * #1465, семья LOCALE-NUMBER-FORMAT-001: карточка «Дистанция» собирала строку
   * руками (`${round(km)} км`), поэтому русский PDF печатал английское
   * «12.6 км». Числа профиля высот идут через канонические форматтеры, а
   * единица — из ключа перевода.
   */
  describe('#1465 числа профиля высот форматирует локаль, а не call-site', () => {
    const renderProfile = () =>
      new RuntimeMapRenderer({ theme: getThemeConfig('minimal') }).render({
        travelName: 'Mountain trail',
        snapshotDataUrl: null,
        mapSvg: '<svg></svg>',
        locationCards: [],
        locationCount: 2,
        pageNumber: 2,
        routeInfo: 'GPX',
        routePreview: {
          linePoints: [
            { coord: '53.9,27.56' },
            { coord: '53.95,27.6' },
            { coord: '54.0,27.65' },
          ],
          elevationProfile: [
            { distanceKm: 0, elevationM: 3 },
            { distanceKm: 4.2, elevationM: 1600 },
            { distanceKm: 8.8, elevationM: 2800 },
            { distanceKm: 12.1, elevationM: 121 },
          ],
        } as any,
      })

    afterEach(async () => {
      await i18n.changeLanguage('ru')
    })

    it.each([
      ['ru', '12,6 км', '2\u00A0800 м'],
      ['en', '12.6 km', '2,800 m'],
    ])('печатает дистанцию и высоты по локали %s', async (locale, distance, elevation) => {
      await i18n.changeLanguage(locale)

      const html = renderProfile()

      expect(html).toContain(distance)
      expect(html).toContain(elevation)
    })

    it('не склеивает единицу расстояния с числом в обход перевода', async () => {
      await i18n.changeLanguage('en')

      const html = renderProfile()

      // Хардкод `${round(km)} км` печатал русскую единицу в любой локали.
      expect(html).not.toContain('12.6 км')
      expect(html).not.toMatch(/\d\.\d\s*км/)
    })
  })
})
