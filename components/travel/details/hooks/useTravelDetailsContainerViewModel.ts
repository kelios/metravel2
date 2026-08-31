import { useCallback, useEffect, useMemo, useState } from 'react'
import { Animated, DeviceEventEmitter, Platform } from 'react-native'

import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'
import { useContentScrollAnalytics } from '@/hooks/useContentScrollAnalytics'
import { rIC } from '@/utils/rIC'
import {
  getTravelDetailsChromeReadyState,
  getTravelDetailsHeadKey,
  getTravelDetailsScrollViewStyle,
  getTravelDetailsSeoViewModel,
  getTravelDetailsWrapperStyle,
} from '@/components/travel/details/hooks/travelDetailsContainerViewModel'

type UseTravelDetailsContainerViewModelArgs = {
  closeMenu: () => void
  deferSeoOnWeb: boolean
  forceOpenKey: string | null
  isMobile: boolean
  isWebAutomation: boolean
  lcpLoaded: boolean
  navigationSetOptions: (options: { title: string }) => void
  openSection: (key: string) => void
  postLcpRuntimeReady: boolean
  scrollTo: (key: string) => void
  scrollY: Animated.Value
  setActiveSection: (key: string) => void
  setLcpLoaded: (value: boolean) => void
  slug: string
  styles: any
  themedBackground: string
  themedBackgroundSecondary: string
  themedBorderLight: string
  themedBrandSoft: string
  themedPrimarySoft: string
  travel: any
}

type TravelDetailsSeoViewModel = ReturnType<typeof getTravelDetailsSeoViewModel>

const EMPTY_WEB_SEO_VIEW_MODEL: TravelDetailsSeoViewModel = Object.freeze({
  canonicalUrl: undefined,
  jsonLd: null,
  readyDesc: null,
  readyImage: '',
  readyTitle: null,
})

type DeferredWebSeoState = {
  slug: string
  travel: any
  value: TravelDetailsSeoViewModel
}

/**
 * Direct travel loads already have complete title/meta/JSON-LD in the SSG HTML.
 * Rebuilding the same data during the synchronous hydration render scanned a
 * 50-KB article body twice and added ~40 ms to the blocking React task (#1643).
 *
 * Keep native and SPA navigation synchronous (there is no matching SSG head to
 * preserve there). Only an initial web article with a matching inline preload
 * leaves the existing SSG head untouched for the first commit and rebuilds the
 * runtime head in a separate idle task. The input identity guard prevents a
 * previous article's deferred result from leaking across a slug change.
 */
export function useTravelDetailsSeoViewModel(
  travel: any,
  slug: string,
  deferSeoOnWeb: boolean,
): TravelDetailsSeoViewModel {
  const immediateValue = useMemo(
    () => Platform.OS === 'web' && deferSeoOnWeb
      ? EMPTY_WEB_SEO_VIEW_MODEL
      : getTravelDetailsSeoViewModel(travel, slug),
    [deferSeoOnWeb, travel, slug],
  )
  const [webState, setWebState] = useState<DeferredWebSeoState | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web' || !deferSeoOnWeb || !travel) return undefined

    return rIC(() => {
      setWebState({
        slug,
        travel,
        value: getTravelDetailsSeoViewModel(travel, slug),
      })
    }, 200)
  }, [deferSeoOnWeb, travel, slug])

  if (Platform.OS !== 'web' || !deferSeoOnWeb) return immediateValue
  if (!webState || webState.travel !== travel || webState.slug !== slug) {
    return EMPTY_WEB_SEO_VIEW_MODEL
  }
  return webState.value
}

export function useTravelDetailsContainerViewModel({
  closeMenu,
  deferSeoOnWeb,
  forceOpenKey,
  isMobile,
  isWebAutomation,
  lcpLoaded,
  navigationSetOptions,
  openSection,
  postLcpRuntimeReady,
  scrollTo,
  scrollY,
  setActiveSection,
  setLcpLoaded,
  slug,
  styles,
  themedBackground,
  themedBackgroundSecondary,
  themedBorderLight,
  themedBrandSoft,
  themedPrimarySoft,
  travel,
}: UseTravelDetailsContainerViewModelArgs) {
  const sectionLinks = useMemo(() => buildTravelSectionLinks(travel), [travel])
  const trackScrollDepth = useContentScrollAnalytics({
    source: 'travel_detail',
    contentType: 'travel',
    contentId: travel?.id ?? slug,
  })
  const [nativeSettledScrollOffsetY, setNativeSettledScrollOffsetY] = useState(0)

  const headKey = useMemo(
    () => getTravelDetailsHeadKey(slug, travel?.id),
    [slug, travel?.id]
  )

  const seo = useTravelDetailsSeoViewModel(travel, slug, deferSeoOnWeb)

  const { criticalChromeReady, deferredChromeReady } = getTravelDetailsChromeReadyState({
    forceOpenKey,
    isWebAutomation,
    lcpLoaded,
    postLcpRuntimeReady,
  })

  const scrollToWithMenuClose = useCallback(
    (key: string) => {
      setActiveSection(key)
      openSection(key)
      // Lazy sections (map/points/excursions/near/popular/comments) may not be
      // mounted yet when the sticky sub-nav is tapped. A one-shot scrollTo then
      // silently no-ops — on native the anchor ref is still null, on web the
      // `[data-section-key]` element does not exist for the retry DOM lookup to
      // find. Emitting `open-section` forces the section to mount (forceOpenKey)
      // so the mount-aware scroll retry can land on it.
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('open-section', { detail: { key } }))
        }
      } else {
        DeviceEventEmitter.emit('open-section', key)
      }
      scrollTo(key)
      if (isMobile) closeMenu()
    },
    [scrollTo, isMobile, closeMenu, openSection, setActiveSection]
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
        {
          useNativeDriver: Platform.OS !== 'web',
          // Web has no native animation driver, so keep its existing throttled
          // analytics listener. Native reports depth only when a gesture settles
          // (returned separately below) instead of crossing JS on every frame.
          ...(Platform.OS === 'web' ? { listener: trackScrollDepth } : {}),
        }
      ),
    [scrollY, trackScrollDepth]
  )

  const nativeScrollDepthHandler = useCallback((event: any) => {
    if (Platform.OS === 'web') return
    const offsetY = event?.nativeEvent?.contentOffset?.y
    if (Number.isFinite(offsetY)) {
      setNativeSettledScrollOffsetY((current) => current === offsetY ? current : offsetY)
    }
    trackScrollDepth(event)
  }, [trackScrollDepth])

  const wrapperStyle = useMemo(
    () =>
      getTravelDetailsWrapperStyle({
        styles,
        themedBackground,
        themedBackgroundSecondary,
        themedBorderLight,
        themedBrandSoft,
        themedPrimarySoft,
      }),
    [
      styles,
      themedBackground,
      themedBackgroundSecondary,
      themedBorderLight,
      themedBrandSoft,
      themedPrimarySoft,
    ]
  )

  const scrollViewStyle = useMemo(
    () => getTravelDetailsScrollViewStyle(styles, isMobile),
    [styles, isMobile]
  )

  return {
    criticalChromeReady,
    deferredChromeReady,
    handleFirstImageLoad,
    headKey,
    scrollEventHandler,
    nativeScrollDepthHandler: Platform.OS === 'web' ? undefined : nativeScrollDepthHandler,
    nativeSettledScrollOffsetY,
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
