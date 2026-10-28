// Сбор падений нативного приложения (#2840) в наш бэкенд через очередь
// utils/appTelemetry. Источники:
// - фатальные и нефатальные JS-исключения — ErrorUtils global handler;
// - необработанные отказы промисов — трекер Hermes;
// - ошибки рендера, пойманные error boundary, — logError → MonitoringService;
// - нештатное завершение (нативный краш, ANR, OOM) — маркер сессии: если
//   прошлый запуск не ушёл в фон и не записал свой отчёт, сообщаем при старте.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import {
  CRASH_MESSAGE_MAX,
  CRASH_STACK_MAX,
  enqueueAppCrashReport,
  flushAppCrashReports,
  getAppInstallId,
  getAppSessionId,
  getAppTelemetryEnvironment,
  type AppCrashKind,
  type AppTelemetryEnvironment,
} from '@/utils/appTelemetry'
import { setMonitoringService } from '@/utils/logger'
import { createUuidV4 } from '@/utils/uuid'

export const APP_SESSION_MARKER_KEY = 'metravel_app_session_marker_v1'

/** Потолок отчётов за сессию: цикл одной ошибки не должен залить очередь. */
export const CRASH_REPORTS_PER_SESSION = 20
/** Сколько ждать записи фатального отчёта, прежде чем отдать ошибку RN. */
export const FATAL_PERSIST_TIMEOUT_MS = 1000

type SessionMarker = AppTelemetryEnvironment & {
  session_id: string
  started_at: string
  /** Ушла в фон или завершилась штатно — убийство в фоне не считается падением. */
  clean: boolean
  /** Фатальный отчёт уже записан — abnormal_exit был бы дублем. */
  crash_reported: boolean
}

type CaptureInput = {
  kind: AppCrashKind
  fatal: boolean
  error: unknown
  component?: string
}

let installed = false
let reportsThisSession = 0
const seenThisSession = new Set<string>()
/** Маркер текущей сессии в памяти: создаётся синхронно при установке. */
let marker: SessionMarker | null = null
/**
 * Прошлый маркер прочитан и обработан. До этого текущий на диск писать нельзя:
 * он затрёт след прошлой сессии, а ранняя фатальная ошибка не должна
 * потеряться из-за того, что чтение ещё не закончилось.
 */
let previousMarkerHandled: Promise<void> | null = null
let markerWrites: Promise<void> = Promise.resolve()

const truncate = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value)

const ERROR_NAMES = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError', 'AggregateError'])

const describeError = (error: unknown): { message: string; stack: string; fingerprint: string } => {
  if (!(error instanceof Error)) {
    return { message: 'Non-Error rejection', stack: '', fingerprint: String(error) }
  }
  // Произвольный message может содержать пароль, текст статьи или ответ API.
  // Regex-очистка не гарантирует приватность: передаём класс и координаты
  // JS-кадров, без текста, аргументов функций, URL query и личных путей.
  const name = ERROR_NAMES.has(error.name) ? error.name : 'Error'
  const sourceFrames = String(error.stack ?? '').split('\n').slice(1).filter((line) => /^\s*at\s|^[^\s@]*@/.test(line))
  const frames = sourceFrames.flatMap((line) => {
    const location = line.match(/(?:^|[\s(/\\@])([A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx|mjs|cjs|bundle|hbc))(?:\?[^()\r\n]*)?:(\d+):(\d+)\)?\s*$/)
    return location ? [`at ${location[1]}:${location[2]}:${location[3]}`] : []
  })
  return {
    message: name,
    stack: frames.join('\n'),
    // Только в памяти для подавления повторов, в отчёт не попадает.
    // Async-tail меняется после await даже у того же callsite. Первый кадр
    // стабилен; полный путь здесь различает index.ts из разных компонентов.
    fingerprint: `${error.name}:${error.message}:${sourceFrames[0]?.trim() ?? ''}`,
  }
}

