import { useCallback, useMemo } from 'react'
import { Animated, DeviceEventEmitter, Platform } from 'react-native'

import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'
import { useContentScrollAnalytics } from '@/hooks/useContentScrollAnalytics'
import {
  getTravelDetailsChromeReadyState,
  getTravelDetailsHeadKey,
  getTravelDetailsScrollViewStyle,
  getTravelDetailsSeoViewModel,
  getTravelDetailsWrapperStyle,
} from '@/components/travel/details/hooks/travelDetailsContainerViewModel'

type UseTravelDetailsContainerViewModelArgs = {
  closeMenu: () => void
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

export function useTravelDetailsContainerViewModel({
  closeMenu,
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

  const headKey = useMemo(
    () => getTravelDetailsHeadKey(slug, travel?.id),
    [slug, travel?.id]
  )

  const seo = useMemo(() => {
    return getTravelDetailsSeoViewModel(travel, slug)
  }, [travel, slug])

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
        { useNativeDriver: false, listener: trackScrollDepth }
      ),
    [scrollY, trackScrollDepth]
  )

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
