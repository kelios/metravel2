import { getAnalyticsInlineScript } from '@/app/+html'

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
        return {
          tagName: 'script',
          async: false,
          defer: false,
          src: '',
          setAttribute: jest.fn(),
        }
      }
      return { tagName: tag }
    }),
    getElementsByTagName: jest.fn(() => [{ parentNode: { insertBefore: jest.fn() } }]),
    addEventListener: jest.fn(),
  }

  const historyMock = {
    pushState: jest.fn(function pushState(this: unknown) {
      return null
    }),
    replaceState: jest.fn(function replaceState(this: unknown) {
      return null
    }),
  }

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
    ym: jest.fn(),
  }

  windowMock.window = windowMock
  windowMock.navigator = {}

  ;(global as any).window = windowMock
  ;(global as any).document = documentMock
  ;(global as any).history = historyMock
  ;(global as any).navigator = windowMock.navigator
  ;(global as any).localStorage = windowMock.localStorage

  return { windowMock, documentMock, headMock }
}

const runAnalyticsSnippet = () => {
  process.env.EXPO_PUBLIC_METRIKA_ID = TEST_METRIKA_ID
  const snippet = getAnalyticsInlineScript(parseInt(TEST_METRIKA_ID, 10), TEST_GA_ID)
   
  // ✅ ИСПРАВЛЕНИЕ: Вместо eval() создаём и выполняем script в изолированной области
  // eval() опасна - создаём функцию из кода и вызываем её в нужном контексте
  try {
    const analyticsFunction = new Function(snippet);
    analyticsFunction.call(global);
  } catch (error) {
    console.error('[Analytics Test] Ошибка выполнения аналитики:', error);
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
    const { windowMock } = setupDomEnv()

    runAnalyticsSnippet()

    expect(typeof windowMock.metravelLoadAnalytics).toBe('function')
    expect(windowMock.__metravelMetrikaId).toBe(parseInt(TEST_METRIKA_ID, 10))
    expect(windowMock.__metravelGaId).toBe(TEST_GA_ID)
    expect(windowMock.__metravelAnalyticsLoaded).toBe(true)
    expect(windowMock.ym).toHaveBeenCalledWith(
      parseInt(TEST_METRIKA_ID, 10),
      'init',
      expect.objectContaining({ webvisor: true })
    )
    expect(windowMock.gtag).toBeDefined()
    expect(windowMock.dataLayer.length).toBeGreaterThan(0)
  })

  it('respects explicit analytics opt-out (does not init until user opts in)', () => {
    const { windowMock } = setupDomEnv({
      consent: { necessary: true, analytics: false },
    })

    runAnalyticsSnippet()

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

  it('treats missing analytics field as allowed (backward compatible)', () => {
    const { windowMock } = setupDomEnv({
      consent: { necessary: true } as any,
    })

    runAnalyticsSnippet()

    expect(windowMock.__metravelAnalyticsLoaded).toBe(true)
    expect(windowMock.gtag).toBeDefined()
    expect(windowMock.dataLayer.length).toBeGreaterThan(0)
  })

  it('skips analytics injection on non-production hosts', () => {
    const { windowMock } = setupDomEnv({ host: 'localhost' })

    runAnalyticsSnippet()

    expect(windowMock.metravelLoadAnalytics).toBeUndefined()
    expect(windowMock.__metravelAnalyticsLoaded).toBeUndefined()
  })

  it('tracks pageviews for Metrika and GA on SPA navigation', () => {
    jest.useFakeTimers()
    const { windowMock } = setupDomEnv()

    runAnalyticsSnippet()
    jest.runOnlyPendingTimers()

    const ymHitCalls = () =>
      (windowMock.ym as jest.Mock).mock.calls.filter((call) => call[1] === 'hit')

    expect(ymHitCalls().length).toBeGreaterThanOrEqual(1)
    expect(ymHitCalls()[0][2]).toBe(`https://${windowMock.location.hostname}`)

    const pageViewEvents = () =>
      (windowMock.dataLayer || []).filter(
        (entry: any[]) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === 'page_view'
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
})
