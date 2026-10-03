import { openExternalUrl } from '@/utils/externalLinks'

/**
 * Контракт приватности WebView со сторонним веб-контентом (виджет партнёра,
 * видеоплеер): страница не хранит и не передаёт cookies (#2135, App Review
 * 5.1.2(i): cookies стороннего веб-контента в приложении Apple считает трекингом
 * без ATT).
 *
 * - `incognito`: iOS — `WKWebsiteDataStore.nonPersistentDataStore` (cookies,
 *   localStorage и кэш живут только в памяти этой WebView); Android — очистка
 *   `CookieManager` и отключённый кэш. Общий `CookieManager` Android делит с
 *   сетью React Native, но native-API cookies не использует: запросы идут с
 *   `credentials: 'omit'` и токеном (`utils/authPlatform.ts`).
 * - `sharedCookiesEnabled: false` (iOS): без общего с приложением
 *   `NSHTTPCookieStorage`.
 * - `thirdPartyCookiesEnabled: false` (Android): без сторонних cookies во
 *   встроенных iframe.
 *
 * Применяется спредом вместе с `createThirdPartyNavigationGuard` последними
 * атрибутами `<WebView … {...PROPS} {...guard} />`, чтобы ни один локальный
 * проп их не перекрыл. Покрытие всех WebView держит
 * `__tests__/config/nativeWebViewPrivacy.guard.test.ts`.
 */
export const THIRD_PARTY_WEBVIEW_PRIVACY_PROPS = Object.freeze({
  incognito: true,
  sharedCookiesEnabled: false,
  thirdPartyCookiesEnabled: false,
} as const)

/**
 * Срез события `onShouldStartLoadWithRequest` react-native-webview, нужный
 * guard'у. Локальный тип, а не импорт из библиотеки: модуль не тянет
 * `react-native-webview` и сам не становится её потребителем.
 *
 * iOS присылает все поля. Android — только `url`, и только для навигаций
 * верхнего уровня: http(s)/about-переходы во фреймах Chromium в колбэк не
 * отдаёт, а `navigationType`/`isTopFrame` в событии отсутствуют.
 */
export type ThirdPartyNavigationRequest = {
  url?: string | null
  navigationType?: string
  isTopFrame?: boolean
  hasTargetFrame?: boolean
}

export type ThirdPartyOpenWindowEvent = {
  nativeEvent?: { targetUrl?: string | null } | null
}

export type ThirdPartyNavigationDecision = 'allow' | 'external' | 'block'

export type ThirdPartyNavigationPolicy = {
  /** Исходный документ WebView: `source.uri` или `source.baseUrl` при `source.html`. */
  documentUrl: string
  /**
   * Документы фреймов, которые исходный документ встраивает сам (плеер YouTube:
   * `https://www.youtube.com/embed/<id>`). Совпадение — origin + path.
   */
  frameUrls?: readonly string[]
}

export type ThirdPartyNavigationGuard = Readonly<{
  onShouldStartLoadWithRequest: (request: ThirdPartyNavigationRequest) => boolean
  onOpenWindow: (event: ThirdPartyOpenWindowEvent) => void
  setSupportMultipleWindows: false
  javaScriptCanOpenWindowsAutomatically: false
}>

type ParsedDocumentUrl = { origin: string; path: string; query: string }

