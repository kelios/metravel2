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
  const title = travel?.name
    ? buildTravelSeoTitle(travel.name)
    : slug
      ? buildTravelSeoTitle(slug.replace(/-/g, ' '))
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
}) {
  return [
    params.styles.wrapper,
    { backgroundColor: params.themedBackground },
    Platform.OS === 'web' &&
      ({
        backgroundImage: `linear-gradient(180deg, ${params.themedBackground} 0%, ${params.themedBackgroundSecondary} 100%)`,
      } as any),
  ]
}

export function getTravelDetailsScrollViewStyle(styles: any, isMobile: boolean) {
  return [styles.scrollView, isMobile && { width: '100%' as any }]
}