const persistMarker = async (): Promise<void> => {
  if (!marker) return
  const snapshot = JSON.stringify(marker)
  markerWrites = markerWrites
    .then(() => AsyncStorage.setItem(APP_SESSION_MARKER_KEY, snapshot))
    .catch(() => {})
  await markerWrites
}

const updateMarker = async (patch: Partial<SessionMarker>): Promise<void> => {
  if (!marker) return
  marker = { ...marker, ...patch }
  try {
    if (previousMarkerHandled) await previousMarkerHandled
  } catch {
    // Прошлый отчёт ещё не сохранён — не затираем его маркер.
    return
  }
  await persistMarker()
}

const readPreviousMarker = async (): Promise<SessionMarker | null> => {
  const raw = await AsyncStorage.getItem(APP_SESSION_MARKER_KEY)
  try {
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed.session_id === 'string' ? (parsed as SessionMarker) : null
  } catch {
    return null
  }
}

/** Кладёт отчёт в очередь. Возвращает промис записи в хранилище. */
export async function captureAppCrash(input: CaptureInput): Promise<boolean> {
  try {
    const { message, stack, fingerprint } = describeError(input.error)
    const dedupeKey = `${input.kind}:${input.fatal}:${fingerprint}`
    if (seenThisSession.has(dedupeKey)) return false
    // Потолок — против цикла нефатальных ошибок. Фатальная его не считает: она
    // последняя в процессе, а её маркер гасит abnormal_exit — пропусти её, и
    // падение не попадёт в отчёты вовсе.
    if (!input.fatal && reportsThisSession >= CRASH_REPORTS_PER_SESSION) return false
    seenThisSession.add(dedupeKey)
    if (!input.fatal) reportsThisSession += 1

    const component = input.component && /^(?:in |at )?[A-Za-z_$][\w.$]*$/.test(input.component)
      ? input.component
      : undefined
    const durable = await enqueueAppCrashReport({
      ...getAppTelemetryEnvironment(),
      id: createUuidV4(),
      install_id: await getAppInstallId(),
      session_id: getAppSessionId(),
      ts: new Date().toISOString(),
      kind: input.kind,
      fatal: input.fatal,
      message: truncate(message, CRASH_MESSAGE_MAX),
      stack: truncate(stack, CRASH_STACK_MAX),
      ...(component ? { component: truncate(component, 200) } : {}),
    })
    // Нефатальный отчёт отдаём сразу; фатальный уйдёт при следующем запуске —
    // процесс сейчас умрёт, и запрос всё равно не долетит.
    if (!input.fatal) void flushAppCrashReports()
    return durable
  } catch {
    // Сбор падений никогда не должен сам ронять приложение.
    return false
  }
}

const reportPreviousAbnormalExit = async (previous: SessionMarker | null) => {
  if (!previous || previous.clean || previous.crash_reported) return
  const durable = await enqueueAppCrashReport({
    platform: previous.platform,
    app_version: previous.app_version,
    build_number: previous.build_number,
    os_version: previous.os_version,
    device_model: previous.device_model,
    locale: previous.locale ?? 'ru',
    // Один abnormal_exit на сессию даже если процесс погиб после записи
    // очереди, но до замены старого маркера новым.
    id: previous.session_id,
    install_id: await getAppInstallId(),
    session_id: previous.session_id,
    ts: new Date().toISOString(),
    kind: 'abnormal_exit',
    fatal: true,
    message: `Session started at ${previous.started_at} ended in foreground without a report`,
    stack: '',
  })
  // Не затираем прошлый маркер, если очередь пока не может записать отчёт.
  if (!durable) throw new Error('Previous crash is not persisted')
}

const withTimeout = (promise: Promise<void>, ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    void promise.then(() => { clearTimeout(timer); resolve() }, () => { clearTimeout(timer); resolve() })
  })

