/**
 * @jest-environment-options {"url": "https://metravel.by/"}
 */
// #2210: заголовок любого уровня h1–h6 в любом из четырёх текстовых блоков
// путешествия не роняет сборку книги; уровни без стиля в теме (h5, h6)
// печатаются тегом и стилем h4. Санитайзер, разбор и рендер — реальные;
// подменены только границы, как в `bookGolden.test.ts`: сеть (файлы маршрута),
// canvas (снимок карты) и генератор QR.
import { Platform } from 'react-native'

import { buildDefaultSettingsForTravel } from '@/components/travel/hooks/useSingleTravelExport'
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
import { generateCanvasMapSnapshot, generateLeafletRouteSnapshot } from '@/utils/mapImageGenerator'

import { RICH_TEXT_FIELDS, loadRealTravelFixtures, toTravel } from '../../fixtures/pdfBook/corpus'

// Jest по умолчанию берёт платформенный файл приложений (`htmlTree.native.ts`);
// здесь проверяется web, поэтому дерево HTML — явно браузерное (`DOMParser`).
jest.mock('@/services/pdf-export/parsers/contentParser/htmlTree', () =>
  jest.requireActual('@/services/pdf-export/parsers/contentParser/htmlTree.web')
)

jest.mock('@/services/book/bookPrintChrome', () => jest.requireActual('@/services/book/bookPrintChrome.web'))

jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => Promise.resolve(`data:image/png;base64,QR:${text}`)),
}))

jest.mock('@/utils/mapImageGenerator', () => ({
  generateCanvasMapSnapshot: jest.fn(),
  generateLeafletRouteSnapshot: jest.fn(),
}))

jest.mock('@/api/travelRoutes', () => ({
  listTravelRouteFiles: jest.fn(() => Promise.resolve([])),
  downloadTravelRouteFileBlob: jest.fn(),
}))

const HEADINGS_HTML = '<h4>Четвёртый</h4><h5>Пятый</h5><h6>Шестой</h6>'

const HEADING_TYPOGRAPHY = ['font-size', 'font-weight', 'line-height', 'margin-bottom'] as const

/** Тег и типографика заголовка с текстом `text`, как он напечатан в книге. */
function printedHeading(html: string, text: string) {
  const match = html.match(new RegExp(`<(h[1-6]) style="([^"]*)">${text}</h[1-6]>`))
  if (!match) throw new Error(`В книге нет заголовка «${text}»`)
  const [, tag, style] = match
  const declarations = new Map(
    style
      .split(';')
      .map((declaration) => declaration.split(':').map((part) => part.trim()))
      .filter((parts): parts is [string, string] => parts.length === 2)
  )
  return {
    tag,
    typography: Object.fromEntries(HEADING_TYPOGRAPHY.map((property) => [property, declarations.get(property)])),
  }
}

describe('PDF-книга: уровни заголовков в текстовых блоках путешествия', () => {
  const originalPlatform = Platform.OS

  const fixture = loadRealTravelFixtures().find((item) => item.id === 536)
  if (!fixture) throw new Error('Нет фикстуры travel-536.json')

  beforeAll(() => {
    ;(Platform as { OS: string }).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as { OS: string }).OS = originalPlatform
  })

  beforeEach(() => {
    ;(generateCanvasMapSnapshot as jest.Mock).mockReset().mockResolvedValue(null)
    ;(generateLeafletRouteSnapshot as jest.Mock).mockReset().mockResolvedValue(null)
  })

  it.each(RICH_TEXT_FIELDS)('поле %s: книга собирается, h5 и h6 напечатаны тегом и стилем h4', async (field) => {
    const travel = toTravel({
      ...fixture,
      description: '',
      recommendation: '',
      plus: '',
      minus: '',
      [field]: HEADINGS_HTML,
    })
    const settings = buildDefaultSettingsForTravel(travel)
    const h4 = getThemeConfig(settings.template).typography.h4
    const asFourth = {
      tag: 'h4',
      typography: {
        'font-size': h4.size,
        'font-weight': String(h4.weight),
        'line-height': String(h4.lineHeight),
        'margin-bottom': h4.marginBottom,
      },
    }

    const html = await new BookHtmlExportService().generateTravelsHtml([travel], settings, { isPremium: false })

    expect(printedHeading(html, 'Четвёртый')).toEqual(asFourth)
    expect(printedHeading(html, 'Пятый')).toEqual(asFourth)
    expect(printedHeading(html, 'Шестой')).toEqual(asFourth)
    expect(html).not.toMatch(/<h[56][\s>]/)
  })
})
