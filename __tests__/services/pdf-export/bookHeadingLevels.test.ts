/**
 * @jest-environment-options {"url": "https://metravel.by/"}
 */
// #2210, #2255: заголовок автора любого уровня h1–h6 в любом из четырёх
// текстовых блоков путешествия не роняет сборку книги и в готовом документе
// напечатан мельче названия своего блока. Санитайзер, разбор и рендер — реальные;
// подменены только границы, как в `bookGolden.test.ts`: сеть (файлы маршрута),
// canvas (снимок карты) и генератор QR.
import { Platform } from 'react-native'

import { buildDefaultSettingsForTravel } from '@/components/travel/hooks/useSingleTravelExport'
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
import { translate } from '@/i18n'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
import {
  PDF_RICH_TEXT_SECTIONS,
  resolveHeadingStyle,
  resolveSectionHeadingLevel,
} from '@/services/pdf-export/themes/headingLevels'
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

const AUTHOR_LEVELS = [1, 2, 3, 4, 5, 6] as const

const authorHeadingText = (level: number) => `Заголовок автора h${level}`

const HEADINGS_HTML = AUTHOR_LEVELS.map((level) => `<h${level}>${authorHeadingText(level)}</h${level}>`).join('')

/** Название блока в книге — ключ, которым его печатает `travelContentPage.ts` (вариант `runtime`). */
const SECTION_TITLE_KEYS = {
  description: 'export:services.pdf_export.generators.v2.runtime.travelContentPage.opisanie_1c179656',
  recommendation: 'export:services.pdf_export.generators.v2.runtime.travelContentPage.rekomendatsii_9768c7c8',
  plus: 'export:services.pdf_export.generators.v2.runtime.travelContentPage.div_style_background_value1_border_radius_va_761264be.text01',
  minus: 'export:services.pdf_export.generators.v2.runtime.travelContentPage.div_style_background_value1_border_radius_va_961e5788.text01',
} as const

const HEADING_TYPOGRAPHY = ['font-size', 'font-weight', 'line-height', 'margin-bottom'] as const

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const pt = (size: string | undefined) => {
  const match = size?.match(/^(\d+(?:\.\d+)?)pt$/)
  if (!match) throw new Error(`Кегль не в pt: ${size}`)
  return Number(match[1])
}

/** Тег и типографика заголовка с текстом `text`, как он напечатан в книге. */
function printedHeading(html: string, text: string) {
  const match = html.match(new RegExp(`<(h[1-6]) style="([^"]*)">${escapeRegExp(text)}</h[1-6]>`))
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

  it('список блоков книги с заголовками автора совпадает с rich-text полями путешествия', () => {
    expect([...PDF_RICH_TEXT_SECTIONS].sort()).toEqual([...RICH_TEXT_FIELDS].sort())
  })

  it.each(RICH_TEXT_FIELDS)(
    'поле %s: книга собирается, заголовки автора h1–h6 напечатаны по карте и мельче названия блока',
    async (field) => {
      const travel = toTravel({
        ...fixture,
        description: '',
        recommendation: '',
        plus: '',
        minus: '',
        [field]: HEADINGS_HTML,
      })
      const settings = buildDefaultSettingsForTravel(travel)
      const { typography } = getThemeConfig(settings.template)

      const html = await new BookHtmlExportService().generateTravelsHtml([travel], settings, { isPremium: false })
      const titleSize = pt(printedHeading(html, translate(SECTION_TITLE_KEYS[field])).typography['font-size'])

      for (const level of AUTHOR_LEVELS) {
        const printed = resolveSectionHeadingLevel(field, level)
        const style = resolveHeadingStyle(typography, printed)
        const heading = printedHeading(html, authorHeadingText(level))

        expect(heading).toEqual({
          tag: `h${printed}`,
          typography: {
            'font-size': style.size,
            'font-weight': String(style.weight),
            'line-height': String(style.lineHeight),
            'margin-bottom': style.marginBottom,
          },
        })
        expect(pt(heading.typography['font-size'])).toBeLessThan(titleSize)
      }
    }
  )
})
