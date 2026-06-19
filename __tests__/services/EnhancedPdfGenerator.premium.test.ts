import { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSettings } from '@/components/export/BookSettingsModal'

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('qr-data')),
}))

jest.mock('@/utils/mapImageGenerator', () => ({
  generateCanvasMapSnapshot: jest.fn(() => Promise.resolve('canvas-snapshot')),
  generateLeafletRouteSnapshot: jest.fn(() => Promise.resolve('leaflet-snapshot')),
  generateStaticMapUrl: jest.fn(() => 'https://staticmap.example.com/mock'),
  fetchImageAsDataUri: jest.fn(() => Promise.resolve(null)),
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
  includeToc: false,
  includeGallery: false,
  includeMap: false,
  includeChecklists: false,
  checklistSections: ['clothing'],
  showCoordinatesOnMapPage: false,
  galleryLayout: 'grid',
  galleryColumns: 3,
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

const travel: TravelForBook = {
  id: 1,
  name: 'Alpha',
  slug: 'alpha',
  url: 'https://metravel.by/travels/alpha',
  countryName: 'Belarus',
  year: '2023',
  travel_image_thumb_url: 'http://example.com/a.jpg',
}

const WATERMARK = 'Создано на metravel.by'

function newGenerator(theme: string) {
  const gen = new EnhancedPdfGenerator(theme) as unknown as {
    selectedQuotes?: unknown
    themeName: string
    generate: (
      travels: TravelForBook[],
      settings: BookSettings,
      options?: { isPremium?: boolean },
    ) => Promise<string>
  }
  gen.selectedQuotes = undefined
  return gen
}

describe('EnhancedPdfGenerator premium gate + watermark', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('adds the watermark when isPremium is false', async () => {
    const gen = newGenerator('minimal')
    const html = await gen.generate([travel], baseSettings, { isPremium: false })

    expect(html).toContain(WATERMARK)
    expect(html).toContain('metravel-watermark')
  })

  it('omits the watermark when isPremium is true', async () => {
    const gen = newGenerator('minimal')
    const html = await gen.generate([travel], baseSettings, { isPremium: true })

    expect(html).not.toContain(WATERMARK)
    expect(html).not.toContain('metravel-watermark')
  })

  it('omits the watermark by default (no options)', async () => {
    const gen = newGenerator('minimal')
    const html = await gen.generate([travel], baseSettings)

    expect(html).not.toContain(WATERMARK)
  })

  it('downgrades a premium theme to minimal when isPremium is false', async () => {
    const gen = newGenerator('ocean')
    const html = await gen.generate(
      [travel],
      { ...baseSettings, template: 'ocean' },
      { isPremium: false },
    )

    expect(gen.themeName).toBe('minimal')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ocean'))
    expect(html).toContain(WATERMARK)
  })

  it('keeps a premium theme when isPremium is true', async () => {
    const gen = newGenerator('ocean')
    await gen.generate(
      [travel],
      { ...baseSettings, template: 'ocean' },
      { isPremium: true },
    )

    expect(gen.themeName).toBe('ocean')
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
