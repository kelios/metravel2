/**
 * @jest-environment node
 */
// #2119: эталоны PDF-книги в окружении приложений — Node без DOM (как Hermes:
// нет `DOMParser`, `document`, `Node`, `HTMLElement`). Входы и эталонные файлы те
// же, что у web-теста `bookGolden.test.ts`; дерево HTML здесь строит parse5
// (`htmlTree.native.ts`), глобалы не подменяются.
import path from 'path'

import type { BookSettings } from '@/components/export/BookSettingsModal'
import { buildInitialSettings } from '@/components/export/BookSettingsModal.helpers'
import { buildDefaultSettingsForTravel } from '@/components/travel/hooks/useSingleTravelExport'
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
import { addBookPrintChrome as addWebPrintChrome } from '@/services/book/bookPrintChrome.web'
import { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator'
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser'
import { parseHtmlBody as parseHtmlBodyNative } from '@/services/pdf-export/parsers/contentParser/htmlTree.native'
import type { ParsedContentBlock } from '@/services/pdf-export/parsers/ContentParser'

import {
  PDF_BOOK_GOLDEN_DIR,
  buildEdgeCaseTravel,
  groupParseCorpus,
  loadParseCorpus,
  loadRealTravelFixtures,
  toTravel,
} from '../../fixtures/pdfBook/corpus'
import { expectSameText, readGoldenFile } from '../../helpers/goldenFile'
import { expectHermesLikeGlobals, installHermesLikeGlobals } from '../../helpers/hermesLikeGlobals'

// Границы те же, что у web-теста: сеть, генератор QR, случайность, дата. Снимок
// карты НЕ подменён — в приложении его нет, и книга обязана собраться без него.
jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => Promise.resolve(`data:image/png;base64,QR:${text}`)),
}))

jest.mock('@/api/travelRoutes', () => ({
  listTravelRouteFiles: jest.fn(() => Promise.resolve([])),
  downloadTravelRouteFileBlob: jest.fn(),
}))

const FIXED_NOW = new Date('2026-10-01T12:00:00.000Z')

const parseGolden = (group: string) => path.join(PDF_BOOK_GOLDEN_DIR, 'parse', `${group}.json`)
const bookGolden = (name: string) => path.join(PDF_BOOK_GOLDEN_DIR, 'book', `${name}.html`)

/**
 * Единственное место, где разбор в приложении расходится с эталоном, — и оно
 * отражает ошибку jsdom, а не браузера. Текст, стоящий прямо внутри `<table>`,
 * по правилам HTML выносится ПЕРЕД таблицей одним текстовым узлом. jsdom 20
 * (`browser/parser/html.js`, `insertTextBefore` → `_append`) дописывает его в
 * конец `<body>` отдельными кусками, поэтому в эталоне, снятом под jsdom, три
 * абзаца после таблицы. Chromium 149 и parse5 дают одно и то же дерево (замер
 * 04.10.2026: 1699 документов, расхождений в дереве — 0), его и ждём здесь.
 */
const BROWSER_RESULT_WHERE_JSDOM_DEVIATES: Record<string, Record<string, ParsedContentBlock[]>> = {
  edge: {
    'table-foster-parenting': [
      { type: 'paragraph', text: 'текст внутри table' },
      { type: 'paragraph', text: 'абзац внутри table' },
      { type: 'table', rows: [['ячейка']] },
    ],
  },
}

installHermesLikeGlobals()

