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
      EXPO_PUBLIC_GOOGLE_API_SECRET: 'secret',
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

  it('reuses a stored native client_id across multiple Measurement Protocol events', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }))

    const getItem = jest.fn().mockResolvedValue('stored-client-id')
    const setItem = jest.fn()
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { getItem, setItem },
    }))

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    })
    global.fetch = fetchMock as any

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('AuthViewed', { source: 'test' })
    await sendAnalyticsEvent('AuthSuccess', { source: 'test' })

    expect(getItem).toHaveBeenCalledTimes(1)
    expect(setItem).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))

    expect(firstPayload.client_id).toBe('stored-client-id')
    expect(secondPayload.client_id).toBe('stored-client-id')
  })

  it('persists a generated native client_id and reuses it within the session when storage is empty', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }))

    const getItem = jest.fn().mockResolvedValue(null)
    const setItem = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { getItem, setItem },
    }))

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    })
    global.fetch = fetchMock as any

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('ExportViewed')
    await sendAnalyticsEvent('ExportEmptyStateShown')

    expect(getItem).toHaveBeenCalledTimes(1)
    expect(setItem).toHaveBeenCalledTimes(1)

    const generatedClientId = setItem.mock.calls[0][1]
    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))

    expect(firstPayload.client_id).toBe(generatedClientId)
    expect(secondPayload.client_id).toBe(generatedClientId)
  })

  it('sends web product events to both GA4 and Yandex Metrika when both are ready', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { getItem: jest.fn(), setItem: jest.fn() },
    }))

    const gtag = jest.fn()
    const ym = jest.fn()
    ;(global as any).window = {
      gtag,
      ym,
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

  it('normalizes Yandex goal names on web when event names contain unsupported characters', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { getItem: jest.fn(), setItem: jest.fn() },
    }))

    const ym = jest.fn()
    ;(global as any).window = {
      ym,
      __metravelMetrikaId: 62803912,
      __metravelMetrikaReady: true,
    }

    const { sendAnalyticsEvent } = require('@/utils/analytics')

    await sendAnalyticsEvent('Goal: CTA click / hero')

    expect(ym).toHaveBeenCalledWith(62803912, 'reachGoal', 'Goal__CTA_click___hero', {})
  })
})
