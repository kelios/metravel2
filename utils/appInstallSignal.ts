import { Platform } from 'react-native'

/**
 * Сигналы намерения для плашки «поставьте приложение» на mobile web (#2907).
 *
 * Плашка больше не показывается с порога: при показе по факту платформы её
 * нажимали 2,7 % увидевших и закрывали 36 %. Теперь она ждёт момента, когда
 * приложение действительно нужно, и говорит, зачем именно сейчас. Модуль лёгкий
 * и не тянет саму плашку: её чанк грузится только после первого сигнала.
 */
export type AppInstallSignal = 'quest_start' | 'offline_save' | 'second_travel' | 'article_scroll_50'

const VIEWED_TRAVELS_KEY = 'metravel_app_install_viewed_travels_v1'

let currentSignal: AppInstallSignal | null = null
const listeners = new Set<() => void>()

/** Первый сигнал за жизнь вкладки задаёт текст плашки; следующие его не перебивают. */
export function emitAppInstallSignal(signal: AppInstallSignal): void {
  if (Platform.OS !== 'web' || currentSignal) return
  currentSignal = signal
  listeners.forEach((listener) => listener())
}

export function getAppInstallSignal(): AppInstallSignal | null {
  return currentSignal
}

export function subscribeAppInstallSignal(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const readViewedTravels = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(VIEWED_TRAVELS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/**
 * Просмотр маршрута в рамках сессии: второй разный маршрут — сигнал
 * `second_travel`. Перезагрузка той же страницы вторым просмотром не считается.
 */
export function noteTravelViewForAppInstall(travelKey: string | number | null | undefined): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || travelKey == null || travelKey === '') return
  const key = String(travelKey)
  const viewed = readViewedTravels()
  if (!viewed.includes(key)) viewed.push(key)
  try {
    window.sessionStorage.setItem(VIEWED_TRAVELS_KEY, JSON.stringify(viewed.slice(-10)))
  } catch {
    // Приватный режим: сигнал второго маршрута просто не сработает.
  }
  if (viewed.length >= 2) emitAppInstallSignal('second_travel')
}

/** Только для тестов. */
export function resetAppInstallSignalForTests(): void {
  currentSignal = null
}