describe('эталоны PDF-книги (приложения, без DOM)', () => {
  it('в окружении нет браузерных глобалов — как в Hermes', () => {
    expectHermesLikeGlobals()
  })

  describe('ContentParser.parse', () => {
    const groups = groupParseCorpus(loadParseCorpus())

    it.each([...groups.keys()])('блоки группы %s совпадают с эталоном web', (group) => {
      const parser = new ContentParser()
      const result: Record<string, unknown> = {}
      for (const document of groups.get(group) ?? []) {
        result[document.key] = parser.parse(document.html)
      }

      const expected = JSON.parse(readGoldenFile(parseGolden(group))) as Record<string, unknown>
      const deviations = BROWSER_RESULT_WHERE_JSDOM_DEVIATES[group] ?? {}
      for (const [key, blocks] of Object.entries(deviations)) {
        expect(expected).toHaveProperty([key])
        expected[key] = blocks
      }

      expectSameText(
        `${JSON.stringify(result, null, 2)}\n`,
        `${JSON.stringify(expected, null, 2)}\n`,
        parseGolden(group)
      )
    })

    it('неподдержанный селектор падает явно, а не находит «ничего»', () => {
      const body = parseHtmlBodyNative('<p class="a">x</p>')
      if (!body) throw new Error('parse5 не вернул <body>')
      expect(() => body.querySelector('p > span')).toThrow(/не поддержан/)
      expect(() => body.querySelectorAll('[data-x]')).toThrow(/не поддержан/)
      expect(body.querySelector('p, .a')).not.toBeNull()
    })
  })

  describe('BookHtmlExportService.generateTravelsHtml', () => {
    const realTravels = loadRealTravelFixtures().map(toTravel)
    const pickTravel = (id: number) => {
      const travel = realTravels.find((item) => item.id === id)
      if (!travel) throw new Error(`Нет фикстуры travel-${id}.json`)
      return travel
    }

    beforeAll(() => {
      jest.useFakeTimers({
        now: FIXED_NOW,
        doNotFake: [
          'nextTick',
          'queueMicrotask',
          'setImmediate',
          'clearImmediate',
          'setInterval',
          'clearInterval',
          'setTimeout',
          'clearTimeout',
          'performance',
        ],
      })
    })

    afterAll(() => {
      jest.useRealTimers()
    })

    beforeEach(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.42)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    /**
     * Документ приложения отличается от web-документа только обвязкой окна
     * браузера: если навесить её на документ приложения, обязан получиться
     * web-эталон побайтно. Сравниваются книги, где у web нет снимка карты, —
     * в приложении его нет никогда (canvas), страница карты рисуется SVG-схемой.
     */
    const expectNativeBookToMatchWebGolden = (html: string, goldenName: string) => {
      expect(html).not.toContain('print-toolbar')
      expect(html).not.toContain('<script')
      expect(html).not.toContain('window.print')
      expectSameText(addWebPrintChrome(html), readGoldenFile(bookGolden(goldenName)), bookGolden(goldenName))
    }

    it('одно путешествие («Предпросмотр PDF»): документ совпадает с web-эталоном', async () => {
      const travel = pickTravel(536)
      const html = await new BookHtmlExportService().generateTravelsHtml(
        [travel],
        buildDefaultSettingsForTravel(travel),
        { isPremium: false }
      )
      expectNativeBookToMatchWebGolden(html, 'single-travel-default')
    })

    it('синтетика и премиум-настройки: документ совпадает с web-эталоном', async () => {
      const settings: BookSettings = buildInitialSettings({
        title: 'Синтетическая книга',
        subtitle: 'Эталон разметки',
        template: 'travel-magazine',
        sortOrder: 'alphabetical',
        includeChecklists: true,
        galleryLayout: 'masonry',
        captionPosition: 'overlay',
        gallerySpacing: 'compact',
        photoPageLayout: 'framed',
      })
      const html = await new BookHtmlExportService().generateTravelsHtml([buildEdgeCaseTravel()], settings, {
        isPremium: true,
      })
      expectNativeBookToMatchWebGolden(html, 'edge-cases-premium')
    })

    it('каталог из двух путешествий с картой: книга собирается, снимок карты пропущен', async () => {
      const settings: BookSettings = buildInitialSettings({
        title: 'Мои путешествия',
        subtitle: 'Эталон каталога',
        sortOrder: 'date-desc',
      })
      expect(settings.includeMap).toBe(true)

      const html = await new BookHtmlExportService().generateTravelsHtml(
        [pickTravel(508), pickTravel(554)],
        settings,
        { isPremium: false }
      )

      expect(html).toContain('pdf-page')
      expect(html).not.toContain('MAP-SNAPSHOT')
      // От web-эталона каталога документ приложения отличается только страницами
      // карты: там, где у web растровый снимок, здесь SVG-схема маршрута.
      const webGolden = readGoldenFile(bookGolden('catalog-two-travels-free'))
      const pageCount = (value: string) => (value.match(/class="[^"]*\bpdf-page\b/g) ?? []).length
      expect(pageCount(html)).toBe(pageCount(webGolden))
    })
  })

  describe('QR-коды без canvas', () => {
    it('когда PNG нарисовать нечем, QR-код уходит в документ SVG-картинкой', async () => {
      const generator = new EnhancedPdfGenerator('minimal') as unknown as {
        renderQrCode: (
          qr: { toDataURL: () => Promise<string>; toString: () => Promise<string> },
          url: string,
          width: number
        ) => Promise<string>
      }
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path d="M0 0h1v1H0z"/></svg>'

      const dataUrl = await generator.renderQrCode(
        {
          toDataURL: () => Promise.reject(new Error('You need to specify a canvas element')),
          toString: () => Promise.resolve(svg),
        },
        'https://metravel.by/travels/x/',
        200
      )

      expect(dataUrl).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    })

    it('если не получилось ни PNG, ни SVG — книга собирается без QR-кода', async () => {
      const generator = new EnhancedPdfGenerator('minimal') as unknown as {
        renderQrCode: (
          qr: { toDataURL: () => Promise<string>; toString: () => Promise<string> },
          url: string,
          width: number
        ) => Promise<string>
      }

      await expect(
        generator.renderQrCode(
          { toDataURL: () => Promise.reject(new Error('no canvas')), toString: () => Promise.reject(new Error('no svg')) },
          'https://metravel.by/travels/x/',
          120
        )
      ).resolves.toBe('')
    })
  })
})
