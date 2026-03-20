import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { useTdTrace } from '@/hooks/useTdTrace'
import type { Travel } from '@/types/types'

type ImgLike = {
  url: string
  width?: number
  height?: number
  updated_at?: string | null
  id?: number | string
}
type GalleryImage = ImgLike & Record<string, unknown>

const HERO_HEIGHT = {
  desktopMin: 360,
  desktopMax: 750,
  mobileMin: 280,
  mobileViewportRatio: 0.7,
  mobileMaxViewportRatio: 0.85,
  webViewportCapRatio: 0.7,
} as const

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
  const { width: winW, height: winH } = useWindowDimensions()
  const tdTrace = useTdTrace()
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(
    null,
  )

  const firstRaw = travel?.gallery?.[0]
  const firstImg = useMemo(() => {
    if (!firstRaw) return null
    if (typeof firstRaw === 'string') return { url: firstRaw }
    return firstRaw
  }, [firstRaw]) as ImgLike | null

  const aspectRatio =
    (firstImg?.width && firstImg?.height
      ? firstImg.width / firstImg.height
      : undefined) || 16 / 9
  const resolvedWidth = heroContainerWidth ?? winW
  const heroHeight = useMemo(() => {
    if (Platform.OS === 'web') {
      return Math.round(winH * HERO_HEIGHT.webViewportCapRatio)
    }
    const minViewportHeight = Math.round(winH * HERO_HEIGHT.mobileViewportRatio)
    const arHeight = resolvedWidth
      ? Math.round(resolvedWidth / aspectRatio)
      : winH * 0.6
    const boundedAspectHeight = Math.max(
      HERO_HEIGHT.mobileMin,
      Math.min(arHeight, Math.round(winH * HERO_HEIGHT.mobileMaxViewportRatio)),
    )
    return Math.max(minViewportHeight, boundedAspectHeight)
  }, [winH, resolvedWidth, aspectRatio])

  const galleryImages = useMemo(() => {
    const gallery = Array.isArray(travel.gallery) ? travel.gallery : []
    return gallery.map((item: unknown, index: number) =>
      normalizeGalleryImage(item, index),
    )
  }, [travel.gallery])

  const heroSliderImages = useMemo(() => {
    return galleryImages
  }, [galleryImages])

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
    if (Platform.OS === 'web' && webHeroLoaded) tdTrace('hero:webHeroLoaded')
  }, [webHeroLoaded, tdTrace])
  useEffect(() => {
    if (Platform.OS === 'web' && overlayUnmounted) tdTrace('hero:overlayHidden')
  }, [overlayUnmounted, tdTrace])

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
