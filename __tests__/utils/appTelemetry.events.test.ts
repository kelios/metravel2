import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'

import { GROWTH_FUNNEL_EVENTS } from '@/utils/growthFunnelAnalytics'

const mockPost = jest.fn()

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3', android: { versionCode: 23 }, ios: { buildNumber: '42' } },
    platform: { ios: { buildNumber: '42' } },
  },
}))
jest.mock('@/i18n/format', () => ({ getActiveLocale: () => 'ru' }))
jest.mock('expo-device', () => ({ modelName: 'iPhone 15', modelId: 'iPhone15,4' }))
jest.mock('@/api/client', () => {
  const { ApiError } = jest.requireActual('@/api/clientErrors')
  return { apiClient: { post: (...args: unknown[]) => mockPost(...args) }, ApiError }
})

import {
  APP_CRASH_QUEUE_KEY,
  APP_INSTALL_ID_KEY,
  APP_TELEMETRY_ENABLED_KEY,
  __resetAppTelemetry,
  setAppTelemetryEnabled,
} from '@/utils/appTelemetry'
import {
  APP_EVENT_QUEUE_KEY,
  APP_FIRST_OPEN_KEY,
  __resetAppEventTelemetry,
  enqueueAppTelemetryEvent,
  flushAppEvents,
  handleAppEventBackground,
  recordNativeAnalyticsEvent,
  startAppEventSession,
  toAppTelemetryEventName,
} from '@/utils/appEventTelemetry'

const originalOS = Platform.OS

const postedEvents = (): Array<{ name: string; props: Record<string, unknown> }> =>
  mockPost.mock.calls.flatMap(([, body]) => {
    const payload = body as { events?: Array<{ name: string; props: Record<string, unknown> }> }
    return payload?.events ?? []
  })

beforeEach(async () => {
  __resetAppEventTelemetry()
  __resetAppTelemetry()
  await AsyncStorage.clear()
  mockPost.mockReset()
  mockPost.mockImplementation(async (_endpoint: string, body: { events?: unknown[] }) => ({
    accepted: body?.events?.length ?? 1,
    duplicates: 0,
  }))
  ;(Platform as { OS: string }).OS = 'android'
})

afterEach(() => {
  __resetAppEventTelemetry()
  __resetAppTelemetry()
  ;(Platform as { OS: string }).OS = originalOS
})

