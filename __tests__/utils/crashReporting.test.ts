// #2840: сбор падений нативного приложения в наш бэкенд. Инварианты: фатальный
// отчёт успевает записаться до того, как RN убьёт процесс; нештатное завершение
// прошлой сессии превращается ровно в один abnormal_exit; одна и та же ошибка
// не заливает очередь; неподходящий серверу отчёт снимается, а невыкаченный
// эндпоинт (404) отчёты не теряет.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'

const mockPost = jest.fn()

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3', android: { versionCode: 23 }, ios: { buildNumber: '42' } },
    platform: { ios: { buildNumber: '42' } },
  },
}))
jest.mock('@/i18n/format', () => ({ getActiveLocale: () => 'pl' }))
jest.mock('expo-device', () => ({ modelName: 'iPhone 15', modelId: 'iPhone15,4' }))

jest.mock('@/api/client', () => {
  const { ApiError } = jest.requireActual('@/api/clientErrors')
  return { apiClient: { post: (...args: any[]) => mockPost(...args) }, ApiError }
})

import { ApiError } from '@/api/clientErrors'
import {
  APP_CRASH_QUEUE_KEY,
  APP_INSTALL_ID_KEY,
  CRASH_STACK_MAX,
  __resetAppTelemetry,
  enqueueAppCrashReport,
  flushAppCrashReports,
  getAppTelemetryEnvironment,
  getAppInstallId,
  type AppCrashReport,
} from '@/utils/appTelemetry'
import {
  APP_SESSION_MARKER_KEY,
  CRASH_REPORTS_PER_SESSION,
  __resetCrashReporting,
  captureAppCrash,
  installCrashReporting,
} from '@/utils/crashReporting'
import { getMonitoringService } from '@/utils/logger'

const readQueue = async (): Promise<any[]> => {
  const raw = await AsyncStorage.getItem(APP_CRASH_QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

const originalOS = Platform.OS
const originalErrorUtils = (globalThis as any).ErrorUtils
// setItem уже jest.fn из setup: spyOn/restoreAllMocks не восстанавливают его
// implementation. Сохраняем функцию, а не bind mock-а к самому себе.
const originalSetItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!
const pendingCompletions: Array<() => void> = []
const pending = <T,>(value: T): Promise<T> => new Promise((resolve) => {
  pendingCompletions.push(() => resolve(value))
})
let appStateListener: ((status: string) => void) | null = null

beforeEach(async () => {
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalSetItem)
  __resetCrashReporting()
  __resetAppTelemetry()
  await AsyncStorage.clear()
  mockPost.mockReset()
  mockPost.mockResolvedValue({ accepted: 1, duplicates: 0 })
  ;(Platform as any).OS = 'android'
  process.env.EXPO_PUBLIC_CRASH_REPORTING_DEV = 'true'
  appStateListener = null
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: any) => {
    appStateListener = listener
    return { remove: jest.fn() }
  }) as any)
})

afterEach(async () => {
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalSetItem)
  for (const complete of pendingCompletions.splice(0)) complete()
  await flushPromises()
  await flushAppCrashReports()
  __resetCrashReporting()
  __resetAppTelemetry()
  ;(Platform as any).OS = originalOS
  ;(globalThis as any).ErrorUtils = originalErrorUtils
  delete process.env.EXPO_PUBLIC_CRASH_REPORTING_DEV
  jest.restoreAllMocks()
})

const installWithErrorUtils = () => {
  const previous = jest.fn()
  let handler: ((error: unknown, isFatal?: boolean) => void) | null = null
  ;(globalThis as any).ErrorUtils = {
    getGlobalHandler: () => previous,
    setGlobalHandler: (next: any) => {
      handler = next
    },
  }
  installCrashReporting()
  return { previous, fire: (error: unknown, isFatal?: boolean) => handler?.(error, isFatal) }
}