const installGlobalHandler = () => {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
  if (!errorUtils?.setGlobalHandler) return
  const previous = errorUtils.getGlobalHandler?.()

  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    if (!isFatal) {
      void captureAppCrash({ kind: 'js_exception', fatal: false, error })
      previous?.(error, isFatal)
      return
    }
    // Фатальная ошибка: RN после обработчика убивает процесс, поэтому сперва
    // даём отчёту и маркеру записаться — но не дольше таймаута.
    const persisted = captureAppCrash({ kind: 'js_exception', fatal: true, error }).then(async (durable) => {
      // Нельзя погасить abnormal_exit раньше durable-записи самого отчёта.
      if (durable) await updateMarker({ crash_reported: true })
    })
    void withTimeout(persisted, FATAL_PERSIST_TIMEOUT_MS).finally(() => previous?.(error, isFatal))
  })
}

type ErrorUtilsLike = {
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined
}

type HermesLike = {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean
    onUnhandled: (id: number, rejection: unknown) => void
    onHandled: (id: number) => void
  }) => void
}

const installRejectionTracker = () => {
  const hermes = (globalThis as { HermesInternal?: HermesLike }).HermesInternal
  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, rejection) => {
      void captureAppCrash({ kind: 'unhandled_rejection', fatal: false, error: rejection })
    },
    onHandled: () => {},
  })
}

const installMonitoringAdapter = () => {
  setMonitoringService({
    captureException(error, context) {
      // logError зовут и для обработанных ошибок (офлайн, отменённые запросы —
      // #478): это не падения. Падением считается только то, что поймал
      // error boundary; необработанное ловит global handler.
      if (!context?.errorBoundary) return
      const componentStack = typeof context.componentStack === 'string' ? context.componentStack : ''
      void captureAppCrash({
        kind: 'render_error',
        fatal: false,
        error,
        component: componentStack.trim().split('\n')[0] || undefined,
      })
    },
    captureMessage(message, level) {
      if (level !== 'error') return
      void captureAppCrash({ kind: 'js_exception', fatal: false, error: new Error(message) })
    },
    // Отчёты анонимны: пользователя сервер берёт из авторизации запроса.
    setUser() {},
    setContext() {},
  })
}

const handleAppStateChange = (status: AppStateStatus) => {
  if (status === 'background') {
    void updateMarker({ clean: true })
  } else if (status === 'active') {
    void updateMarker({ clean: false })
    void flushAppCrashReports()
  }
}

/**
 * Включает сбор падений. Только нативные release-сборки: в dev ошибки видны в
 * LogBox и Metro; `EXPO_PUBLIC_CRASH_REPORTING_DEV=true` включает сбор и в dev
 * для проверки на эмуляторе/симуляторе. Ограничения dev-режима с флагом:
 * render_error не придёт (logError зовёт мониторинг только вне __DEV__), а наш
 * трекер отказов промисов заменяет dev-трекер RN с его предупреждениями LogBox.
 */
export function installCrashReporting(): void {
  if (installed || Platform.OS === 'web') return
  const devEnabled = String(process.env.EXPO_PUBLIC_CRASH_REPORTING_DEV || '').toLowerCase() === 'true'
  if (__DEV__ && !devEnabled) return
  installed = true

  installGlobalHandler()
  installRejectionTracker()
  installMonitoringAdapter()
  AppState.addEventListener('change', handleAppStateChange)

  marker = {
    ...getAppTelemetryEnvironment(),
    session_id: getAppSessionId(),
    started_at: new Date().toISOString(),
    clean: AppState.currentState === 'background',
    crash_reported: false,
  }
  previousMarkerHandled = readPreviousMarker().then(reportPreviousAbnormalExit)
  // Пишем то, что лежит в памяти к этому моменту: фатальная ошибка, случившаяся
  // во время чтения, уже успела отметить crash_reported.
  void previousMarkerHandled.then(persistMarker).then(flushAppCrashReports).catch(() => {})
}

/** Только для тестов. */
export function __resetCrashReporting(): void {
  installed = false
  reportsThisSession = 0
  seenThisSession.clear()
  marker = null
  previousMarkerHandled = null
  markerWrites = Promise.resolve()
  setMonitoringService(null)
}