describe('native app events', () => {
  it('keeps growth-funnel names and queues the same props', async () => {
    for (const name of Object.values(GROWTH_FUNNEL_EVENTS)) {
      expect(toAppTelemetryEventName(name)).toBe(name)
    }
    expect(toAppTelemetryEventName('AuthViewed')).toBeNull()
    expect(toAppTelemetryEventName('Goal: CTA click / hero')).toBeNull()

    const saved = await enqueueAppTelemetryEvent('quest_start', {
      quest_id: 'q1',
      source: 'quest_card',
      email: 'person@example.com',
      token: 'secret',
      latitude: 53.9,
      user_id: '42',
      userId: '42',
      message: 'свободный текст пользователя',
      note: 'this is a long free-form sentence that must not be stored in telemetry props at all',
    })
    expect(saved).toBe(true)
    const queued = JSON.parse((await AsyncStorage.getItem(APP_EVENT_QUEUE_KEY)) as string)
    expect(queued).toHaveLength(1)
    expect(queued[0].name).toBe('quest_start')
    expect(queued[0].props).toEqual({ quest_id: 'q1', source: 'quest_card' })
    expect(JSON.stringify(queued[0])).not.toMatch(/example.com|secret|53\.9/)
  })

  it('flushes at 20 events and never sends more than 50 in one batch', async () => {
    for (let index = 0; index < 19; index += 1) {
      await recordNativeAnalyticsEvent('quest_view', { index })
    }
    expect(mockPost).not.toHaveBeenCalled()
    await recordNativeAnalyticsEvent('quest_view', { index: 19 })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(postedEvents()).toHaveLength(20)

    mockPost.mockClear()
    for (let index = 0; index < 60; index += 1) {
      await enqueueAppTelemetryEvent('quest_step_view', { index })
    }
    await flushAppEvents()
    const sizes = mockPost.mock.calls.map(([, body]) => (body as { events: unknown[] }).events.length)
    expect(sizes).toEqual([50, 10])
    const payload = mockPost.mock.calls[0][1] as { install_id: string; platform: string; events: Array<{ session_id: string }> }
    expect(payload.platform).toBe('android')
    expect(payload.install_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(payload.events[0].session_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(payload).not.toHaveProperty('user_id')
    expect(mockPost.mock.calls[0][0]).toBe('/app-telemetry/events/')
  })

  it('sends app_first_open once per install and closes the session in the background', async () => {
    await startAppEventSession()
    expect(postedEvents().map((event) => event.name)).toEqual(['app_first_open', 'app_open', 'session_start'])
    expect(await AsyncStorage.getItem(APP_FIRST_OPEN_KEY)).toEqual(expect.any(String))

    mockPost.mockClear()
    await startAppEventSession()
    expect(postedEvents().map((event) => event.name)).toEqual(['app_open', 'session_start'])

    mockPost.mockClear()
    await handleAppEventBackground()
    expect(postedEvents().map((event) => event.name)).toEqual(['session_end'])
  })

  it('sends nothing and clears both queues when the switch is off', async () => {
    await enqueueAppTelemetryEvent('quest_start', { quest_id: 'q1' })
    await setAppTelemetryEnabled(false)
    expect(await AsyncStorage.getItem(APP_TELEMETRY_ENABLED_KEY)).toBe('0')
    expect(JSON.parse((await AsyncStorage.getItem(APP_EVENT_QUEUE_KEY)) || '[]')).toEqual([])

    await recordNativeAnalyticsEvent('quest_start', { quest_id: 'q2' })
    await startAppEventSession()
    await flushAppEvents()
    expect(mockPost).not.toHaveBeenCalled()

    await AsyncStorage.setItem(APP_CRASH_QUEUE_KEY, JSON.stringify([{ id: 'stale' }]))
    await setAppTelemetryEnabled(false)
    expect(JSON.parse((await AsyncStorage.getItem(APP_CRASH_QUEUE_KEY)) || '[]')).toEqual([])
  })

  it('does not queue events on web', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    expect(await enqueueAppTelemetryEvent('quest_start', { quest_id: 'q1' })).toBe(false)
    expect(await AsyncStorage.getItem(APP_EVENT_QUEUE_KEY)).toBeNull()
  })

  it('closes a session that was already in the background when startup finished', async () => {
    const previous = AppState.currentState
    AppState.currentState = 'background'
    try {
      await startAppEventSession()
    } finally {
      AppState.currentState = previous
    }
    expect(postedEvents().map((event) => event.name)).toEqual([
      'app_first_open',
      'app_open',
      'session_start',
      'session_end',
    ])
  })

  it('does not post when the switch turns off before the request', async () => {
    await enqueueAppTelemetryEvent('quest_start', { quest_id: 'q1' })
    const getItem = AsyncStorage.getItem as jest.Mock
    const real = getItem.getMockImplementation()!
    getItem.mockImplementation(async (key: string) => {
      if (key === APP_INSTALL_ID_KEY) await setAppTelemetryEnabled(false)
      return real(key)
    })
    try {
      await flushAppEvents()
    } finally {
      getItem.mockImplementation(real)
    }
    expect(mockPost).not.toHaveBeenCalled()
    expect(JSON.parse((await AsyncStorage.getItem(APP_EVENT_QUEUE_KEY)) || '[]')).toEqual([])
  })

  it('does not let an older off wipe events queued after a newer on', async () => {
    await enqueueAppTelemetryEvent('quest_start', { quest_id: 'q1' })
    const setItem = AsyncStorage.setItem as jest.Mock
    const real = setItem.getMockImplementation()!
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let held = false
    setItem.mockImplementation(async (key: string, value: string) => {
      if (key === APP_TELEMETRY_ENABLED_KEY && value === '0' && !held) {
        held = true
        await gate
      }
      return real(key, value)
    })
    try {
      const turningOff = setAppTelemetryEnabled(false)
      for (let attempt = 0; attempt < 10 && !held; attempt += 1) await Promise.resolve()
      expect(held).toBe(true)
      const turningOn = setAppTelemetryEnabled(true)
      await enqueueAppTelemetryEvent('quest_start', { quest_id: 'q2' })
      release()
      await turningOff
      await turningOn
      const queued = JSON.parse((await AsyncStorage.getItem(APP_EVENT_QUEUE_KEY)) || '[]') as Array<{
        props: { quest_id: string }
      }>
      expect(queued.map((event) => event.props.quest_id)).toEqual(['q1', 'q2'])
      expect(await AsyncStorage.getItem(APP_TELEMETRY_ENABLED_KEY)).toBe('1')
    } finally {
      release()
      setItem.mockImplementation(real)
    }
  })

  it('sends app_first_open again only when the receiver never kept it', async () => {
    const { ApiError } = jest.requireMock('@/api/client') as {
      ApiError: new (status: number, message: string) => Error
    }
    mockPost.mockRejectedValueOnce(new ApiError(400, 'bad batch'))
    await startAppEventSession()
    expect(await AsyncStorage.getItem(APP_FIRST_OPEN_KEY)).toBeNull()

    mockPost.mockReset()
    mockPost.mockImplementation(async (_endpoint: string, body: { events?: unknown[] }) => ({
      accepted: body?.events?.length ?? 1,
      duplicates: 0,
    }))
    __resetAppEventTelemetry()
    await startAppEventSession()
    expect(postedEvents().map((event) => event.name)).toContain('app_first_open')
  })

  it('does not flush an app_first_open that never reached disk', async () => {
    const setItem = AsyncStorage.setItem as jest.Mock
    const real = setItem.getMockImplementation()!
    setItem.mockImplementationOnce(async () => {
      throw new Error('disk')
    })
    try {
      await startAppEventSession()
    } finally {
      setItem.mockImplementation(real)
    }
    expect(postedEvents().map((event) => event.name)).toEqual(['app_open', 'session_start'])
    expect(await AsyncStorage.getItem(APP_FIRST_OPEN_KEY)).toBeNull()
  })
})
