/**
 * @jest-environment node
 */
// #2119: путь книги в приложении целиком — от `runPdfExport` до системного диалога
// печати, в окружении без DOM. Сборка документа реальная (разбор описаний, генератор,
// сервис книги); подменены только границы модулей: `expo-print` и наличие
// native-модуля, сеть (детали путешествий, файлы маршрута, серверный экспорт),
// тосты, генератор QR.
import type { MutableRefObject } from 'react'

import { requestServerBookExport } from '@/api/bookExportApi'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import { buildInitialSettings } from '@/components/export/BookSettingsModal.helpers'
import { runPdfExport } from '@/hooks/usePdfExportRuntime'
import { ExportStage } from '@/types/pdf-export'
import type { Travel } from '@/types/types'
import { beginPrint } from '@/utils/printHtml'
import { showToast } from '@/utils/toast'

import { loadRealTravelFixtures, toTravel } from '../fixtures/pdfBook/corpus'
import { expectHermesLikeGlobals, installHermesLikeGlobals } from '../helpers/hermesLikeGlobals'

const mockRequireOptionalNativeModule = jest.fn()
const mockPrintAsync = jest.fn()
const mockPrintToFileAsync = jest.fn()
const mockDeleteAsync = jest.fn(async () => undefined)
const mockFetchTravel = jest.fn()
/** #2274: GET/body материализация картинок перед expo-print — граница сети, как и fetchTravel. */
const mockImageFetch = jest.fn()

jest.mock('expo', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}))
jest.mock('expo-print', () => ({
  printAsync: (...args: unknown[]) => mockPrintAsync(...args),
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}))
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args) }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(async () => undefined) }))
jest.mock('@/api/bookExportApi', () => ({
  requestServerBookExport: jest.fn(async () => null),
  downloadBookExportArtifact: jest.fn(),
}))
jest.mock('@/api/travelDetailsQueries', () => ({
  fetchTravel: (...args: unknown[]) => mockFetchTravel(...args),
  fetchTravelBySlug: jest.fn(),
}))
jest.mock('@/api/travelRoutes', () => ({
  listTravelRouteFiles: jest.fn(() => Promise.resolve([])),
  downloadTravelRouteFileBlob: jest.fn(),
}))
jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => Promise.resolve(`data:image/png;base64,QR:${text}`)),
}))

installHermesLikeGlobals()

const travels: Travel[] = loadRealTravelFixtures()
  .filter((fixture) => fixture.id === 508 || fixture.id === 554)
  .map(toTravel)

const settings: BookSettings = buildInitialSettings({ title: 'Мои путешествия', sortOrder: 'date-desc' })

const mockShowToast = showToast as jest.Mock
const mockRequestServerBookExport = requestServerBookExport as jest.Mock

function runExport(selected: Travel[], signal?: AbortSignal) {
  const stages: ExportStage[] = []
  const setError = jest.fn()
  const setCurrentStage = jest.fn()
  const setIsGenerating = jest.fn()
  const printSession = beginPrint()

  const promise = runPdfExport({
    selected,
    settings,
    printSession,
    signal,
    travelCacheRef: { current: {} } as MutableRefObject<Record<string | number, Travel>>,
    isMountedRef: { current: true } as MutableRefObject<boolean>,
    setIsGenerating,
    setError,
    setCurrentStage,
    updateProgress: (stage) => {
      stages.push(stage)
    },
  })

  return { promise, stages, setError, setCurrentStage, setIsGenerating, printSession }
}

