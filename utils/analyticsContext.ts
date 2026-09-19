import { Platform } from 'react-native'

import { readConsent } from '@/utils/consent'

/**
 * Общие измерения, которыми размечается любое событие воронки.
 *
 * Живут отдельно от самих воронок, потому что вопрос «кто это был» одинаков для
 * квестов, регистрации и создания маршрута: аноним или залогиненный, телефон
 * или десктоп, пришёл из поиска или изнутри сайта. Дублировать этот расчёт в
 * каждом `*FunnelAnalytics` — значит получить три расходящихся ответа на один
 * вопрос.
 *
 * Страна здесь СОЗНАТЕЛЬНО не считается. И GA4, и Метрика проставляют гео сами
 * по IP на каждое событие (в GA4 это измерение `Country`, в Метрике — срез
 * «География»), причём точнее, чем это можно сделать из браузера. Клиентский
 * геолукап добавил бы сетевой запрос и расхождение с отчётом провайдера.
 */

/** Ключи пользовательских идентификаторов. Версия в имени — чтобы смена формата не читала чужой мусор. */
const CLIENT_ID_KEY = 'metravel_analytics_cid_v1'
const SESSION_ID_KEY = 'metravel_analytics_sid_v1'
const SESSION_SOURCE_KEY = 'metravel_analytics_src_v1'

/**
 * Словарь ровно тот же, что у уже отправляемых событий: `growthFunnelAnalytics`
 * (`GrowthAuthState`) и `FavoritesProvider` шлют `auth_state` со значениями
 * `authenticated`/`guest`. Свой синоним (`logged_in`/`anonymous`) дал бы одному
 * параметру два словаря, и разрез по `auth_state` в GA4 распался бы на четыре
 * значения вместо двух.
 */
export type AnalyticsAuthState = 'authenticated' | 'guest'
export type AnalyticsDevice = 'mobile' | 'tablet' | 'desktop'
export type AnalyticsTrafficSource =
  | 'google'
  | 'yandex'
  | 'search'
  | 'social'
  | 'referral'
  | 'direct'
  | 'internal'
  | 'campaign'

const ANALYTICS_TRAFFIC_SOURCES = [
  'google',
  'yandex',
  'search',
  'social',
  'referral',
  'direct',
  'internal',
  'campaign',
] as const

/** Значение из sessionStorage могло быть записано чем угодно — проверяем, а не приводим. */
const toTrafficSource = (value: string | undefined): AnalyticsTrafficSource | undefined =>
  ANALYTICS_TRAFFIC_SOURCES.find((source) => source === value)

/** Планшетом считаем широкий тач-экран: у iPad и Android-планшета UA без токена `Mobile`. */
const TABLET_MIN_WIDTH = 768

// Проверяются на `${host}.`, а не на голом хосте: каждому шаблону нужна точка
// после имени, и без неё ветка `mail.ru` была бы мертва — у `go.mail.ru` после
// `mail.ru` конец строки, и поисковый переход уезжал бы в `referral`.
const SEARCH_HOSTS: Array<[RegExp, AnalyticsTrafficSource]> = [
  [/(^|\.)google\./i, 'google'],
  [/(^|\.)(yandex|ya)\./i, 'yandex'],
  [/(^|\.)(bing|duckduckgo|yahoo|ecosia|mail\.ru|rambler)\./i, 'search'],
]

const SOCIAL_HOSTS =
  /(^|\.)(facebook|fb|instagram|vk|vkontakte|t\.me|telegram|twitter|x|pinterest|ok|youtube|tiktok|reddit|linkedin)\./i

const isAnalyticsAllowed = () => readConsent()?.analytics === true

const getWindow = (): Window | undefined =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window : undefined

/**
 * Классификация устройства. Чистая: тест не поднимает DOM, а мобильный UA на
 * широком вьюпорте (десктопный Chrome в режиме эмуляции, Android-планшет)
 * разводится по ширине, а не по одному UA.
 */
