import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript'

type Consent = { necessary: boolean; analytics: boolean }

type SetupOptions = {
  host?: string
  consent?: Consent | null
}

const TEST_METRIKA_ID = '12345678'
const TEST_GA_ID = 'G-TEST'

const originalWindow = (global as any).window
const originalDocument = (global as any).document
const originalHistory = (global as any).history
const originalNavigator = (global as any).navigator

const setupDomEnv = ({ host = 'metravel.by', consent = { necessary: true, analytics: true } }: SetupOptions = {}) => {
  const headMock = {
    appendChild: jest.fn(),
  }

  const createdScripts: Array<Record<string, any>> = []

  const documentMock = {
    readyState: 'complete',
    title: 'Test title',
    referrer: 'https://metravel.by',
    head: headMock,
    documentElement: {
      appendChild: jest.fn(),
    },
    createElement: jest.fn((tag: string) => {
      if (tag === 'script') {
        const script = {
          tagName: 'script',
          async: false,
          defer: false,
          src: '',
          setAttribute: jest.fn(),
          onload: null,
          onerror: null,
        }
        createdScripts.push(script)
        return script
      }
      return { tagName: tag }
    }),
    getElementsByTagName: jest.fn(() => [{ parentNode: { insertBefore: jest.fn() } }]),
    addEventListener: jest.fn(),
    querySelector: jest.fn(() => null),
  }

  const historyMock = {
    pushState: jest.fn(function pushState(this: unknown) {
      return null
    }),
    replaceState: jest.fn(function replaceState(this: unknown) {
      return null
    }),
  }

  const ymSpy = jest.fn()

  const windowMock: Record<string, any> = {
    location: { hostname: host, href: `https://${host}` },
    document: documentMock,
    history: historyMock,
    localStorage: {
      getItem: jest.fn(() => (consent ? JSON.stringify(consent) : null)),
    },
    addEventListener: jest.fn(),
    requestIdleCallback: jest.fn((cb: any) => cb()),
    dataLayer: [],
    ym: ymSpy,
  }

  windowMock.window = windowMock
  windowMock.navigator = {}

  ;(global as any).window = windowMock
  ;(global as any).document = documentMock
  ;(global as any).history = historyMock
  ;(global as any).navigator = windowMock.navigator
  ;(global as any).localStorage = windowMock.localStorage

  return { windowMock, documentMock, headMock, createdScripts, ymSpy }
}

const runAnalyticsSnippet = (windowMock: Record<string, any>, documentMock: Record<string, any>) => {
  process.env.EXPO_PUBLIC_METRIKA_ID = TEST_METRIKA_ID
  const snippet = getAnalyticsInlineScript(parseInt(TEST_METRIKA_ID, 10), TEST_GA_ID)

  try {
    const analyticsFunction = new Function('window', 'document', 'navigator', snippet)
    analyticsFunction(windowMock, documentMock, windowMock.navigator || {})
  } catch (error) {
    console.error('[Analytics Test] Ошибка выполнения аналитики:', error)
  }
}

