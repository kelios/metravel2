import { Platform } from 'react-native'
import { DEFAULT_OG_IMAGE_PATH, buildCanonicalUrl, getSiteBaseUrl, normalizeOgImageUrl } from '@/utils/seo'
import { buildTravelSeoDescription } from '@/utils/travelSeoDescription'
import { pickTravelSeoImage } from '@/utils/travelSeoImage'

import {
  buildIndexableTravelPath,
  buildTravelSeoTitle,
  createTravelStructuredData,
} from '@/utils/travelSeo'

export function getTravelDetailsHeadKey(slug: string, travelId?: number | string | null) {
  return `travel-${slug ?? travelId ?? 'unknown'}`
}

export function getTravelDetailsSeoViewModel(travel: any, slug: string) {
  const displayTitle =
    typeof travel?.name === 'string' && travel.name.trim()
      ? travel.name
      : typeof travel?.title === 'string' && travel.title.trim()
        ? travel.title
        : null
  // Пока данные статьи не загружены — title/description не трогаем (null):
  // слаг-фолбэк («Marshrut oden usadba…») затирал корректный SSG-<title>,
  // и Метрика/GA4 успевали снять hit с транслитом (см. Метрика 12.07.2026).
  // Анти-generic фолбэк для не-пререндеренных страниц живёт в app/+html.tsx.
  const title = displayTitle ? buildTravelSeoTitle(displayTitle) : null
  const desc = displayTitle || travel?.description
    ? buildTravelSeoDescription({ ...travel, name: displayTitle }, travel?.description, travel?.meta_description)
    : null
  // #1438: ветки проверяли только `typeof slug === 'string' && slug`, поэтому
  // литерал `'null'` (его давал нормализатор из `slug: null`) считался живым
  // слагом, и страница отдавала canonical/og:url `https://metravel.by/travels/null`.
  // Краулер Meta ходит по og:url — в прод-логе это 404 с referer здоровой статьи.
  //
  // Источники адреса: слаг статьи, затем адрес, по которому страница реально
  // открыта. Числовая форма сюда не входит намеренно — прямой заход на
  // `/travels/<id>` прод отдаёт пустым 404 (#1512), и публиковать её значит
  // повторять тот же дефект. Нет пригодного слага — canonical не выводится вовсе.
  const canonicalPath =
    buildIndexableTravelPath(travel?.slug) ?? buildIndexableTravelPath(slug)
  const canonical = canonicalPath ? buildCanonicalUrl(canonicalPath) : undefined
  const firstUrl = pickTravelSeoImage(travel, travel, {
    siteUrl: getSiteBaseUrl(), fallbackImage: DEFAULT_OG_IMAGE_PATH,
  })
  // #1221: своя нормализация здесь делала ровно половину работы — поднимала до https,
  // но оставляла ownership-URL без `?w=`, и рантайм-патч головы (`useTravelDetailsHeadSync`)
  // перебивал шириной снабжённый SSG-тег «голым» адресом, то есть мастером с `no-store`.
  // Общая `normalizeOgImageUrl` делает и абсолютный https, и ступень производной.
  const absImage =
    normalizeOgImageUrl(firstUrl) ?? (normalizeOgImageUrl(DEFAULT_OG_IMAGE_PATH) as string)

  return {
    canonicalUrl: canonical,
    // Голова и структурированные данные обязаны объявлять один адрес.
    jsonLd: createTravelStructuredData(travel, { canonicalUrl: canonical }),
    readyDesc: desc,
    readyImage: absImage,
    readyTitle: title,
  }
}

export function getTravelDetailsChromeReadyState(params: {
  forceOpenKey: string | null
  isWebAutomation: boolean
  lcpLoaded: boolean
  postLcpRuntimeReady: boolean
}) {
  const forceDeferMount = !!params.forceOpenKey

  return {
    criticalChromeReady:
      Platform.OS !== 'web' || params.lcpLoaded || forceDeferMount || params.isWebAutomation,
    deferredChromeReady:
      params.postLcpRuntimeReady || forceDeferMount || params.isWebAutomation,
  }
}

export function getTravelDetailsWrapperStyle(params: {
  styles: any
  themedBackground: string
  themedBackgroundSecondary: string
  themedBorderLight: string
  themedBrandSoft: string
  themedPrimarySoft: string
}) {
  return [params.styles.wrapper, { backgroundColor: params.themedBackground }]
}

export function getTravelDetailsScrollViewStyle(styles: any, isMobile: boolean) {
  return [styles.scrollView, isMobile && { width: '100%' as any }]
}