export const classifyDevice = ({
  platformOs,
  userAgent,
  viewportWidth,
}: {
  platformOs?: string
  userAgent?: string
  viewportWidth?: number
}): AnalyticsDevice => {
  if (platformOs === 'ios' || platformOs === 'android') {
    // В нативном приложении вьюпорт — это сам экран устройства.
    return typeof viewportWidth === 'number' && viewportWidth >= TABLET_MIN_WIDTH ? 'tablet' : 'mobile'
  }

  const ua = String(userAgent || '')
  const isTabletUa = /ipad|android(?!.*mobile)|tablet|playbook|silk/i.test(ua)
  if (isTabletUa) return 'tablet'

  const isMobileUa = /mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)
  if (!isMobileUa) return 'desktop'

  // Телефонный UA, но вьюпорт планшетный — доверяем ширине.
  return typeof viewportWidth === 'number' && viewportWidth >= TABLET_MIN_WIDTH ? 'tablet' : 'mobile'
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * Откуда пришёл визит. Чистая функция: реальный `document.referrer` подставляет
 * вызывающий, а тест проверяет саму классификацию.
 *
 * `utm_source` важнее реферера: размеченная ссылка знает о кампании то, чего
 * заголовок Referer не знает, и при переходе из мессенджера реферера часто
 * вообще нет.
 */
export const classifyTrafficSource = ({
  referrer,
  utmSource,
  currentHost,
}: {
  referrer?: string
  utmSource?: string
  currentHost?: string
}): AnalyticsTrafficSource => {
  const utm = String(utmSource || '').trim().toLowerCase()
  if (utm) {
    if (/google/.test(utm)) return 'google'
    if (/yandex/.test(utm)) return 'yandex'
    if (SOCIAL_HOSTS.test(`${utm}.`)) return 'social'
    return 'campaign'
  }

  const ref = String(referrer || '').trim()
  if (!ref) return 'direct'

  const host = hostOf(ref)
  if (!host) return 'direct'
  if (currentHost && host === currentHost) return 'internal'

  const terminated = `${host}.`
  for (const [pattern, source] of SEARCH_HOSTS) {
    if (pattern.test(terminated)) return source
  }
  if (SOCIAL_HOSTS.test(terminated)) return 'social'

  return 'referral'
}

