// #2102: единая точка печати. Построение HTML — реальное (tripPlanPrintHtml),
// мокается только граница модуля: expo-print и наличие native-модуля.
import { Platform } from 'react-native'
import type { PlannedTrip } from '@/api/plannedTripsTypes'
import { buildTripPlanPrintHtml } from '@/components/trips/planning/print/tripPlanPrintHtml'
import { buildTripPlanPrintModel } from '@/components/trips/planning/print/tripPlanPrintModel'

const mockRequireOptionalNativeModule = jest.fn()
const mockPrintAsync = jest.fn()
const mockPrintToFileAsync = jest.fn()
const mockDeleteAsync = jest.fn(async () => undefined)
const mockShowToast = jest.fn(async () => undefined)
const mockFetch = jest.fn()

jest.mock('expo', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}))
jest.mock('expo-print', () => ({
  printAsync: (...args: unknown[]) => mockPrintAsync(...args),
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}))
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args) }))
jest.mock('@/utils/toast', () => ({ showToast: (...args: unknown[]) => mockShowToast(...(args as [])) }))

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

  const originalFetch = global.fetch
  const originalOS = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireOptionalNativeModule.mockReturnValue({})
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockPrintAsync.mockResolvedValue(undefined)
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///cache/book.pdf', numberOfPages: 1 })
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
    global.fetch = mockFetch as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })

  it('renders the real trip HTML into a bounded PDF file and prints its URI', async () => {
    const html = realHtml()

    await expect(native().printHtml(html, { title: trip.title })).resolves.toBe('printed')

    expect(mockPrintAsync).toHaveBeenCalledTimes(1)
    expect(mockPrintAsync).toHaveBeenCalledWith({ uri: 'file:///cache/book.pdf' })
    const [options] = mockPrintToFileAsync.mock.calls[0]
    expect(options.html).toContain('data-print-resource-policy')
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

  // #2160: замер на iPhone 17 Pro iOS 26.5 — закрытие листа приходит БЕЗ code,
  // только с reason PrintIncompleteException в тексте; раньше это показывало
  // пользователю ошибку «Разрешите всплывающие окна».
  it('закрытие листа без code (реальный reject iOS на новой архитектуре) — cancelled', async () => {
    mockPrintAsync.mockRejectedValueOnce(new Error('Printing did not complete'))
    await expect(native().printHtml(realHtml())).resolves.toBe('cancelled')

    mockPrintAsync.mockRejectedValueOnce(
      Object.assign(new Error("Calling the 'printAsync' function has failed"), { cause: new Error('Printing did not complete') }),
    )
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
    expect(mockPrintToFileAsync).toHaveBeenCalledWith({ html: expect.stringContaining('<p>x</p>') })
    expect(mockPrintAsync).toHaveBeenCalledWith({ uri: 'file:///cache/book.pdf' })
  })

  it('#2274: cancel до печати — cancelled, лист не открывается (как web-сессия #2125)', async () => {
    const session = native().beginPrint()
    expect(() => session.cancel()).not.toThrow()
    await expect(session.print('<p>x</p>')).resolves.toBe('cancelled')
    expect(mockPrintAsync).not.toHaveBeenCalled()
  })

  const withImages =
    '<html><body><img src="https://img.example/a.jpg?w=1&amp;q=2"><img src="https://dead.example/b.jpg"></body></html>'

  it('#2274: картинки проверяются до печати; не ответившая убирается, тост с числом', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('https://dead.example/')) throw new TypeError('Network request failed')
      return { ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
    })

    await expect(native().beginPrint().print(withImages)).resolves.toBe('printed')

    expect(mockFetch).toHaveBeenCalledWith('https://img.example/a.jpg?w=1&q=2', expect.objectContaining({ method: 'GET' }))
    const { html } = mockPrintToFileAsync.mock.calls[0][0] as { html: string }
    expect(html).toContain('src="data:image/jpeg;base64,AQID"')
    expect(html).not.toContain('dead.example')
    expect(mockShowToast).toHaveBeenCalledTimes(1)
    expect(mockShowToast.mock.calls[0][0]).toEqual(expect.objectContaining({ type: 'info' }))
  })

  it('#2274: deadline is 120 seconds from beginPrint, without an extra resource window', async () => {
    jest.useFakeTimers();
    try {
      const session = native().beginPrint();
      await jest.advanceTimersByTimeAsync(120_000);
      await expect(session.print(withImages)).rejects.toThrow('120');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockPrintAsync).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });

  it('#2274: a hung native file renderer reaches the deadline without presenting; its late file is removed', async () => {
    jest.useFakeTimers();
    let finish: (file: { uri: string; numberOfPages: number }) => void = () => {};
    mockPrintToFileAsync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    try {
      const session = native().beginPrint();
      const printing = session.print('<p>x</p>');
      const rejected = expect(printing).rejects.toThrow('120');
      await jest.advanceTimersByTimeAsync(0);
      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(120_000);
      await rejected;
      expect(mockPrintAsync).not.toHaveBeenCalled();
      finish({ uri: 'file:///cache/late-timeout.pdf', numberOfPages: 1 });
      await jest.advanceTimersByTimeAsync(0);
      expect(mockPrintAsync).not.toHaveBeenCalled();
      expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/late-timeout.pdf', { idempotent: true });
    } finally { jest.useRealTimers(); }
  });

  it('#2274: cancel during native rendering settles immediately and removes late PDF without a sheet', async () => {
    jest.useFakeTimers();
    let finish: (file: { uri: string; numberOfPages: number }) => void = () => {};
    mockPrintToFileAsync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    try {
      const session = native().beginPrint();
      const printing = session.print('<p>x</p>');
      await jest.advanceTimersByTimeAsync(0);
      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
      session.cancel();
      await expect(printing).resolves.toBe('cancelled');
      finish({ uri: 'file:///cache/late-cancel.pdf', numberOfPages: 1 });
      await jest.advanceTimersByTimeAsync(0);
      expect(mockPrintAsync).not.toHaveBeenCalled();
      expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/late-cancel.pdf', { idempotent: true });
      expect(mockShowToast).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });

  it('retains the submitted Android PDF because onWrite reads it after printAsync resolves', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    await expect(native().printHtml('<p>x</p>')).resolves.toBe('printed');
    expect(mockPrintAsync).toHaveBeenCalledWith({ uri: 'file:///cache/book.pdf' });
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('#2274: the preparation deadline does not cancel an already opened system sheet', async () => {
    jest.useFakeTimers();
    let finish: () => void = () => {};
    mockPrintAsync.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    try {
      const session = native().beginPrint();
      const printing = session.print('<p>x</p>');
      await jest.advanceTimersByTimeAsync(0);
      expect(mockPrintAsync).toHaveBeenCalledWith({ uri: 'file:///cache/book.pdf' });
      expect(mockDeleteAsync).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(120_001);
      expect(session.preparationSignal?.aborted).toBe(false);
      finish();
      await expect(printing).resolves.toBe('printed');
      await jest.advanceTimersByTimeAsync(0);
      expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/book.pdf', { idempotent: true });
    } finally { jest.useRealTimers(); }
  });

  it('#2274: cancel во время проверки картинок — cancelled, лист не открывается и позже', async () => {
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    const session = native().beginPrint()
    const printing = session.print(withImages)
    await Promise.resolve()
    session.cancel()

    await expect(printing).resolves.toBe('cancelled')
    expect(mockPrintAsync).not.toHaveBeenCalled()
    expect(mockShowToast).not.toHaveBeenCalled()
  })
})

