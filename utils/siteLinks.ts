import { getSiteBaseUrl } from '@/utils/seo'

/**
 * Ссылки на собственный сайт и экраны приложения — один источник для двух решений:
 *
 * - `resolveSitePath`: ведёт ли ссылка на наш сайт (относительный путь или
 *   абсолютный URL на хост сайта) и какой у неё путь;
 * - `resolveAppRouteForSiteUrl`: есть ли у этого пути экран приложения
 *   (expo-router). На native такая ссылка открывается внутри приложения, а не в
 *   системном браузере, где сайт показывает cookie-баннер: App Review считает
 *   cookie-запросы веб-контента трекингом без ATT (отказ 5.1.2(i), #2135).
 *
 * Парсинг строковый, без зависимости от URL-полифилла.
 */

const CANONICAL_SITE_HOST = 'metravel.by'

const buildSiteHosts = (): ReadonlySet<string> => {
  const match = /^https?:\/\/([^/?#]+)/i.exec(getSiteBaseUrl())
  const configuredHost = (match?.[1] || CANONICAL_SITE_HOST).toLowerCase()
  const hosts = new Set<string>()
  // Канонический хост держим всегда: на dev-сборке EXPO_PUBLIC_SITE_URL указывает
  // на локальный адрес, а контент (статьи, точки) ссылается на metravel.by.
  for (const host of [configuredHost, CANONICAL_SITE_HOST]) {
    const bareHost = host.replace(/^www\./, '')
    hosts.add(bareHost)
    hosts.add(`www.${bareHost}`)
  }
  return hosts
}

const SITE_HOSTS = buildSiteHosts()

/**
 * Если ссылка ведёт на наш сайт (относительный путь или абсолютный URL на
 * metravel.by), возвращает путь (pathname+search+hash). Иначе — `null`.
 */
export function resolveSitePath(href?: string | null): string | null {
  if (!href) return null
  let trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  // react-native-render-html нормализует относительные href как `about:///path`
  // (нет baseUrl) — разворачиваем обратно в относительный путь
  const aboutMatch = /^about:\/\/(\/.*)$/i.exec(trimmed)
  if (aboutMatch) trimmed = aboutMatch[1]
  // спец-схемы (почта/телефон/и т.п.) — это не навигация по сайту
  if (/^(mailto:|tel:|sms:|geo:|tg:|whatsapp:|javascript:|data:)/i.test(trimmed)) return null

  // относительная ссылка на свой сайт (но не protocol-relative `//host`)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed

  const match = /^https?:\/\/([^/?#]+)(.*)$/i.exec(trimmed)
  if (!match) return null
  const host = match[1].toLowerCase()
  if (!SITE_HOSTS.has(host)) return null
  const rest = match[2] || '/'
  return rest.startsWith('/') ? rest : `/${rest}`
}

/**
 * Корневые сегменты экранов `app/` (expo-router), у которых есть index-экран.
 * Пустая строка — главная. Синхронность с файловой системой проверяет
 * `__tests__/utils/siteLinks.test.ts`: экран без записи здесь открывался бы с
 * native в системном браузере, а удалённый — в +not-found.
 */
export const APP_ROUTE_ROOTS: ReadonlySet<string> = new Set([
  '',
  'about',
  'accountconfirmation',
  'app',
  'articles',
  'calendar',
  'community-rules',
  'contact',
  'cookies',
  'disclaimer',
  'error',
  'export',
  'favorites',
  'history',
  'login',
  'map',
  'messages',
  'metravel',
  'offline',
  'places',
  'privacy',
  'privacy-settings',
  'profile',
  'quests',
  'register',
  'registration',
  'roulette',
  'search',
  'security-journal',
  'set-password',
  'settings',
  'subscriptions',
  'terms',
  'travelsby',
  'trip-rules',
  'trips',
  'userpoints',
])

/** Каталоги `app/` без index-экрана: экран есть только у вложенного пути `/<root>/<…>`. */
export const APP_PARAM_ROUTE_ROOTS: ReadonlySet<string> = new Set([
  'article',
  'subscribe',
  'travel',
  'travels',
  'user',
])

/** Есть ли у пути сайта экран приложения. `/api/…`, `/media/…`, `/board` — нет. */
export function isAppRoutePath(path: string): boolean {
  const pathname = String(path || '').split(/[?#]/)[0]
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return APP_ROUTE_ROOTS.has('')
  const [root] = segments
  if (APP_ROUTE_ROOTS.has(root)) return true
  return APP_PARAM_ROUTE_ROOTS.has(root) && segments.length >= 2
}

/**
 * Маршрут приложения для ссылки на наш сайт или `null`. Hash отбрасывается:
 * на native якорь не работает и запрещён в `router.push`
 * (`docs/NATIVE_COMPAT_RULES.md` §9) — экран открывается с начала.
 */
export function resolveAppRouteForSiteUrl(href?: string | null): string | null {
  const sitePath = resolveSitePath(href)
  if (!sitePath || !isAppRoutePath(sitePath)) return null
  const [withoutHash] = sitePath.split('#')
  return withoutHash || '/'
}
