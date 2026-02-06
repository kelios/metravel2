import { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSettings } from '@/components/export/BookSettingsModal'

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('qr-data')),
}))

jest.mock('@/utils/mapImageGenerator', () => ({
  generateLeafletRouteSnapshot: jest.fn(() => Promise.resolve('leaflet-snapshot')),
}))

jest.mock('@/services/pdf-export/parsers/ContentParser', () => ({
  ContentParser: jest.fn().mockImplementation(() => ({
    parse: jest.fn(() => [{ type: 'paragraph', text: 'demo' }]),
  })),
}))

jest.mock('@/services/pdf-export/renderers/BlockRenderer', () => ({
  BlockRenderer: jest.fn().mockImplementation(() => ({
    renderBlocks: jest.fn(() => '<p>rendered</p>'),
  })),
}))

jest.mock('@/services/pdf-export/quotes/travelQuotes', () => ({
  pickRandomQuote: jest.fn(() => ({ text: 'quote', author: 'author' })),
  pickRandomGalleryQuote: jest.fn(() => ({ text: 'gallery-quote' })),
}))

const baseSettings: BookSettings = {
  title: 'Book',
  subtitle: 'Sub',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: true,
  checklistSections: ['clothing', 'food', 'electronics'],
  showCoordinatesOnMapPage: true,
  galleryLayout: 'grid',
  galleryColumns: 3,
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

const travelA: TravelForBook = {
  id: 1,
  name: 'Alpha',
  countryName: 'Belarus',
  year: '2023',
  travel_image_thumb_url: 'http://example.com/a.jpg',
  gallery: [
    { url: 'http://example.com/photo1.jpg' },
    { url: 'http://example.com/photo2.jpg' },
    { url: 'http://example.com/photo3.jpg' },
    { url: 'http://example.com/photo4.jpg' },
  ],
  travelAddress: [
    { id: '1', address: 'Минск, Беларусь', coord: '53.9, 27.56', travelImageThumbUrl: 'thumb1' },
  ],
}

const travelB: TravelForBook = {
  id: 2,
  name: 'Beta',
  countryName: 'Austria',
  year: '2021',
  travel_image_thumb_url: '/cover.jpg',
  travelAddress: [{ id: '2', address: 'Вена', coord: '48.2, 16.37' }],
}

describe('EnhancedPdfGenerator helpers', () => {
  const generator = new EnhancedPdfGenerator('minimal') as any

  beforeEach(() => {
    generator.currentSettings = baseSettings
  })

  it('sorts travels by different strategies and computes ranges', () => {
    const byDate = generator.sortTravels([travelA, travelB], 'date-asc')
    expect(byDate[0].year).toBe('2021')

    const byCountry = generator.sortTravels([travelA, travelB], 'country')
    expect(byCountry[0].countryName).toBe('Austria')

    expect(generator.getYearRange([travelA, travelB])).toBe('2021 - 2023')
  })

  it('builds gallery, checklist and map sections', async () => {
    const galleryHtml = generator.renderGalleryPage(travelA, 2)
    expect(galleryHtml).toContain('Фотогалерея')
    expect(galleryHtml).toContain('images.weserv.nl')

    const checklist = generator.renderChecklistPage(baseSettings, 5)
    expect(checklist).toContain('Одежда')
    expect(checklist).toContain('пунктов')

    const locations = generator.normalizeLocations(travelA)
    const mapPage = await generator.renderMapPage(travelA, locations, 4)
    expect(mapPage).toContain('leaflet-snapshot')
    expect(mapPage).toContain('Маршрут')
  })

  it('builds inline gallery and safe URLs', () => {
    const html = generator.buildInlineGallerySection(travelA, generator.theme.colors, generator.theme.typography, generator.theme.spacing)
    expect(html).toContain('grid-template-columns')

    const safe = generator.buildSafeImageUrl('http://cdn.test/image.jpg')
    expect(safe).toContain('images.weserv.nl')
    expect(generator.buildSafeImageUrl('data:image/png;base64,abc')).toContain('data:image/png')
    expect(generator.buildSafeImageUrl('blob:local-image')).toBe('blob:local-image')

    const proxied = 'https://images.weserv.nl/?url=example.com/image.jpg&w=1600&fit=inside'
    expect(generator.buildSafeImageUrl(proxied)).toBe(proxied)
  })

  it('normalizes locations, builds SVG, formats labels and escapes', () => {
    const normalized = generator.normalizeLocations(travelA)
    expect(normalized[0].lat).toBeCloseTo(53.9)

    const svg = generator.buildRouteSvg(normalized)
    expect(svg).toContain('<svg')
    expect(generator.buildMapPlaceholder()).toContain('Недостаточно данных')

    expect(generator.formatDays(1)).toBe('1 день')
    expect(generator.getTravelLabel(3)).toBe('путешествия')
    expect(generator.getPhotoLabel(6)).toBe('фотографий')
    expect(generator.escapeHtml('<tag>')).toBe('&lt;tag&gt;')
  })

  it('renders blocks fallback when BlockRenderer is unavailable', () => {
    generator.blockRenderer = null
    const rendered = generator.renderBlocks([
      { type: 'heading', level: 1, text: 'Заголовок' } as any,
      { type: 'paragraph', text: 'Текст' } as any,
      { type: 'list', ordered: false, items: ['a', 'b'] } as any,
      { type: 'quote', text: 'Цитата', author: 'Автор' } as any,
      { type: 'image', src: 'photo', alt: 'альт', caption: 'cap' } as any,
    ])

    expect(rendered).toContain('<h1>')
    expect(rendered).toContain('<ul>')
    expect(rendered).toContain('<blockquote>')
  })

  it('generates full HTML document with cover, pages and final screen', async () => {
    ;(generator as any).selectedQuotes = undefined
    const html = await generator.generate([travelA, travelB], {
      ...baseSettings,
      includeChecklists: true,
      includeGallery: true,
      includeMap: true,
      includeToc: true,
    })

    expect(html).toContain('<title>Book</title>')
    expect(html).toContain('cover-page')
    expect(html).toContain('toc-page')
    expect(html).toContain('travel-content-page')
    expect(html).toContain('final-page')

    expect(html).toContain('hyphens: auto')
    expect(html).toContain('word-break: break-word')
    expect(html).toContain('overflow-wrap: anywhere')
  })

  it('falls back to MeTravel title and hides cover <h1> when settings.title is empty', async () => {
    ;(generator as any).selectedQuotes = undefined
    const html = await generator.generate([travelA, travelB], {
      ...baseSettings,
      title: '   ',
    })

    expect(html).toContain('<title>MeTravel</title>')

    const coverStart = html.indexOf('cover-page')
    const coverEnd = html.indexOf('toc-page')
    const coverSlice =
      coverStart !== -1 && coverEnd !== -1 && coverEnd > coverStart
        ? html.slice(coverStart, coverEnd)
        : html

    expect(coverSlice).not.toContain('<h1')
  })
})
