// #2102: единая точка печати. Построение HTML — реальное (tripPlanPrintHtml),
// мокается только граница модуля: expo-print и наличие native-модуля.
import type { PlannedTrip } from '@/api/plannedTripsTypes'
import { buildTripPlanPrintHtml } from '@/components/trips/planning/print/tripPlanPrintHtml'
import { buildTripPlanPrintModel } from '@/components/trips/planning/print/tripPlanPrintModel'

const mockRequireOptionalNativeModule = jest.fn()
const mockPrintAsync = jest.fn()

jest.mock('expo', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}))
jest.mock('expo-print', () => ({
  printAsync: (...args: unknown[]) => mockPrintAsync(...args),
}))

const trip = {
  id: 7,
  slug: 'loop',
  title: 'Кольцо вокруг озера',
  description: 'Описание',
  startDate: '2026-09-25',
  endDate: '2026-09-26',
  startTime: null,
  transport: 'foot',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 1,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Owner', avatarUrl: null },
  route: [{ id: 'A', type: 'custom', name: 'A', description: null, coordinates: [6.4, 49.8], placeId: null }],
  routeGeometry: null,
  routeSummary: { distanceKm: 3, durationMin: 0, elevationGainM: 0, stopsCount: 1, provider: 'ors' },
  routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: null,
  createdAt: '2026-09-01',
} as unknown as PlannedTrip

const realHtml = () =>
  buildTripPlanPrintHtml(buildTripPlanPrintModel(trip, null), {
    maps: {},
    pageUrl: 'https://metravel.by/trips/plan/7',
    printedAt: new Date(2026, 8, 23),
  })

describe('printHtml.native', () => {
  const native = () => require('@/utils/printHtml.native') as typeof import('@/utils/printHtml.native')

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireOptionalNativeModule.mockReturnValue({})
    mockPrintAsync.mockResolvedValue(undefined)
  })

  it('передаёт в printAsync реальный HTML плана поездки', async () => {
    const html = realHtml()

    await expect(native().printHtml(html, { title: trip.title })).resolves.toBe('printed')

    expect(mockPrintAsync).toHaveBeenCalledTimes(1)
    const [options] = mockPrintAsync.mock.calls[0]
    expect(options.html).toBe(html)
    expect(options.html).toContain('Кольцо вокруг озера')
    expect(options.html).toContain('<section class="day"')
  })

  // Реальный reject iOS при закрытии листа без печати: PrintIncompleteException
  // (ios/ExpoPrintWithPrinter.swift, completed=false) → code ERR_PRINT_INCOMPLETE.
  it('лист печати закрыт без печати (iOS: ERR_PRINT_INCOMPLETE) — cancelled, не ошибка', async () => {
    mockPrintAsync.mockRejectedValueOnce(Object.assign(new Error('Printing did not complete'), { code: 'ERR_PRINT_INCOMPLETE' }))

    await expect(native().printHtml(realHtml())).resolves.toBe('cancelled')
  })

  it('отмена выбора принтера (ERR_PICKER_CANCELED) — тоже cancelled', async () => {
    mockPrintAsync.mockRejectedValueOnce(Object.assign(new Error('Printer picker has been cancelled'), { code: 'ERR_PICKER_CANCELED' }))

    await expect(native().printHtml(realHtml())).resolves.toBe('cancelled')
  })

  it('настоящая ошибка печати не маскируется под отмену — даже со словом cancel в тексте', async () => {
    mockPrintAsync.mockRejectedValueOnce(Object.assign(new Error('Error occurred while printing to PDF'), { code: 'ERR_PDF_NOT_RENDERED' }))
    await expect(native().printHtml(realHtml())).rejects.toThrow('printing to PDF')

    mockPrintAsync.mockRejectedValueOnce(Object.assign(new Error('job cancelled by printer'), { code: 'ERR_PRINTING_JOB_FAILED' }))
    await expect(native().printHtml(realHtml())).rejects.toThrow('job cancelled')
  })

  it('нет native-модуля (старая сборка) — unavailable, expo-print не трогается', async () => {
    mockRequireOptionalNativeModule.mockReturnValue(null)

    expect(native().isPrintAvailable()).toBe(false)
    expect(native().beginPrint().available).toBe(false)
    await expect(native().printHtml(realHtml())).resolves.toBe('unavailable')
    expect(mockPrintAsync).not.toHaveBeenCalled()
  })

  it('beginPrint на native ничего не резервирует и печатает по готовому HTML', async () => {
    await expect(native().beginPrint().print('<p>x</p>')).resolves.toBe('printed')
    expect(mockPrintAsync).toHaveBeenCalledWith({ html: '<p>x</p>' })
  })
})

describe('printHtml.web', () => {
  const openPending = jest.fn()
  const openWindow = jest.fn()

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.doMock('@/utils/openBookPreviewWindow', () => ({
      openPendingBookPreviewWindow: (...a: unknown[]) => openPending(...a),
      openBookPreviewWindow: (...a: unknown[]) => openWindow(...a),
    }))
    ;(global as unknown as { window: unknown }).window = { open: jest.fn() }
  })

  afterEach(() => {
    delete (global as unknown as { window?: unknown }).window
  })

  const web = () => require('@/utils/printHtml.web') as typeof import('@/utils/printHtml.web')

  it('окно открывается синхронно в beginPrint, HTML пишется позже в то же окно', async () => {
    const win = {}
    openPending.mockReturnValue(win)

    const session = web().beginPrint()
    expect(openPending).toHaveBeenCalledTimes(1)
    expect(session.available).toBe(true)
    expect(openWindow).not.toHaveBeenCalled()

    await expect(session.print(realHtml())).resolves.toBe('printed')
    const [written, target] = openWindow.mock.calls[0]
    expect(target).toBe(win)
    expect(written).toContain('Кольцо вокруг озера')
    // кнопка документа ('data-print-action') получает обработчик печати
    expect(written).toContain("closest('[data-print-action]')")
    expect(written).toContain('window.print()')
  })

  it('окно не открылось — available=false и unavailable, документ не пишется', async () => {
    openPending.mockReturnValue(null)

    expect(web().beginPrint().available).toBe(false)
    await expect(web().printHtml('<p>x</p>')).resolves.toBe('unavailable')
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('isPrintAvailable не зависит от window — разметка не меняется между SSG и гидрацией', () => {
    delete (global as unknown as { window?: unknown }).window
    expect(web().isPrintAvailable()).toBe(true)
  })

  it('документ без кнопки печати остаётся как есть', () => {
    expect(web().withPrintActionHandler('<p>x</p>')).toBe('<p>x</p>')
  })
})
