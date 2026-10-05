import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
import { addBookPrintChrome as addWebPrintChrome } from '@/services/book/bookPrintChrome.web'
import type { Travel } from '@/types/types'
import type { BookSettings } from '@/components/export/BookSettingsModal'

const mockGenerate = jest.fn()
const mockValidate = jest.fn()
const mockTransform = jest.fn()

jest.mock('@/services/pdf-export/TravelDataTransformer', () => ({
  TravelDataTransformer: jest.fn().mockImplementation(() => ({
    validate: mockValidate,
    transform: mockTransform,
  })),
}))

jest.mock('@/services/pdf-export/generators/EnhancedPdfGenerator', () => ({
  EnhancedPdfGenerator: jest.fn().mockImplementation(() => ({
    generate: mockGenerate,
  })),
}))

const baseTravel: Travel = {
  id: 1,
  slug: 'trip',
  name: 'Test Trip',
  travel_image_thumb_url: 'thumb.jpg',
  travel_image_thumb_small_url: 'thumb-small.jpg',
  url: '/trip',
  youtube_link: '',
  userName: 'Tester',
  description: 'Desc',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: 'City',
  countryName: 'Country',
  countUnicIpView: '0',
  gallery: [],
  travelAddress: [],
  userIds: '',
  year: '2024',
  monthName: 'Jan',
  number_days: 1,
  companions: [],
  countryCode: 'CC',
}

const settings: BookSettings = {
  title: 'Заголовок',
  subtitle: 'Тест',
  coverType: 'auto',
  coverImage: undefined,
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: false,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'],
  showCoordinatesOnMapPage: true,
  galleryLayout: 'grid',
  galleryColumns: 3,
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

const GENERATED_HTML = '<html><head></head><body><section class="pdf-page">page</section></body></html>'

describe('BookHtmlExportService', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockValidate.mockReset()
    mockTransform.mockReset()
  })

  // Jest берёт платформенные файлы приложений: `bookPrintChrome.native.ts`.
  it('в приложении отдаёт документ книги как есть — без панели «Печать» и скрипта (#2119)', async () => {
    const service = new BookHtmlExportService()
    const travelForBook = [{ id: 1, userName: 'Tester' }] as any
    mockTransform.mockReturnValue(travelForBook)
    mockGenerate.mockResolvedValue(GENERATED_HTML)

    const html = await service.generateTravelsHtml([baseTravel], settings)

    expect(mockValidate).toHaveBeenCalledWith([baseTravel])
    expect(mockTransform).toHaveBeenCalled()
    expect(mockGenerate).toHaveBeenCalledWith(travelForBook, settings, { isPremium: true })
    expect(html).toBe(GENERATED_HTML)
    expect(html).not.toContain('print-toolbar')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('window.print')
  })

  it('web-обвязка добавляет панель «Печать», стили и скрипт ровно один раз', () => {
    const html = addWebPrintChrome(GENERATED_HTML)

    expect(html).toContain('print-toolbar')
    expect(html).toContain('@media print')
    expect(html).toContain('window.__metravelPrint')
    expect(html.indexOf('<style>')).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf('print-toolbar')).toBeGreaterThan(html.indexOf('<body>'))
    // Повторный вызов панель не дублирует.
    expect(addWebPrintChrome(html)).toBe(html)
  })

  it('fails fast when generated html has no pdf pages', async () => {
    const service = new BookHtmlExportService()
    mockTransform.mockReturnValue([{ id: 1, userName: 'Tester' }] as any)
    mockGenerate.mockResolvedValue('<html><body><div>empty</div></body></html>')

    await expect(service.generateTravelsHtml([baseTravel], settings)).rejects.toThrow(
      'Книга не содержит ни одной страницы'
    )
  })
})
