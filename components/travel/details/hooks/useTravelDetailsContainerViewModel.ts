import { useCallback, useMemo } from 'react'
import { Animated, DeviceEventEmitter, Platform } from 'react-native'

import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'
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
      // Lazy sections (map/points/excursions) may not be mounted when the sticky
      // sub-nav is tapped. On native a one-shot scrollTo silently no-ops because
      // the anchor ref is still null. Emitting `open-section` forces the section
      // to mount and triggers the mount-aware scroll retry (web already retries
      // via DOM lookup, so it's left untouched).
      if (Platform.OS !== 'web') {
        DeviceEventEmitter.emit('open-section', key)
      }
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
