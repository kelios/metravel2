import { Platform } from 'react-native'

import { openExternalUrl } from '@/utils/externalLinks'
import { getSiteBaseUrl } from '@/utils/seo'
import { resolveSitePath } from '@/utils/siteLinks'

/**
 * Ведёт ли ссылка на наш сайт (относительный путь или абсолютный URL на
 * metravel.by): путь (pathname+search+hash) или `null`. Это ТОЛЬКО проверка
 * хоста — для web (навигация в той же вкладке). Есть ли у пути экран
 * приложения, здесь не проверяется: на native решение принимает
 * `openExternalUrl` через `resolveAppRouteForSiteUrl` (#2144).
 */
export function resolveInternalHref(href?: string | null): string | null {
  return resolveSitePath(href)
}

/**
 * Единый обработчик клика по ссылке в rich-тексте (статьи, путешествия, план
 * поездки).
 *
 * - web: ссылка на свой сайт — навигация в той же вкладке, внешняя — новая
 *   вкладка через `openExternalUrl`;
 * - native: ссылка на свой сайт и внешняя http(s) уходят в `openExternalUrl` —
 *   единственную точку решения: путь с экраном приложения открывается экраном
 *   (якорь отброшен, NATIVE_COMPAT_RULES §9), путь без экрана (`/media/…`,
 *   `/api/…`, `/board`) и чужой хост — в системном браузере (#2135, #2144).
 *   Якорь `#id` и спецсхемы (`mailto:` и т.п.) ничего не открывают.
 */
export function handleRichTextLinkPress(href?: string | null): void {
  if (!href) return
  const sitePath = resolveSitePath(href)
  if (sitePath && Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(sitePath)
    return
  }
  // Абсолютный http(s) уходит как есть (хост ссылки сохраняется и на сборке с
  // локальным EXPO_PUBLIC_SITE_URL); путь сайта — только для относительных и
  // `about:///…` ссылок, его дополняет `baseUrl`.
  const trimmed = href.trim()
  const isAbsoluteHttp = /^https?:\/\//i.test(trimmed)
  if (!sitePath && !isAbsoluteHttp) return
  const target = isAbsoluteHttp ? trimmed : (sitePath as string)
  void openExternalUrl(target, {
    allowRelative: true,
    baseUrl: getSiteBaseUrl(),
    onError: (error) => {
      if (__DEV__) {
        console.warn('[richtext] Не удалось открыть URL:', error)
      }
    },
  })
}
