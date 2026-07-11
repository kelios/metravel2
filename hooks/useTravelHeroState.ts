import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { useTdTrace } from '@/hooks/useTdTrace'
import { isIOSWebKit } from '@/components/ui/ImageCardMediaWebHelpers'
import type { Travel, TravelMediaImage } from '@/types/types'
import { findGalleryMediaImage } from '@/utils/travelMediaVariants'

type ImgLike = {
  url: string
  caption?: string
  width?: number
  height?: number
  updated_at?: string | null
  id?: number | string
  media?: TravelMediaImage | null
}
type GalleryImage = ImgLike & Record<string, unknown>

const HERO_HEIGHT = {
  desktopMin: 360,
  desktopMax: 750,
  mobileMin: 260,
  mobileViewportRatio: 0.56,
  mobileMaxHeight: 420,
  nativeMobileViewportRatio: 0.7,
  webMobileViewportRatio: 0.56,
  webMobileMaxHeight: 520,
  webViewportCapRatio: 0.7,
} as const

// Бэкстоп: если первый слайд под-оверлея не дёрнул onLoad (картинка уже в кэше
// браузера → <img onLoad> может не выстрелить), принудительно снимаем оверлей,
// иначе слайдер навсегда остаётся pointerEvents:none + opacity:0 (мёртвый свайп).
// Картинка слайда = та же, что LCP-оверлей (уже декодирована) → без вспышки.
const OVERLAY_FALLBACK_UNMOUNT_MS = 800
const WEB_HERO_LOAD_BACKSTOP_MS = 800

const normalizeGalleryImage = (
  item: unknown,
  fallbackId: number,
): GalleryImage =>
  typeof item === 'string'
    ? { url: item, id: fallbackId }
    : ({
        ...(item as Record<string, unknown>),
        id: (item as Record<string, unknown>).id || fallbackId,
      } as GalleryImage)