describe('analytics inline script', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    ;(global as any).window = originalWindow
    ;(global as any).document = originalDocument
    ;(global as any).history = originalHistory
    ;(global as any).navigator = originalNavigator
    delete (global as any).localStorage
  })

  it('initializes Yandex Metrica and GA when consent is granted on production host', () => {
    const { windowMock, createdScripts, ymSpy } = setupDomEnv()

    runAnalyticsSnippet(windowMock, windowMock.document)

    expect(typeof windowMock.metravelLoadAnalytics).toBe('function')
    expect(windowMock.__metravelMetrikaId).toBe(parseInt(TEST_METRIKA_ID, 10))
    expect(windowMock.__metravelGaId).toBe(TEST_GA_ID)
    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()

    windowMock.metravelLoadAnalytics()

    expect(windowMock.__metravelAnalyticsLoaded).toBe(true)
    expect(createdScripts).toHaveLength(2)
    const metrikaScript = createdScripts.find((entry) => entry.src === 'https://mc.yandex.ru/metrika/tag.js')
    expect(metrikaScript).toBeTruthy()
    metrikaScript?.onload?.()

    expect(ymSpy).toHaveBeenCalledWith(
      parseInt(TEST_METRIKA_ID, 10),
      'init',
      expect.objectContaining({ webvisor: false, triggerEvent: true })
    )
    expect(windowMock.gtag).toBeDefined()
    expect(windowMock.dataLayer.length).toBeGreaterThan(0)
  })

  it('respects explicit analytics opt-out (does not init until user opts in)', () => {
    const { windowMock } = setupDomEnv({
      consent: { necessary: true, analytics: false },
    })

    runAnalyticsSnippet(windowMock, windowMock.document)

    expect(typeof windowMock.metravelLoadAnalytics).toBe('function')
    expect(windowMock.__metravelMetrikaId).toBe(parseInt(TEST_METRIKA_ID, 10))
    expect(windowMock.__metravelGaId).toBe(TEST_GA_ID)
    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()
    expect(windowMock.gtag).toBeUndefined()
    expect(windowMock.dataLayer).toHaveLength(0)

    windowMock.metravelLoadAnalytics()

    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()
    expect(windowMock.gtag).toBeUndefined()
    expect(windowMock.dataLayer).toHaveLength(0)
    expect(windowMock[`ga-disable-${TEST_GA_ID}`]).toBe(true)

    // Simulate user opt-in via banner/settings:
    windowMock.localStorage.getItem = jest.fn(() => JSON.stringify({ necessary: true, analytics: true }))
    windowMock.metravelLoadAnalytics()

    expect(windowMock.__metravelAnalyticsLoaded).toBe(true)
    expect(windowMock.gtag).toBeDefined()
    expect(windowMock.dataLayer.length).toBeGreaterThan(0)
  })

  it('treats missing analytics field as denied (opt-in default)', () => {
    const { windowMock } = setupDomEnv({
      consent: { necessary: true } as any,
    })

    runAnalyticsSnippet(windowMock, windowMock.document)

    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()
    expect(windowMock.gtag).toBeUndefined()
    expect(windowMock.dataLayer).toHaveLength(0)
  })

  it('skips analytics injection on non-production hosts', () => {
    const { windowMock } = setupDomEnv({ host: 'localhost' })

    runAnalyticsSnippet(windowMock, windowMock.document)

    expect(windowMock.metravelLoadAnalytics).toBeUndefined()
    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()
  })

  it('tracks pageviews for Metrika and GA on SPA navigation', () => {
    jest.useFakeTimers()
    const { windowMock, createdScripts, ymSpy } = setupDomEnv()

    runAnalyticsSnippet(windowMock, windowMock.document)
    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()
    windowMock.metravelLoadAnalytics()
    createdScripts
      .find((entry) => entry.src === 'https://mc.yandex.ru/metrika/tag.js')
      ?.onload?.()
    jest.runOnlyPendingTimers()

    const ymHitCalls = () =>
      ymSpy.mock.calls.filter((call) => call[1] === 'hit')

    expect(ymHitCalls().length).toBeGreaterThanOrEqual(1)
    expect(ymHitCalls()[0][2]).toBe(`https://${windowMock.location.hostname}`)

    const pageViewEvents = () =>
      (windowMock.dataLayer || []).filter(
        (entry: any) => entry && entry[0] === 'event' && entry[1] === 'page_view'
      )

    expect(pageViewEvents().length).toBeGreaterThanOrEqual(1)

    windowMock.location.href = `https://${windowMock.location.hostname}/new-page`
    windowMock.history.pushState({}, '', '/new-page')
    jest.runOnlyPendingTimers()

    expect(ymHitCalls().length).toBeGreaterThanOrEqual(2)
    expect(ymHitCalls()[ymHitCalls().length - 1][2]).toBe(windowMock.location.href)
    expect(pageViewEvents().length).toBeGreaterThanOrEqual(2)

    windowMock.history.replaceState({}, '', '/new-page')
    jest.runOnlyPendingTimers()

    expect(ymHitCalls().length).toBeGreaterThanOrEqual(2)
    expect(ymHitCalls()[ymHitCalls().length - 1][2]).toBe(windowMock.location.href)

    jest.useRealTimers()
  })

  it('autoloads analytics shortly after page load for short passive sessions', () => {
    jest.useFakeTimers()
    const { windowMock, createdScripts, ymSpy } = setupDomEnv()

    runAnalyticsSnippet(windowMock, windowMock.document)

    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()

    jest.advanceTimersByTime(999)
    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()

    jest.advanceTimersByTime(1)
    expect(windowMock.__metravelAnalyticsLoaded).toBe(true)
    createdScripts
      .find((entry) => entry.src === 'https://mc.yandex.ru/metrika/tag.js')
      ?.onload?.()
    expect(ymSpy).toHaveBeenCalledWith(
      parseInt(TEST_METRIKA_ID, 10),
      'init',
      expect.objectContaining({ trackLinks: true, webvisor: false })
    )

    jest.useRealTimers()
  })

  it('marks metrika bootstrap as failed when the external script cannot be loaded', () => {
    const { windowMock, createdScripts, ymSpy } = setupDomEnv()

    runAnalyticsSnippet(windowMock, windowMock.document)
    windowMock.metravelLoadAnalytics()

    const metrikaScript = createdScripts.find((entry) => entry.src === 'https://mc.yandex.ru/metrika/tag.js')
    expect(metrikaScript).toBeTruthy()

    metrikaScript?.onerror?.()

    expect(windowMock.__metravelMetrikaFailed).toBe(true)
    expect(windowMock.__metravelMetrikaLoading).toBe(false)
    expect(ymSpy.mock.calls.some((call) => call[1] === 'init')).toBe(false)
  })
})
