describe('utils/analytics', () => {
  const originalEnv = process.env
  const originalJestWorkerId = process.env.JEST_WORKER_ID

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    delete process.env.JEST_WORKER_ID
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      EXPO_PUBLIC_GOOGLE_GA4: 'G-TEST123',
    }
    delete process.env.JEST_WORKER_ID
  })

  afterEach(() => {
    process.env = originalEnv
    if (originalJestWorkerId) {
      process.env.JEST_WORKER_ID = originalJestWorkerId
    } else {
      delete process.env.JEST_WORKER_ID
    }
  })

  it.each(['ios', 'android'])('does not perform native analytics network I/O on %s', async (os) => {
    jest.doMock('react-native', () => ({
      Platform: { OS: os },
    }))

    const fetchMock = jest.fn()
    global.fetch = fetchMock as any

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('AuthViewed', { source: 'test' })
    await sendAnalyticsEvent('AuthSuccess', { source: 'test' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends web product events to both GA4 and Yandex Metrika when both are ready', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    const gtag = jest.fn()
    const ym = jest.fn()
    ;(global as any).window = {
      gtag,
      ym,
      localStorage: {
        getItem: jest.fn(() => JSON.stringify({ necessary: true, analytics: true })),
      },
      __metravelMetrikaId: 62803912,
      __metravelMetrikaReady: true,
    }

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('AuthSuccess', { source: 'google', intent: 'build-pdf' })

    expect(gtag).toHaveBeenCalledWith('event', 'AuthSuccess', { source: 'google', intent: 'build-pdf' })
    expect(ym).toHaveBeenCalledWith(62803912, 'reachGoal', 'AuthSuccess', {
      source: 'google',
      intent: 'build-pdf',
    })
  })

  it('does not send web events when analytics consent is denied', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    const gtag = jest.fn()
    const ym = jest.fn()
    ;(global as any).window = {
      gtag,
      ym,
      localStorage: {
        getItem: jest.fn(() => JSON.stringify({ necessary: true, analytics: false })),
      },
      __metravelMetrikaId: 62803912,
      __metravelMetrikaReady: true,
    }

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('AuthSuccess', { source: 'google' })

    expect(gtag).not.toHaveBeenCalled()
    expect(ym).not.toHaveBeenCalled()
  })

  it('normalizes Yandex goal names on web when event names contain unsupported characters', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    const ym = jest.fn()
    ;(global as any).window = {
      ym,
      localStorage: {
        getItem: jest.fn(() => JSON.stringify({ necessary: true, analytics: true })),
      },
      __metravelMetrikaId: 62803912,
      __metravelMetrikaReady: true,
    }

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('Goal: CTA click / hero')

    expect(ym).toHaveBeenCalledWith(62803912, 'reachGoal', 'Goal__CTA_click___hero', {})
  })

  it('sends every activation funnel goal id to Yandex Metrika reachGoal on web', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    const ym = jest.fn()
    ;(global as any).window = {
      ym,
      localStorage: {
        getItem: jest.fn(() => JSON.stringify({ necessary: true, analytics: true })),
      },
      __metravelMetrikaId: 62803912,
      __metravelMetrikaReady: true,
    }

    const { sendAnalyticsEvent } = require('@/utils/analytics')
    const activationGoals = [
      'registration_complete',
      'login_success',
      'quest_start',
      'quest_point_done',
      'quest_finish',
      'favorite_add',
      'travel_publish',
      'cta_register_click',
    ]

    for (const goal of activationGoals) {
      await sendAnalyticsEvent(goal, { source: 'activation_test' })
    }

    expect(ym.mock.calls.map((call) => call[2])).toEqual(activationGoals)
    for (const goal of activationGoals) {
      expect(ym).toHaveBeenCalledWith(62803912, 'reachGoal', goal, {
        source: 'activation_test',
      })
    }
  })

  it('queues early web events until analytics providers become ready', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    const listeners: Record<string, Array<() => void>> = {}
    const addEventListener = jest.fn((name: string, handler: () => void) => {
      listeners[name] = listeners[name] || []
      listeners[name].push(handler)
    })
    const dispatchEvent = jest.fn((event: { type: string }) => {
      for (const handler of listeners[event.type] || []) {
        handler()
      }
      return true
    })
    const gtag = jest.fn()
    const ym = jest.fn()
    const metravelLoadAnalytics = jest.fn()
    const localStorage = {
      getItem: jest.fn(() => JSON.stringify({ necessary: true, analytics: true })),
      setItem: jest.fn(),
    }

    ;(global as any).window = {
      addEventListener,
      dispatchEvent,
      localStorage,
      metravelLoadAnalytics,
      __metravelGaId: 'G-TEST123',
      __metravelMetrikaId: 62803912,
      __metravelMetrikaReady: false,
    }

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('HomeClick_OpenSearch', { source: 'hero' })

    expect(metravelLoadAnalytics).toHaveBeenCalledTimes(1)
    expect(gtag).not.toHaveBeenCalled()
    expect(ym).not.toHaveBeenCalled()
    expect((global as any).window.__metravelAnalyticsEventQueue).toEqual([
      { eventName: 'HomeClick_OpenSearch', eventParams: { source: 'hero' } },
    ])

    ;(global as any).window.gtag = gtag
    ;(global as any).window.ym = ym
    ;(global as any).window.__metravelMetrikaReady = true
    dispatchEvent({ type: 'metravel:analytics-ready' })

    await Promise.resolve()

    expect(gtag).toHaveBeenCalledWith('event', 'HomeClick_OpenSearch', { source: 'hero' })
    expect(ym).toHaveBeenCalledWith(62803912, 'reachGoal', 'HomeClick_OpenSearch', {
      source: 'hero',
    })
    expect((global as any).window.__metravelAnalyticsEventQueue).toEqual([])
  })
})