function useHeroMediaModel(
  travel: Travel,
  isMobile: boolean,
  onFirstImageLoad: () => void,
  allowSliderUpgrade: boolean,
) {
  const { height: winH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const tdTrace = useTdTrace()
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(
    null,
  )

  const galleryImages = useMemo(() => {
    const gallery = Array.isArray(travel.gallery) ? travel.gallery : []
    return gallery.map((item: unknown, index: number) => {
      const normalized = normalizeGalleryImage(item, index)
      return {
        ...normalized,
        media: findGalleryMediaImage(travel.media, normalized.id),
      }
    })
  }, [travel.gallery, travel.media])

  const heroSliderImages = useMemo(() => {
    return galleryImages
  }, [galleryImages])

  const firstImg = useMemo(() => {
    return heroSliderImages[0] ?? null
  }, [heroSliderImages]) as ImgLike | null

  const aspectRatio =
    (firstImg?.width && firstImg?.height
      ? firstImg.width / firstImg.height
      : undefined) || 16 / 9
  const heroHeight = useMemo(() => {
    if (Platform.OS === 'web') {
      if (isMobile) {
        return Math.max(
          HERO_HEIGHT.mobileMin,
          Math.min(
            Math.round(winH * HERO_HEIGHT.webMobileViewportRatio),
            HERO_HEIGHT.webMobileMaxHeight,
          ),
        )
      }
      return Math.round(winH * HERO_HEIGHT.webViewportCapRatio)
    }
    if (!isMobile) {
      return Math.round(winH * HERO_HEIGHT.webViewportCapRatio)
    }

    // Native mobile: слайдер занимает 70% ВИДИМОЙ высоты (между системными
    // барами). Под edge-to-edge winH включает status/navigation bar, поэтому
    // считаем от winH - insets, иначе 0.7*winH визуально выходит больше 70%.
    // Letterbox-поля у landscape-фото заполняет blur-подложка слайда
    // (OptimizedImage рендерит cover+blur копию на native), чёрных полос нет.
    const visibleH = Math.max(0, winH - insets.top - insets.bottom)
    return Math.max(
      HERO_HEIGHT.mobileMin,
      Math.round(visibleH * HERO_HEIGHT.nativeMobileViewportRatio),
    )
  }, [winH, insets.top, insets.bottom, isMobile])

  const heroAlt = travel?.name
    ? `Фотография маршрута «${travel.name}»`
    : 'Фото путешествия'

  const isJSDOM =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    String((navigator as unknown as Record<string, unknown>).userAgent || '')
      .toLowerCase()
      .includes('jsdom')
  const [webHeroLoaded, setWebHeroLoaded] = useState(
    Platform.OS !== 'web' || isJSDOM,
  )
  const [overlayUnmounted, setOverlayUnmounted] = useState(false)
  const [isOverlayFading, setIsOverlayFading] = useState(false)
  const [sliderImageReady, setSliderImageReady] = useState(false)
  const webHeroLoadNotifiedRef = useRef(false)
  const sliderLoadNotifiedRef = useRef(false)
  const lastTravelIdRef = useRef<number | string | null>(travel?.id ?? null)

  useEffect(() => {
    tdTrace('hero:mount', { travelId: travel?.id })
    return () => tdTrace('hero:unmount', { travelId: travel?.id })
  }, [tdTrace, travel?.id])
  useEffect(() => {
    if (firstImg?.url) tdTrace('hero:firstImgReady')
  }, [firstImg?.url, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const nextId = travel?.id ?? null
    const prevId = lastTravelIdRef.current
    if (prevId !== null && prevId !== nextId) {
      setWebHeroLoaded(false)
      setOverlayUnmounted(false)
      setIsOverlayFading(false)
      setSliderImageReady(false)
      webHeroLoadNotifiedRef.current = false
      sliderLoadNotifiedRef.current = false
      tdTrace('hero:swapReset')
    }
    lastTravelIdRef.current = nextId
  }, [travel?.id, tdTrace])

  useEffect(() => {
    if (!webHeroLoaded || Platform.OS !== 'web') return
    if (!allowSliderUpgrade) {
      setIsOverlayFading(false)
      setOverlayUnmounted(false)
      return
    }
    if (sliderImageReady) {
      setIsOverlayFading(false)
      setOverlayUnmounted(true)
      return
    }
    setIsOverlayFading(false)
    setOverlayUnmounted(false)
    return
  }, [allowSliderUpgrade, webHeroLoaded, sliderImageReady])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!webHeroLoaded || !allowSliderUpgrade) return
    if (sliderImageReady || overlayUnmounted) return
    const timer = setTimeout(() => {
      setSliderImageReady(true)
      tdTrace('hero:sliderImgLoad:fallback')
    }, OVERLAY_FALLBACK_UNMOUNT_MS)
    return () => clearTimeout(timer)
  }, [
    webHeroLoaded,
    allowSliderUpgrade,
    sliderImageReady,
    overlayUnmounted,
    tdTrace,
  ])

  useEffect(() => {
    if (Platform.OS === 'web' && webHeroLoaded) tdTrace('hero:webHeroLoaded')
  }, [webHeroLoaded, tdTrace])
  useEffect(() => {
    if (Platform.OS === 'web' && overlayUnmounted) tdTrace('hero:overlayHidden')
  }, [overlayUnmounted, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (webHeroLoaded || !firstImg?.url) return
    const shouldBackstopHeroLoad = isMobile || isIOSWebKit()
    if (!shouldBackstopHeroLoad) return

    const timer = setTimeout(() => {
      if (webHeroLoadNotifiedRef.current) return
      webHeroLoadNotifiedRef.current = true
      setWebHeroLoaded(true)
      tdTrace('hero:lcpImg:onLoad:backstop')
    }, WEB_HERO_LOAD_BACKSTOP_MS)

    return () => clearTimeout(timer)
  }, [firstImg?.url, isMobile, tdTrace, webHeroLoaded])

  const handleWebHeroLoad = useCallback(() => {
    if (webHeroLoadNotifiedRef.current) return
    webHeroLoadNotifiedRef.current = true
    if (Platform.OS === 'web') setWebHeroLoaded(true)
    tdTrace('hero:lcpImg:onLoad')
    onFirstImageLoad()
  }, [onFirstImageLoad, tdTrace])

  const handleSliderImageLoad = useCallback(() => {
    if (sliderLoadNotifiedRef.current) return
    sliderLoadNotifiedRef.current = true
    setSliderImageReady(true)
    tdTrace('hero:sliderImgLoaded')
  }, [tdTrace])

  return {
    firstImg,
    heroHeight,
    galleryImages,
    heroSliderImages,
    heroAlt,
    aspectRatio,
    heroContainerWidth,
    setHeroContainerWidth,
    webHeroLoaded,
    overlayUnmounted,
    isOverlayFading,
    handleWebHeroLoad,
    handleSliderImageLoad,
  }
}

function useDeferredHeroExtras(deferExtras: boolean) {
  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as unknown as Record<string, unknown>).webdriver)
  const [extrasReady, setExtrasReady] = useState(
    Platform.OS !== 'web' || (!deferExtras && isWebAutomation),
  )
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setExtrasReady(true)
      return
    }
    if (!deferExtras) {
      setExtrasReady(true)
      return
    }

    setExtrasReady(false)
  }, [deferExtras, isWebAutomation])

  return {
    extrasReady,
  }
}

function useWebHeroSliderUpgradeGate() {
  return true
}

export function useTravelHeroState(
  travel: Travel,
  isMobile: boolean,
  onFirstImageLoad: () => void,
  deferExtras: boolean,
) {
  const sliderUpgradeAllowed = useWebHeroSliderUpgradeGate()
  const media = useHeroMediaModel(
    travel,
    isMobile,
    onFirstImageLoad,
    sliderUpgradeAllowed,
  )
  const deferred = useDeferredHeroExtras(deferExtras)

  return {
    ...media,
    ...deferred,
    sliderUpgradeAllowed,
  }
}

export const __testables = {
  useWebHeroSliderUpgradeGate,
}
