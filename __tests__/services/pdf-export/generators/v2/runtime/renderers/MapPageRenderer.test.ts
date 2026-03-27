import { RuntimeMapRenderer } from '@/services/pdf-export/generators/v2/runtime/renderers/MapPageRenderer'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'

describe('RuntimeMapRenderer', () => {
  it('keeps the generated map snapshot uncropped in PDF output', () => {
    const renderer = new RuntimeMapRenderer({ theme: getThemeConfig('minimal') })

    const html = renderer.render({
      travelName: 'Test route',
      snapshotDataUrl: 'data:image/png;base64,test',
      mapSvg: '<svg></svg>',
      locationCards: [],
      locationCount: 3,
      pageNumber: 5,
      routeInfo: 'Track',
      routePreview: null,
    })

    expect(html).toContain('object-fit: contain')
    expect(html).not.toContain('object-fit: cover')
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

    expect(html).toContain('Профиль высот')
    expect(html).toContain('Мин. 3 м')
    expect(html).toContain('Макс. 280 м')
    expect(html).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(html.indexOf('<svg viewBox="0 0 220 96"')).toBeLessThan(html.indexOf('>Мин.<'))
  })
})