describe('crash reporting', () => {
  it('persists a fatal JS crash before handing the error back to React Native', async () => {
    mockPost.mockReturnValue(pending({ accepted: 1, duplicates: 0 }))
    const { previous, fire } = installWithErrorUtils()
    await flushPromises()

    fire(new TypeError('undefined is not a function'), true)
    expect(previous).not.toHaveBeenCalled()
    await flushPromises()
    await flushPromises()

    expect(previous).toHaveBeenCalledTimes(1)
    const [report] = await readQueue()
    expect(report).toMatchObject({
      kind: 'js_exception',
      fatal: true,
      message: 'TypeError',
      platform: 'android',
      locale: 'pl',
    })
    expect(report.install_id).toMatch(/^[0-9a-f-]{36}$/)
    const marker = JSON.parse((await AsyncStorage.getItem(APP_SESSION_MARKER_KEY)) as string)
    expect(marker.crash_reported).toBe(true)
  })

  it('reports an abnormal exit once when the previous session died in the foreground', async () => {
    await AsyncStorage.setItem(
      APP_SESSION_MARKER_KEY,
      JSON.stringify({
        session_id: 'prev-session',
        started_at: '2026-10-27T10:00:00.000Z',
        clean: false,
        crash_reported: false,
        platform: 'android',
        app_version: '1.0.4',
        build_number: '23',
        os_version: '34',
        device_model: 'Google Pixel 7',
      }),
    )
    installWithErrorUtils()
    await flushPromises()
    await flushPromises()

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/app-telemetry/crashes/',
      expect.objectContaining({ kind: 'abnormal_exit', session_id: 'prev-session', app_version: '1.0.4' }),
      undefined, expect.objectContaining({ expectedStatus: 202 }),
    )
    const marker = JSON.parse((await AsyncStorage.getItem(APP_SESSION_MARKER_KEY)) as string)
    expect(marker.session_id).not.toBe('prev-session')
    expect(marker.clean).toBe(false)
  })

  it('does not suppress abnormal_exit when persisting the fatal report fails', async () => {
    const { previous, fire } = installWithErrorUtils()
    await flushPromises()
    jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) =>
      key === APP_CRASH_QUEUE_KEY ? Promise.reject(new Error('storage full')) : originalSetItem(key, value),
    )

    fire(new Error('fatal'), true)
    await flushPromises()
    await flushPromises()

    expect(previous).toHaveBeenCalledTimes(1)
    const saved = JSON.parse((await AsyncStorage.getItem(APP_SESSION_MARKER_KEY)) as string)
    expect(saved.crash_reported).toBe(false)
  })

  it('hands a fatal crash back after one second even when storage is stuck', async () => {
    const { previous, fire } = installWithErrorUtils()
    await flushPromises()
    jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) =>
      key === APP_CRASH_QUEUE_KEY ? pending(undefined).then(() => originalSetItem(key, value)) : originalSetItem(key, value),
    )
    fire(new Error('fatal with stalled storage'), true)
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(previous).toHaveBeenCalledTimes(1)
  })

  it('passes a nonfatal exception to the previous handler immediately', async () => {
    const { previous, fire } = installWithErrorUtils()
    const error = new Error('nonfatal')
    fire(error, false)
    expect(previous).toHaveBeenCalledWith(error, false)
    await flushPromises()
  })

  it('captures Hermes unhandled promise rejections', async () => {
    const previousHermes = (globalThis as any).HermesInternal
    const enablePromiseRejectionTracker = jest.fn()
    ;(globalThis as any).HermesInternal = { enablePromiseRejectionTracker }
    try {
      installWithErrorUtils()
      const [options] = enablePromiseRejectionTracker.mock.calls[0]
      options.onUnhandled(1, new Error('rejection'))
      await flushPromises()
      await flushPromises()
      expect(mockPost).toHaveBeenCalledWith('/app-telemetry/crashes/', expect.objectContaining({
        kind: 'unhandled_rejection', fatal: false,
      }), undefined, expect.objectContaining({ expectedStatus: 202 }))
    } finally {
      ;(globalThis as any).HermesInternal = previousHermes
    }
  })

  it('keeps the error class and safe frame identifiers, without private values', async () => {
    const secret = 'person@example.test token=secret123 private travel diary'
    const error = new Error(secret)
    error.stack = `Error: ${secret}\n    at save (/Users/private-owner/app/index.android.bundle:12:34)\n    at send (https://example.test/index.js?token=secret123:2:3)\n    at render (address at index.android.bundle:1:9021)`
    await captureAppCrash({ kind: 'js_exception', fatal: false, error })
    await flushAppCrashReports()
    const [, report] = mockPost.mock.calls[0]
    expect(report).toMatchObject({
      message: 'Error',
      stack: 'at save (index.android.bundle:12:34)\nat send (index.js:2:3)\nat render (index.android.bundle:1:9021)',
    })
    expect(JSON.stringify(report)).not.toMatch(/person@|secret123|private travel diary|private-owner/)

    mockPost.mockClear()
    await captureAppCrash({ kind: 'unhandled_rejection', fatal: false, error: secret })
    await flushAppCrashReports()
    expect(JSON.stringify(mockPost.mock.calls[0])).not.toContain(secret)
  })

  it('preserves distinct production callsites and rejects arbitrary frame descriptions', async () => {
    const error = new Error('private text')
    error.stack = 'Error: private text\n    at TravelStore.save (address at index.android.bundle:1:123)\nrender@https://example.test/index.android.bundle?token=secret:1:456\n    at private travel diary (index.android.bundle:1:789)'
    await captureAppCrash({ kind: 'js_exception', fatal: false, error })
    await flushAppCrashReports()
    const [, report] = mockPost.mock.calls[0]
    expect(report.stack).toBe('at TravelStore.save (index.android.bundle:1:123)\nat render (index.android.bundle:1:456)\nat index.android.bundle:1:789')
    expect(report.stack).not.toMatch(/private|https|secret|token/)
  })

  it('limits stack size after removing raw messages and paths', async () => {
    const error = new Error('x'.repeat(1000))
    error.stack = `Error: ${error.message}\n${'    at fn (index.android.bundle:12:34)\n'.repeat(1500)}`
    await captureAppCrash({ kind: 'js_exception', fatal: false, error })
    await flushAppCrashReports()
    const [, report] = mockPost.mock.calls[0]
    expect(report.message.length).toBeLessThanOrEqual(500)
    expect(report.stack.length).toBe(CRASH_STACK_MAX)
  })

  it('includes the active locale and iOS model rather than the interface idiom', () => {
    ;(Platform as any).OS = 'ios'
    expect(getAppTelemetryEnvironment()).toMatchObject({
      platform: 'ios', device_model: 'iPhone 15', locale: 'pl', app_version: '1.2.3', build_number: '42',
    })
  })

  it('keeps the same report id through network failure and a process restart', async () => {
    mockPost.mockRejectedValue(new Error('offline'))
    await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('offline crash') })
    await flushAppCrashReports()
    const [report] = await readQueue()
    __resetAppTelemetry()
    mockPost.mockClear()
    mockPost.mockResolvedValue({ accepted: 1, duplicates: 0 })
    await flushAppCrashReports()
    expect(mockPost).toHaveBeenCalledWith('/app-telemetry/crashes/', expect.objectContaining({ id: report.id }), undefined, expect.objectContaining({ expectedStatus: 202 }))
    expect(await readQueue()).toEqual([])
  })

  it.each([null, {}, { accepted: 0, duplicates: 0 }, { accepted: 1, duplicates: -1 }])(
    'does not discard a report without a valid acknowledgement: %j', async (ack) => {
      mockPost.mockResolvedValue(ack)
      await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('kept') })
      await flushAppCrashReports()
      expect(await readQueue()).toHaveLength(1)
    },
  )

  it('removes a report acknowledged as an existing duplicate', async () => {
    mockPost.mockResolvedValue({ accepted: 0, duplicates: 1 })
    await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('duplicate') })
    await flushAppCrashReports()
    expect(await readQueue()).toEqual([])
  })

  it('adapts error messages without exposing their contents', async () => {
    installWithErrorUtils()
    await flushPromises()
    getMonitoringService()?.captureMessage('a private article', 'error', { token: 'private' })
    await flushPromises()
    await flushAppCrashReports()
    expect(mockPost).toHaveBeenCalledWith('/app-telemetry/crashes/', expect.objectContaining({ message: 'Error' }), undefined, expect.objectContaining({ expectedStatus: 202 }))
    expect(JSON.stringify(mockPost.mock.calls)).not.toMatch(/private article|"token"/)
  })

  it.each([401, 403, 404, 429, 500])('keeps reports after HTTP %s', async (status) => {
    mockPost.mockRejectedValue(new ApiError(status, 'retry later'))
    await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('kept') })
    await flushAppCrashReports()
    expect(await readQueue()).toHaveLength(1)
  })

  it('evicts the oldest report at 100 items, including after reload', async () => {
    for (let index = 0; index < 105; index += 1) {
      await enqueueAppCrashReport({ id: String(index), install_id: 'i', session_id: 's', kind: 'js_exception', message: 'Error' } as AppCrashReport)
    }
    const queue = await readQueue()
    expect(queue).toHaveLength(100)
    expect(queue[0].id).toBe('5')
    __resetAppTelemetry()
    await enqueueAppCrashReport({ ...queue[0], id: 'new' })
    expect(await readQueue()).toHaveLength(100)
  })

  it.each([
    ['went to background', { clean: true, crash_reported: false }],
    ['already sent its fatal report', { clean: false, crash_reported: true }],
  ])('does not report an abnormal exit when the previous session %s', async (_label, state) => {
    await AsyncStorage.setItem(
      APP_SESSION_MARKER_KEY,
      JSON.stringify({ session_id: 'prev', started_at: 'x', platform: 'android', ...state }),
    )
    installWithErrorUtils()
    await flushPromises()
    await flushPromises()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('marks the session clean in background and flushes on return', async () => {
    installWithErrorUtils()
    await flushPromises()
    appStateListener?.('background')
    await flushPromises()
    let marker = JSON.parse((await AsyncStorage.getItem(APP_SESSION_MARKER_KEY)) as string)
    expect(marker.clean).toBe(true)

    appStateListener?.('active')
    await flushPromises()
    marker = JSON.parse((await AsyncStorage.getItem(APP_SESSION_MARKER_KEY)) as string)
    expect(marker.clean).toBe(false)
  })

  it('sends render errors from the error boundary through logError monitoring', async () => {
    installWithErrorUtils()
    await flushPromises()
    getMonitoringService()?.captureException(new Error('boom'), {
      errorBoundary: true,
      componentStack: '\n    in TravelDetails\n    in Screen',
    })
    await flushPromises()
    await flushPromises()
    expect(mockPost).toHaveBeenCalledWith(
      '/app-telemetry/crashes/',
      expect.objectContaining({ kind: 'render_error', fatal: false, component: 'in TravelDetails' }),
      undefined, expect.objectContaining({ expectedStatus: 202 }),
    )

    mockPost.mockClear()
    getMonitoringService()?.captureException(new Error('Network request failed'), { url: '/api/x' })
    await flushPromises()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('deduplicates one async callsite, preserves different callsites, and caps the session', async () => {
    mockPost.mockReturnValue(pending({ accepted: 1, duplicates: 0 }))
    for (let i = 0; i < 3; i += 1) {
      await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('same') })
    }
    expect(await readQueue()).toHaveLength(1)

    // Тот же текст, другой источник: это отдельная ошибка, а не повтор.
    await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('same') })
    expect(await readQueue()).toHaveLength(2)

    for (let i = 0; i < CRASH_REPORTS_PER_SESSION + 5; i += 1) {
      await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error(`e${i}`) })
    }
    expect(await readQueue()).toHaveLength(CRASH_REPORTS_PER_SESSION)
  })

  it('keeps reports while the endpoint is not deployed and drops ones the server rejects', async () => {
    mockPost.mockRejectedValue(new ApiError(404, 'Not Found'))
    await captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error('kept') })
    await flushAppCrashReports()
    expect(mockPost).toHaveBeenCalled()
    expect(await readQueue()).toHaveLength(1)

    mockPost.mockRejectedValueOnce(new ApiError(400, 'bad payload'))
    await flushAppCrashReports()
    expect(await readQueue()).toHaveLength(0)
  })

  it('retries the same error after a temporary queue read failure', async () => {
    const originalGetItem = jest.mocked(AsyncStorage.getItem).getMockImplementation()!
    const error = new Error('same crash after storage recovers')
    jest.mocked(AsyncStorage.getItem).mockImplementation((key) =>
      key === APP_CRASH_QUEUE_KEY ? Promise.reject(new Error('storage unavailable')) : originalGetItem(key),
    )
    try {
      expect(await captureAppCrash({ kind: 'js_exception', fatal: false, error })).toBe(false)
      expect(mockPost).not.toHaveBeenCalled()
    } finally {
      jest.mocked(AsyncStorage.getItem).mockImplementation(originalGetItem)
    }
    expect(await captureAppCrash({ kind: 'js_exception', fatal: false, error })).toBe(true)
    await flushAppCrashReports()
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('does not replace a saved install id after a temporary read failure', async () => {
    const savedId = '11111111-1111-4111-8111-111111111111'
    await AsyncStorage.setItem(APP_INSTALL_ID_KEY, savedId)
    const originalGetItem = jest.mocked(AsyncStorage.getItem).getMockImplementation()!
    jest.mocked(AsyncStorage.getItem).mockImplementation((key) =>
      key === APP_INSTALL_ID_KEY ? Promise.reject(new Error('storage unavailable')) : originalGetItem(key),
    )
    try {
      const temporaryId = await getAppInstallId()
      expect(temporaryId).not.toBe(savedId)
      expect(await getAppInstallId()).toBe(temporaryId)
      expect(await originalGetItem(APP_INSTALL_ID_KEY)).toBe(savedId)
    } finally {
      jest.mocked(AsyncStorage.getItem).mockImplementation(originalGetItem)
    }
    __resetAppTelemetry()
    expect(await getAppInstallId()).toBe(savedId)
  })

  it('stays off on web and in dev without the explicit flag', () => {
    const setGlobalHandler = jest.fn()
    ;(globalThis as any).ErrorUtils = { setGlobalHandler, getGlobalHandler: () => undefined }

    ;(Platform as any).OS = 'web'
    installCrashReporting()
    ;(Platform as any).OS = 'android'
    delete process.env.EXPO_PUBLIC_CRASH_REPORTING_DEV
    const originalDev = (globalThis as any).__DEV__
    ;(globalThis as any).__DEV__ = true
    try {
      installCrashReporting()
    } finally {
      ;(globalThis as any).__DEV__ = originalDev
    }

    expect(setGlobalHandler).not.toHaveBeenCalled()
  })

  it('drops crash delivery when the shared improve-app switch is off', async () => {
    const { setAppTelemetryEnabled } = require('@/utils/appTelemetry')
    await setAppTelemetryEnabled(false)
    const saved = await enqueueAppCrashReport({
      id: '11111111-1111-4111-8111-111111111111',
      install_id: '22222222-2222-4222-8222-222222222222',
      session_id: '33333333-3333-4333-8333-333333333333',
      platform: 'android',
      app_version: '1.2.3',
      build_number: '23',
      os_version: '34',
      device_model: 'Pixel',
      locale: 'pl',
      ts: '2026-10-28T00:00:00.000Z',
      kind: 'js_exception',
      fatal: false,
      message: 'Error',
      stack: '',
    })
    expect(saved).toBe(false)
    await flushAppCrashReports()
    expect(mockPost).not.toHaveBeenCalled()
    expect(await readQueue()).toEqual([])
  })
})