describe('runPdfExport в приложении (без DOM)', () => {
  const originalFetch = global.fetch
  afterAll(() => {
    global.fetch = originalFetch
  })

  beforeEach(() => {
    mockImageFetch.mockResolvedValue({ ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
    global.fetch = mockImageFetch as unknown as typeof fetch
    jest.clearAllMocks()
    mockRequireOptionalNativeModule.mockReturnValue({})
    mockPrintAsync.mockResolvedValue(undefined)
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///cache/book.pdf', numberOfPages: 12 })
    mockFetchTravel.mockImplementation(async (id: number) => {
      const found = travels.find((travel) => Number(travel.id) === id)
      if (!found) throw new Error(`нет путешествия ${id}`)
      return found
    })
  })

  it('окружение — как Hermes: браузерных глобалов нет', () => {
    expectHermesLikeGlobals()
  })

  it('книга каталога из двух путешествий уходит в системный диалог печати', async () => {
    const run = runExport(travels)
    expect(run.printSession.available).toBe(true)

    await run.promise

    expect(run.setError).toHaveBeenCalledTimes(1)
    expect(run.setError).toHaveBeenCalledWith(null)
    expect(run.setCurrentStage).not.toHaveBeenCalledWith(ExportStage.ERROR)
    expect(mockShowToast).not.toHaveBeenCalled()

    expect(mockPrintAsync).toHaveBeenCalledWith({ uri: 'file:///cache/book.pdf' })
    const { html } = mockPrintToFileAsync.mock.calls[0][0] as { html: string }
    expect((html.match(/class="[^"]*\bpdf-page\b/g) ?? []).length).toBeGreaterThanOrEqual(6)
    // Обе статьи в документе, картинки — абсолютными https-адресами сайта.
    for (const travel of travels) expect(html).toContain(travel.name)
    expect(html).toContain('src="data:image/jpeg;base64,AQID"')
    expect(html).not.toContain('src="https://metravel.by/')
    expect(html).not.toMatch(/src="\/(?!\/)/)
    // Документ для системного диалога: без панели «Печать» и без скриптов.
    expect(html).not.toContain('print-toolbar')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('window.print')

    expect(run.stages[run.stages.length - 1]).toBe(ExportStage.COMPLETE)
    expect(run.setIsGenerating).toHaveBeenLastCalledWith(false)
  })

  it('серверный экспорт в приложении не запрашивается: его файл там нечем сохранить', async () => {
    await runExport(travels).promise

    expect(mockRequestServerBookExport).not.toHaveBeenCalled()
  })

  it('закрытый без печати диалог (iOS) — не ошибка и не «Готово»', async () => {
    mockPrintAsync.mockRejectedValue(Object.assign(new Error('Printing did not complete'), { code: 'ERR_PRINT_INCOMPLETE' }))

    const run = runExport(travels)
    await run.promise

    expect(mockPrintAsync).toHaveBeenCalledTimes(1)
    expect(run.stages).not.toContain(ExportStage.COMPLETE)
    expect(run.setCurrentStage).not.toHaveBeenCalledWith(ExportStage.ERROR)
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('сбой самой печати показывается тостом ошибки, сборка не висит', async () => {
    mockPrintAsync.mockRejectedValue(new Error('printer exploded'))

    const run = runExport(travels)
    await run.promise

    expect(run.setCurrentStage).toHaveBeenCalledWith(ExportStage.ERROR)
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', text2: 'printer exploded' }))
    expect(run.setIsGenerating).toHaveBeenLastCalledWith(false)
  })

  // #2274: на стенде картинки уходят на недоступный адрес, и WKWebView ждал их
  // бесконечно на 85 %. Теперь не ответивший хост убирается до expo-print.
  it('#2274: хост картинок не отвечает — лист открывается без них, тост с числом, не ошибка', async () => {
    mockImageFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('https://metravel.by/')) throw new TypeError('Network request failed')
      return { ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
    })

    const run = runExport(travels)
    await run.promise

    expect(mockPrintAsync).toHaveBeenCalledWith({ uri: 'file:///cache/book.pdf' })
    const { html } = mockPrintToFileAsync.mock.calls[0][0] as { html: string }
    expect(html).not.toContain('src="https://metravel.by/')
    expect(html).toContain('src="data:image/gif;base64,')
    expect(mockShowToast).toHaveBeenCalledTimes(1)
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }))
    expect(run.setCurrentStage).not.toHaveBeenCalledWith(ExportStage.ERROR)
    expect(run.stages[run.stages.length - 1]).toBe(ExportStage.COMPLETE)
  })

  it('#2274: «Отмена» во время ожидания картинок — лист не открывается, ни ошибки, ни тоста', async () => {
    // Как usePdfExport.cancel: сигнал рантайма и отмена сессии печати разом.
    const controller = new AbortController()
    let cancelRun = () => {}
    mockImageFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      const pending = new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
      cancelRun()
      return pending
    })

    const run = runExport(travels, controller.signal)
    cancelRun = () => {
      controller.abort()
      run.printSession.cancel()
    }
    await run.promise

    expect(mockImageFetch).toHaveBeenCalled()
    expect(mockPrintAsync).not.toHaveBeenCalled()
    expect(mockShowToast).not.toHaveBeenCalled()
    expect(run.setError).not.toHaveBeenCalledWith(expect.any(Error))
    expect(run.stages).not.toContain(ExportStage.COMPLETE)
  })
})
