/**
 * #2269: единый список подсказок браузеру (`preconnect` / `dns-prefetch`) в
 * голове web-страницы и источники, ради которых они стоят.
 *
 * Подсказка допустима только на источник, с которого страница реально что-то
 * загружает: прежняя `preconnect` на `https://cdn.metravel.by` указывала на имя,
 * которого нет в DNS (NXDOMAIN), — лишний запрос к DNS на каждой странице и
 * ошибка соединения в консоли Safari. Собственный источник (`metravel.by`) в
 * подсказках не нужен: документ уже открыл к нему соединение, а все ресурсы
 * первого рендера — с него же (замер прода 06.10.2026: `/`, `/quests`,
 * `/travels/<slug>`).
 *
 * Счётчики аналитики грузятся из этих же констант (`utils/analyticsInlineScript.ts`,
 * `app/+html.tsx`), поэтому подсказка и загрузчик не расходятся; связь держит
 * `__tests__/app/html.resourceHints.test.ts`.
 */
export const ANALYTICS_ORIGINS = {
  metrika: 'https://mc.yandex.ru',
  gtag: 'https://www.googletagmanager.com',
} as const

export type WebResourceHint = {
  rel: 'preconnect' | 'dns-prefetch'
  href: string
  crossOrigin?: 'anonymous' | 'use-credentials'
}

/**
 * Счётчики стартуют только после согласия на аналитику и позже первого кадра,
 * поэтому для них — дешёвый `dns-prefetch`, а не `preconnect` с рукопожатием TLS.
 */
export const WEB_RESOURCE_HINTS: readonly WebResourceHint[] = [
  { rel: 'dns-prefetch', href: ANALYTICS_ORIGINS.metrika },
  { rel: 'dns-prefetch', href: ANALYTICS_ORIGINS.gtag },
]
