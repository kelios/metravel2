import { Platform } from 'react-native'
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
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

describe('BookHtmlExportService', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    mockGenerate.mockReset()
    mockValidate.mockReset()
    mockTransform.mockReset()
    ;(Platform as any).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('throws when invoked outside web platform', async () => {
    ;(Platform as any).OS = 'ios'
    const service = new BookHtmlExportService()

    await expect(service.generateTravelsHtml([baseTravel], settings)).rejects.toThrow(
      'Book HTML preview is only available on web'
    )
  })

  it('generates and enhances HTML output with toolbar and styles', async () => {
    const service = new BookHtmlExportService()
    const travelForBook = [{ id: 1, userName: 'Tester' }] as any
    mockTransform.mockReturnValue(travelForBook)
    mockGenerate.mockResolvedValue(
      '<html><head></head><body><section class="pdf-page">page</section></body></html>'
    )

    const html = await service.generateTravelsHtml([baseTravel], settings)

    expect(mockValidate).toHaveBeenCalledWith([baseTravel])
    expect(mockTransform).toHaveBeenCalled()
    expect(mockGenerate).toHaveBeenCalledWith(travelForBook, settings)
    expect(html).toContain('print-toolbar')
    expect(html).toContain('@media print')
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
