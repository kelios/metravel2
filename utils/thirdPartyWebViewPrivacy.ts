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
 * Применяется спредом последним атрибутом `<WebView … {...PROPS} />`, чтобы ни
 * один локальный проп его не перекрыл. Покрытие всех WebView держит
 * `__tests__/config/nativeWebViewPrivacy.guard.test.ts`.
 */
export const THIRD_PARTY_WEBVIEW_PRIVACY_PROPS = Object.freeze({
  incognito: true,
  sharedCookiesEnabled: false,
  thirdPartyCookiesEnabled: false,
} as const)
