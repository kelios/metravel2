import { router } from 'expo-router'

import { openExternalUrl } from '@/utils/externalLinks'
import { resolveInternalTravelRoute } from '@/utils/relatedTravel'
import { getSafeExternalUrl } from '@/utils/safeExternalUrl'
import { getSiteBaseUrl } from '@/utils/seo'

/**
 * Единый обработчик `OPEN_URL` из WebView-карт приложения (`Map.ios`/`Map.android`
 * и `TravelMap.native`).
 *
 * Ссылки маркеров строит бэкенд от хоста API: на dev/local API это не metravel.by,
 * поэтому путь `/travel(s)/…` открывается экраном приложения при любом хосте.
 * Остальное идёт через `openExternalUrl`: ссылка на наш сайт с экраном приложения
 * тоже откроется внутри приложения, внешняя — в системном браузере (#2135: сайт в
 * Safari показывает cookie-баннер, App Review 5.1.2(i)).
 */
export async function openNativeMapLink(rawUrl: unknown): Promise<boolean> {
  const baseUrl = getSiteBaseUrl()
  const safeUrl = getSafeExternalUrl(typeof rawUrl === 'string' ? rawUrl : '', {
    allowRelative: true,
    baseUrl,
  })
  if (!safeUrl) return false

  const travelRoute = resolveInternalTravelRoute(safeUrl)
  if (travelRoute) {
    // Hash на native не работает и запрещён в router.push (NATIVE_COMPAT_RULES §9).
    const [route] = travelRoute.split('#')
    router.push(route as never)
    return true
  }

  return openExternalUrl(safeUrl, { allowRelative: true, baseUrl })
}
