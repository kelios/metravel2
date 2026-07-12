import { Platform } from 'react-native'
import { DEFAULT_OG_IMAGE_PATH, buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo'
import {
  buildTravelSeoFallbackDescription,
  buildTravelSeoTitle,
  createTravelStructuredData,
  getTravelSeoDescription,
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
  const desc =
    typeof travel?.description === 'string' && travel.description.trim()
      ? getTravelSeoDescription(travel.description)
      : displayTitle
        ? buildTravelSeoFallbackDescription(displayTitle)
        : null
  const canonical =
    typeof travel?.slug === 'string' && travel.slug
      ? buildCanonicalUrl(`/travels/${travel.slug}`)
      : typeof travel?.id === 'number'
        ? buildCanonicalUrl(`/travels/${travel.id}`)
        : slug
          ? buildCanonicalUrl(`/travels/${slug}`)
          : undefined
  const rawFirst = travel?.gallery?.[0] || travel?.travel_image_thumb_url
  const firstUrl = rawFirst
    ? typeof rawFirst === 'string'
      ? rawFirst
      : rawFirst.url
    : undefined
  const absImage = firstUrl
    ? firstUrl.startsWith('http')
      ? firstUrl.replace(/^http:\/\//, 'https://')
      : buildOgImageUrl(firstUrl)
    : buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)

  return {
    canonicalUrl: canonical,
    jsonLd: createTravelStructuredData(travel),
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
