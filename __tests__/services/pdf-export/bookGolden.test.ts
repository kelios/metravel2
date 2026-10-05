/**
 * @jest-environment-options {"url": "https://metravel.by/"}
 */
// #2119: эталоны PDF-книги на web (jsdom). Разбор описаний и сборка документа —
// реальные; подменены только границы: сеть (файлы маршрута), canvas (снимок
// карты), генератор QR, случайность цитат и текущая дата.
//
// Эталоны сняты на коде ДО замены разборщика (коммит 974405d43): любое изменение
// web-вывода роняет этот тест. Перезапись — `UPDATE_PDF_BOOK_GOLDEN=1 npx jest
// <этот файл>`. Те же эталоны читает native-тест `bookGolden.native.test.ts`.
import path from 'path'
import { Platform } from 'react-native'

import type { BookSettings } from '@/components/export/BookSettingsModal'
import { buildInitialSettings } from '@/components/export/BookSettingsModal.helpers'
import { buildDefaultSettingsForTravel } from '@/components/travel/hooks/useSingleTravelExport'
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser'
import { generateCanvasMapSnapshot, generateLeafletRouteSnapshot } from '@/utils/mapImageGenerator'

import {
  PDF_BOOK_GOLDEN_DIR,
  buildEdgeCaseTravel,
  groupParseCorpus,
  loadParseCorpus,
  loadRealTravelFixtures,
  toTravel,
} from '../../fixtures/pdfBook/corpus'
import { expectToMatchGoldenFile } from '../../helpers/goldenFile'

// Jest по умолчанию берёт платформенный файл приложений (`htmlTree.native.ts`);
// здесь проверяется web, поэтому дерево HTML — явно браузерное (`DOMParser`).
jest.mock('@/services/pdf-export/parsers/contentParser/htmlTree', () =>
  jest.requireActual('@/services/pdf-export/parsers/contentParser/htmlTree.web')
)

// То же для обвязки печати: окно браузера получает панель «Печать».
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

const FIXED_NOW = new Date('2026-10-01T12:00:00.000Z')
const MAP_SNAPSHOT = 'data:image/png;base64,MAP-SNAPSHOT'

const mockCanvasSnapshot = generateCanvasMapSnapshot as jest.Mock
const mockLeafletSnapshot = generateLeafletRouteSnapshot as jest.Mock

const parseGolden = (group: string) => path.join(PDF_BOOK_GOLDEN_DIR, 'parse', `${group}.json`)
const bookGolden = (name: string) => path.join(PDF_BOOK_GOLDEN_DIR, 'book', `${name}.html`)

describe('эталоны PDF-книги (web)', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    ;(Platform as { OS: string }).OS = 'web'
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
    ;(Platform as { OS: string }).OS = originalPlatform
  })

  let domParserSpy: jest.SpyInstance

  beforeEach(() => {
    domParserSpy = jest.spyOn(DOMParser.prototype, 'parseFromString')
    jest.spyOn(Math, 'random').mockReturnValue(0.42)
    mockCanvasSnapshot.mockReset().mockResolvedValue(MAP_SNAPSHOT)
    mockLeafletSnapshot.mockReset().mockResolvedValue(null)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('ContentParser.parse', () => {
    const groups = groupParseCorpus(loadParseCorpus())

    it('корпус не меньше оговорённого: 10 реальных описаний и синтетика', () => {
      const realGroups = [...groups.keys()].filter((group) => group.startsWith('real-'))
      expect(realGroups.length).toBeGreaterThanOrEqual(10)
      expect(groups.get('edge')?.length ?? 0).toBeGreaterThanOrEqual(60)
    })

    it.each([...groups.keys()])('блоки группы %s совпадают с эталоном', (group) => {
      const parser = new ContentParser()
      const result: Record<string, unknown> = {}
      for (const document of groups.get(group) ?? []) {
        result[document.key] = parser.parse(document.html)
      }
      expectToMatchGoldenFile(`${JSON.stringify(result, null, 2)}\n`, parseGolden(group))
      // Страховка от тихой подмены: описания разбирал именно браузерный DOMParser
      // (пустую строку разбор отдаёт сразу, до дерева).
      const parsedDocuments = (groups.get(group) ?? []).filter((document) => document.html.trim().length > 0)
      expect(domParserSpy).toHaveBeenCalledTimes(parsedDocuments.length)
    })
  })

  describe('BookHtmlExportService.generateTravelsHtml', () => {
    const realTravels = loadRealTravelFixtures().map(toTravel)
    const pickTravel = (id: number) => {
      const travel = realTravels.find((item) => item.id === id)
      if (!travel) throw new Error(`Нет фикстуры travel-${id}.json`)
      return travel
    }

    it('книга каталога: два путешествия, бесплатный тариф, снимок карты есть', async () => {
      const settings: BookSettings = buildInitialSettings({
        title: 'Мои путешествия',
        subtitle: 'Эталон каталога',
        sortOrder: 'date-desc',
      })
      const html = await new BookHtmlExportService().generateTravelsHtml(
        [pickTravel(508), pickTravel(554)],
        settings,
        { isPremium: false }
      )
      expectToMatchGoldenFile(html, bookGolden('catalog-two-travels-free'))
      expect(domParserSpy).toHaveBeenCalled()
    })

    it('одно путешествие («Предпросмотр PDF»): настройки по умолчанию, снимка карты нет', async () => {
      mockCanvasSnapshot.mockResolvedValue(null)
      const travel = pickTravel(536)
      const html = await new BookHtmlExportService().generateTravelsHtml(
        [travel],
        buildDefaultSettingsForTravel(travel),
        { isPremium: false }
      )
      expectToMatchGoldenFile(html, bookGolden('single-travel-default'))
      expect(domParserSpy).toHaveBeenCalled()
    })

    it('синтетика и премиум-настройки: тема, раскладка галереи, чеклисты, снимка карты нет', async () => {
      mockCanvasSnapshot.mockResolvedValue(null)
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
      expectToMatchGoldenFile(html, bookGolden('edge-cases-premium'))
      expect(domParserSpy).toHaveBeenCalled()
    })
  })
})