describe('printHtml.web', () => {
  const openPending = jest.fn()
  const openWindow = jest.fn()
  const discardWindow = jest.fn()

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.doMock('@/utils/openBookPreviewWindow', () => ({
      openPendingBookPreviewWindow: (...a: unknown[]) => openPending(...a),
      openBookPreviewWindow: (...a: unknown[]) => openWindow(...a),
      discardPendingBookPreviewWindow: (...a: unknown[]) => discardWindow(...a),
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

  it('#2125: cancel до печати закрывает заглушку; печать после cancel ничего не пишет', async () => {
    const win = { closed: false }
    openPending.mockReturnValue(win)

    const session = web().beginPrint()
    session.cancel()
    session.cancel()
    expect(discardWindow).toHaveBeenCalledTimes(1)
    expect(discardWindow).toHaveBeenCalledWith(win)
    await expect(session.print('<p>x</p>')).resolves.toBe('cancelled')
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('#2125: cancel после печати не трогает окно с документом', async () => {
    openPending.mockReturnValue({ closed: false })

    const session = web().beginPrint()
    await expect(session.print('<p>x</p>')).resolves.toBe('printed')
    session.cancel()
    expect(discardWindow).not.toHaveBeenCalled()
  })

  it('#2125: окно закрыто пользователем во время сборки — cancelled, документ не пишется', async () => {
    const win = { closed: false }
    openPending.mockReturnValue(win)

    const session = web().beginPrint()
    win.closed = true
    await expect(session.print('<p>x</p>')).resolves.toBe('cancelled')
    expect(openWindow).not.toHaveBeenCalled()
    expect(discardWindow).toHaveBeenCalledWith(win)
  })

  it('#2125: окна нет — cancel без эффекта', () => {
    openPending.mockReturnValue(null)
    web().beginPrint().cancel()
    expect(discardWindow).not.toHaveBeenCalled()
  })

  it('isPrintAvailable не зависит от window — разметка не меняется между SSG и гидрацией', () => {
    delete (global as unknown as { window?: unknown }).window
    // Web-ответ не спрашивает и native-модуль: даже без него на сайте печатать есть чем.
    mockRequireOptionalNativeModule.mockReturnValue(null)
    expect(web().isPrintAvailable()).toBe(true)
    expect(
      (jest.requireActual('@/utils/printAvailability.web') as typeof import('@/utils/printAvailability.web')).isPrintAvailable()
    ).toBe(true)
    expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled()
  })

  describe('#2318 inPlace', () => {
    const doc = { open: jest.fn(), write: jest.fn(), close: jest.fn() }
    beforeEach(() => {
      doc.open.mockReset()
      doc.write.mockReset()
      doc.close.mockReset()
      ;(global as unknown as { window: unknown }).window = { open: jest.fn(), document: doc }
    })

    it('окно не открывается, печатная версия пишется в документ этой вкладки', async () => {
      const session = web().beginPrint({ inPlace: true })
      expect(openPending).not.toHaveBeenCalled()
      expect(session.available).toBe(true)

      await expect(session.print(realHtml())).resolves.toBe('printed')
      expect(doc.open).toHaveBeenCalledTimes(1)
      expect(doc.close).toHaveBeenCalledTimes(1)
      const [written] = doc.write.mock.calls[0]
      expect(written).toContain('Кольцо вокруг озера')
      expect(written).toContain('window.print()')
      expect(openWindow).not.toHaveBeenCalled()
      await expect(session.print('<p>x</p>')).resolves.toBe('cancelled')
      expect(doc.write).toHaveBeenCalledTimes(1)
    })

    it('cancel до печати — документ страницы не трогается', async () => {
      const session = web().beginPrint({ inPlace: true })
      session.cancel()
      await expect(session.print('<p>x</p>')).resolves.toBe('cancelled')
      expect(doc.open).not.toHaveBeenCalled()
      expect(discardWindow).not.toHaveBeenCalled()
    })

    it('отменённый signal (ушли с экрана) — документ страницы не трогается', async () => {
      const controller = new AbortController()
      const session = web().beginPrint({ inPlace: true, signal: controller.signal })
      controller.abort()
      await expect(session.print('<p>x</p>')).resolves.toBe('cancelled')
      expect(doc.open).not.toHaveBeenCalled()
    })

    it('запись не удалась — unavailable, вкладку на about:blank не уводит', async () => {
      doc.write.mockImplementation(() => {
        throw new Error('blocked')
      })
      await expect(web().beginPrint({ inPlace: true }).print('<p>x</p>')).resolves.toBe('unavailable')
      expect(openWindow).not.toHaveBeenCalled()
    })
  })

  it('документ без кнопки печати остаётся как есть', () => {
    expect(web().withPrintActionHandler('<p>x</p>')).toBe('<p>x</p>')
  })
})
