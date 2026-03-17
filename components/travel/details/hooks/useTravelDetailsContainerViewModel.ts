import { useCallback, useMemo } from 'react'
import { Animated, Platform } from 'react-native'

import { DEFAULT_OG_IMAGE_PATH, buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo'
import { createTravelArticleJsonLd, stripHtmlForSeo } from '@/utils/travelSeo'
import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'

const SEO_TITLE_MAX_LENGTH = 60
const SEO_TITLE_SUFFIX = ' | Metravel'

const stripToDescription = (html?: string) => stripHtmlForSeo(html).slice(0, 160)

const buildSeoTitle = (base: string): string => {
  const normalized = String(base || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return 'Metravel'

  const maxBaseLength = Math.max(10, SEO_TITLE_MAX_LENGTH - SEO_TITLE_SUFFIX.length)
  const clippedBase =
    normalized.length > maxBaseLength
      ? `${normalized.slice(0, maxBaseLength - 1).trimEnd()}…`
      : normalized

  return `${clippedBase}${SEO_TITLE_SUFFIX}`
}

type UseTravelDetailsContainerViewModelArgs = {
  closeMenu: () => void
  forceOpenKey: string | null
  isMobile: boolean
  isWebAutomation: boolean
  lcpLoaded: boolean
  navigationSetOptions: (options: { title: string }) => void
  postLcpRuntimeReady: boolean
  scrollTo: (key: string) => void
  scrollY: Animated.Value
  setActiveSection: (key: string) => void
  setLcpLoaded: (value: boolean) => void
  slug: string
  styles: any
  themedBackground: string
  themedBackgroundSecondary: string
  travel: any
}

export function useTravelDetailsContainerViewModel({
  closeMenu,
  forceOpenKey,
  isMobile,
  isWebAutomation,
  lcpLoaded,
  navigationSetOptions,
  postLcpRuntimeReady,
  scrollTo,
  scrollY,
  setActiveSection,
  setLcpLoaded,
  slug,
  styles,
  themedBackground,
  themedBackgroundSecondary,
  travel,
}: UseTravelDetailsContainerViewModelArgs) {
  const sectionLinks = useMemo(() => buildTravelSectionLinks(travel), [travel])

  const headKey = useMemo(
    () => `travel-${slug ?? travel?.id ?? 'unknown'}`,
    [slug, travel?.id]
  )

  const seo = useMemo(() => {
    const title = travel?.name
      ? buildSeoTitle(travel.name)
      : 'Загрузка... | Metravel'
    const desc = stripToDescription(travel?.description) || 'Путешествие на Metravel.'
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
    const structuredData = createTravelArticleJsonLd(travel)

    return {
      readyTitle: title,
      readyDesc: desc,
      canonicalUrl: canonical,
      readyImage: absImage,
      jsonLd: structuredData,
    }
  }, [travel, slug])

  const forceDeferMount = !!forceOpenKey
  const criticalChromeReady =
    Platform.OS !== 'web' || lcpLoaded || forceDeferMount || isWebAutomation
  const deferredChromeReady =
    postLcpRuntimeReady || forceDeferMount || isWebAutomation

  const scrollToWithMenuClose = useCallback(
    (key: string) => {
      setActiveSection(key)
      scrollTo(key)
      if (isMobile) closeMenu()
    },
    [scrollTo, isMobile, closeMenu, setActiveSection]
  )

  const scrollToMapSection = useCallback(() => {
    scrollToWithMenuClose('map')
  }, [scrollToWithMenuClose])

  const scrollToComments = useCallback(() => {
    scrollToWithMenuClose('comments')
  }, [scrollToWithMenuClose])

  const handleFirstImageLoad = useCallback(() => {
    setLcpLoaded(true)
  }, [setLcpLoaded])

  const syncNavigationTitle = useCallback(
    (readyTitle: string) => {
      navigationSetOptions({ title: readyTitle })
    },
    [navigationSetOptions]
  )

  const scrollEventHandler = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      ),
    [scrollY]
  )

  const wrapperStyle = useMemo(
    () => [
      styles.wrapper,
      { backgroundColor: themedBackground },
      Platform.OS === 'web' &&
        ({
          backgroundImage: `linear-gradient(180deg, ${themedBackground} 0%, ${themedBackgroundSecondary} 100%)`,
        } as any),
    ],
    [styles.wrapper, themedBackground, themedBackgroundSecondary]
  )

  const scrollViewStyle = useMemo(
    () => [styles.scrollView, isMobile && { width: '100%' as any }],
    [styles.scrollView, isMobile]
  )

  return {
    criticalChromeReady,
    deferredChromeReady,
    handleFirstImageLoad,
    headKey,
    scrollEventHandler,
    scrollToComments,
    scrollToMapSection,
    scrollToWithMenuClose,
    scrollViewStyle,
    sectionLinks,
    seo,
    syncNavigationTitle,
    wrapperStyle,
  }
}