const randomId = (): string => {
  const crypto = getWindow()?.crypto
  if (typeof crypto?.randomUUID === 'function') {
    try {
      return String(crypto.randomUUID())
    } catch {
      // ниже
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const readStored = (storage: 'local' | 'session', key: string): string | undefined => {
  const w = getWindow()
  try {
    const value = (storage === 'local' ? w?.localStorage : w?.sessionStorage)?.getItem(key)
    return value ? String(value) : undefined
  } catch {
    return undefined
  }
}

const writeStored = (storage: 'local' | 'session', key: string, value: string) => {
  const w = getWindow()
  try {
    ;(storage === 'local' ? w?.localStorage : w?.sessionStorage)?.setItem(key, value)
  } catch {
    // Приватный режим и заблокированное хранилище — не повод терять событие.
  }
}

const ensureId = (storage: 'local' | 'session', key: string): string | undefined => {
  if (!getWindow()) return undefined
  const existing = readStored(storage, key)
  if (existing) return existing
  const next = randomId()
  writeStored(storage, key, next)
  return next
}

/**
 * Псевдонимный идентификатор «того же браузера» между визитами: по нему в
 * отчёте считается unique_user. Пишется только при согласии на аналитику — без
 * согласия событие всё равно не уходит, и заводить долгоживущую метку не за чем.
 */
export const getAnalyticsClientId = (): string | undefined => {
  if (!isAnalyticsAllowed()) return undefined
  return ensureId('local', CLIENT_ID_KEY)
}

/** Идентификатор визита: живёт до закрытия вкладки. */
export const getAnalyticsSessionId = (): string | undefined => {
  if (!isAnalyticsAllowed()) return undefined
  return ensureId('session', SESSION_ID_KEY)
}

/**
 * Источник визита фиксируется ОДИН раз за сессию и дальше читается из неё.
 *
 * Считать его в момент события нельзя: к пятой точке квеста игрок давно ушёл с
 * посадочной страницы, а после перезагрузки на внутреннем URL `document.referrer`
 * показывает нас самих — поисковый переход превратился бы в `internal`.
 */
export const getAnalyticsTrafficSource = (): AnalyticsTrafficSource | undefined => {
  if (!isAnalyticsAllowed()) return undefined
  const w = getWindow()
  if (!w) return undefined

  const stored = toTrafficSource(readStored('session', SESSION_SOURCE_KEY))
  if (stored) return stored

  let utmSource: string | undefined
  try {
    utmSource = new URL(String(w.location?.href || '')).searchParams.get('utm_source') || undefined
  } catch {
    utmSource = undefined
  }

  const source = classifyTrafficSource({
    referrer: w.document?.referrer,
    utmSource,
    currentHost: w.location?.hostname,
  })

  writeStored('session', SESSION_SOURCE_KEY, source)
  return source
}

export const getAnalyticsDevice = (): AnalyticsDevice => {
  const w = getWindow()
  return classifyDevice({
    platformOs: Platform.OS,
    userAgent: w?.navigator?.userAgent,
    viewportWidth: typeof w?.innerWidth === 'number' ? w.innerWidth : undefined,
  })
}

/**
 * Состояние авторизации читается из стора напрямую, а не через хук: событие
 * шлётся из колбэков и эффектов, у которых своего React-контекста может не быть.
 * Импорт отложен до первого события — модуль аналитики не должен инициализировать
 * тяжёлый auth-стор (zustand + secureStorage) на импорте ради одного поля.
 */
export const getAnalyticsAuthState = (): AnalyticsAuthState => {
  try {
    const store = require('@/stores/authStore')?.useAuthStore
    return store?.getState?.()?.isAuthenticated ? 'authenticated' : 'guest'
  } catch {
    return 'guest'
  }
}

/**
 * Снимает метки аналитики при отзыве согласия.
 *
 * Без этого `client_id` — долгоживущий псевдонимный идентификатор — пережил бы
 * отказ от аналитики и снова заработал бы, если согласие потом вернут: то есть
 * отказ не стирал бы уже заведённую метку, а только приостанавливал её. Функцию
 * зовёт сама поверхность согласия; запись о прохождении квеста снимает
 * `clearQuestFunnelRuns` — каждый модуль отвечает за свои ключи.
 */
export const clearAnalyticsIdentity = () => {
  const w = getWindow()
  if (!w) return
  try {
    w.localStorage?.removeItem(CLIENT_ID_KEY)
    w.sessionStorage?.removeItem(SESSION_ID_KEY)
    w.sessionStorage?.removeItem(SESSION_SOURCE_KEY)
  } catch {
    // Заблокированное хранилище: чистить нечего.
  }
}

export type AnalyticsContext = {
  client_id?: string
  session_id?: string
  auth_state: AnalyticsAuthState
  device: AnalyticsDevice
  /**
   * Имя `traffic_source`, а не `source`: `source` в проекте уже занят
   * поверхностью UI (`quest_card`, `home_promo`, `quest_finale`, `registration`
   * — см. `growthFunnelAnalytics` и `questRetentionAnalytics`). Под одним именем
   * два словаря дали бы в GA4 одно измерение, непригодное ни для того, ни для
   * другого разреза.
   */
  traffic_source?: AnalyticsTrafficSource
  platform: string
}

/** Единый блок измерений, который подмешивается в каждое событие воронки. */
export const getAnalyticsContext = (): AnalyticsContext => ({
  client_id: getAnalyticsClientId(),
  session_id: getAnalyticsSessionId(),
  auth_state: getAnalyticsAuthState(),
  device: getAnalyticsDevice(),
  traffic_source: getAnalyticsTrafficSource(),
  platform: Platform.OS,
})
