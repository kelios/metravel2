import { Platform } from 'react-native'
import { DEFAULT_OG_IMAGE_PATH, buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo'
import {
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
  const title = displayTitle
    ? buildTravelSeoTitle(displayTitle)
    : 'Путешествие | Metravel'
  const desc = getTravelSeoDescription(travel?.description)
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
  return [
    params.styles.wrapper,
    { backgroundColor: params.themedBackground },
    Platform.OS === 'web' &&
      ({
        backgroundImage: [
          `radial-gradient(circle at 16% 10%, ${params.themedPrimarySoft} 0, transparent 26%)`,
          `radial-gradient(circle at 86% 18%, ${params.themedBrandSoft} 0, transparent 22%)`,
          `linear-gradient(90deg, ${params.themedBrandSoft} 0, ${params.themedBrandSoft} 1px, transparent 1px)`,
          `repeating-linear-gradient(0deg, transparent 0, transparent 35px, ${params.themedBorderLight} 36px)`,
          `linear-gradient(180deg, ${params.themedBackground} 0%, ${params.themedBackgroundSecondary} 100%)`,
        ].join(', '),
        backgroundPosition: '0 0, 0 0, 48px 0, 0 0, 0 0',
        backgroundSize: 'auto, auto, 100% 100%, 100% 36px, auto',
        backgroundAttachment: 'fixed',
      } as any),
  ]
}

export function getTravelDetailsScrollViewStyle(styles: any, isMobile: boolean) {
  return [styles.scrollView, isMobile && { width: '100%' as any }]
}