const DOCUMENT_URL = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(?:#.*)?$/i
const DEFAULT_PORT: Record<string, string> = { http: ':80', https: ':443' }
/** Пользовательская навигация в терминах WKNavigationType (iOS). */
const USER_NAVIGATION_TYPES: ReadonlySet<string> = new Set(['click', 'formsubmit', 'formresubmit'])

// Пустые документы без сети: iframe-заглушки и srcdoc. Своего origin у них нет,
// данных они не передают.
const isInertDocumentUrl = (url: string): boolean =>
  /^about:(?:blank|srcdoc)(?:[?#].*)?$/i.test(url) || /^data:/i.test(url)

// Строковый разбор без зависимости от URL-полифилла (тот же подход, что
// `utils/siteLinks.ts`): хост и схема — без регистра, порт по умолчанию и пустой
// путь нормализуются, фрагмент отбрасывается (переход по якорю — тот же документ).
const parseDocumentUrl = (url: string): ParsedDocumentUrl | null => {
  const match = DOCUMENT_URL.exec(url.trim())
  if (!match) return null
  const scheme = match[1].toLowerCase()
  const host = match[2].toLowerCase()
  const authority = host.endsWith(DEFAULT_PORT[scheme]) ? host.slice(0, -DEFAULT_PORT[scheme].length) : host
  if (!authority || authority.includes('@')) return null
  return {
    origin: `${scheme}://${authority}`,
    path: match[3] || '/',
    query: match[4] && match[4] !== '?' ? match[4] : '',
  }
}

const isSameOriginAndPath = (a: ParsedDocumentUrl, b: ParsedDocumentUrl | null): boolean =>
  b !== null && a.origin === b.origin && a.path === b.path

const isSameDocument = (a: ParsedDocumentUrl, b: ParsedDocumentUrl | null): boolean =>
  b !== null && isSameOriginAndPath(a, b) && a.query === b.query

/**
 * Решение по одной навигации стороннего WebView (#2135, App Review 5.1.2(i)).
 *
 * Внутри WebView грузится только исходный документ: он сам (первая загрузка,
 * reload, переход по якорю), пустые `about:blank`/`about:srcdoc`/`data:` и
 * объявленные фреймы. Любая другая навигация верхнего уровня — клик, другой
 * path или хост, `target=_blank` — уходит во внешний браузер: иначе страница
 * партнёра с его cookies и рекламными пикселями открылась бы внутри приложения.
 * Необъявленный фрейм без действия пользователя (например, iframe рекламного
 * тега) блокируется молча, клик во фрейме — во внешний браузер.
 */
export function decideThirdPartyNavigation(
  request: ThirdPartyNavigationRequest,
  policy: ThirdPartyNavigationPolicy,
): ThirdPartyNavigationDecision {
  const url = String(request.url ?? '').trim()
  if (!url) return 'block'
  if (isInertDocumentUrl(url)) return 'allow'

  const target = parseDocumentUrl(url)
  if (!target) return 'block'
  // Новое окно (`target=_blank`, `window.open`) — всегда уход из исходного документа.
  if (request.hasTargetFrame === false) return 'external'

  if (request.isTopFrame !== false) {
    return isSameDocument(target, parseDocumentUrl(policy.documentUrl)) ? 'allow' : 'external'
  }

  if (request.navigationType && USER_NAVIGATION_TYPES.has(request.navigationType)) return 'external'
  const frames = policy.frameUrls ?? []
  return frames.some((frameUrl) => isSameOriginAndPath(target, parseDocumentUrl(frameUrl))) ? 'allow' : 'block'
}

const openOutsideApp = (url: string): void => {
  void openExternalUrl(url, { allowedProtocols: ['https:'] })
}

/**
 * Навигационные props стороннего WebView: исходный документ остаётся в WebView,
 * всё остальное — через `openExternalUrl` во внешний браузер (`utils/externalLinks.ts`).
 *
 * - `onShouldStartLoadWithRequest`: решение `decideThirdPartyNavigation`.
 * - `onOpenWindow`: iOS отменяет `target=_blank`/`window.open` и отдаёт адрес сюда,
 *   а не грузит его в той же WebView (без обработчика RNW делает `loadRequest`).
 * - `setSupportMultipleWindows: false`: Android открывает новое окно в той же
 *   WebView, и переход проходит через `onShouldStartLoadWithRequest`.
 * - `javaScriptCanOpenWindowsAutomatically: false`: без окон по скрипту.
 *
 * Разрешённый `originWhitelist` библиотеки проверяется раньше guard'а; адреса вне
 * него RNW открывает сам, поэтому у сторонних WebView он не шире `https://*`.
 */
export function createThirdPartyNavigationGuard(policy: ThirdPartyNavigationPolicy): ThirdPartyNavigationGuard {
  const onShouldStartLoadWithRequest = (request: ThirdPartyNavigationRequest): boolean => {
    const decision = decideThirdPartyNavigation(request, policy)
    if (decision === 'external') openOutsideApp(String(request.url).trim())
    return decision === 'allow'
  }

  const onOpenWindow = (event: ThirdPartyOpenWindowEvent): void => {
    const targetUrl = String(event?.nativeEvent?.targetUrl ?? '').trim()
    if (decideThirdPartyNavigation({ url: targetUrl, hasTargetFrame: false }, policy) === 'external') {
      openOutsideApp(targetUrl)
    }
  }

  return Object.freeze({
    onShouldStartLoadWithRequest,
    onOpenWindow,
    setSupportMultipleWindows: false,
    javaScriptCanOpenWindowsAutomatically: false,
  } as const)
}
