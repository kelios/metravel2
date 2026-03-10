import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform } from 'react-native'

import { useResponsive } from '@/hooks/useResponsive'
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
  renderSlider: boolean,
) {
  const { width: winW, height: winH } = useResponsive()
  const tdTrace = useTdTrace()
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(
    null,
  )

  const firstRaw = travel?.travel_image_thumb_url || travel?.gallery?.[0]
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
    if (Platform.OS === 'web' && !isMobile) {
      const target = winH * HERO_HEIGHT.mobileViewportRatio
      return Math.max(
        HERO_HEIGHT.desktopMin,
        Math.min(target, HERO_HEIGHT.desktopMax),
      )
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
  }, [isMobile, winH, resolvedWidth, aspectRatio])

  const galleryImages = useMemo(() => {
    const gallery = Array.isArray(travel.gallery) ? travel.gallery : []
    const mapped = gallery.map((item: unknown, index: number) =>
      normalizeGalleryImage(item, index),
    )
    const coverUrl =
      typeof travel.travel_image_thumb_url === 'string'
        ? travel.travel_image_thumb_url.trim()
        : ''

    if (!coverUrl) return mapped
    if (mapped.length === 0) return [{ url: coverUrl, id: 0 }]

    const normalizedCover = coverUrl.replace(/[?#].*$/, '')
    const hasSameAsCover = mapped.some((item) => {
      const raw = typeof item?.url === 'string' ? item.url.trim() : ''
      return raw.replace(/[?#].*$/, '') === normalizedCover
    })

    if (hasSameAsCover) return mapped
    return [{ url: coverUrl, id: `cover-${travel.id}` }, ...mapped]
  }, [travel.gallery, travel.travel_image_thumb_url, travel.id])

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
  const notifyHeroReadyInEffect = useEffectEvent((traceEvent: string) => {
    tdTrace(traceEvent)
    onFirstImageLoad()
  })

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
    if (Platform.OS !== 'web' || webHeroLoaded || !firstImg) return
    const fallback = setTimeout(() => {
      if (!webHeroLoadNotifiedRef.current) {
        webHeroLoadNotifiedRef.current = true
        setWebHeroLoaded(true)
        notifyHeroReadyInEffect('hero:lcpImg:fallbackTimeout')
      }
    }, 8000)
    return () => clearTimeout(fallback)
  }, [webHeroLoaded, firstImg])

  useEffect(() => {
    if (!webHeroLoaded || Platform.OS !== 'web') return
    if (!renderSlider) {
      setIsOverlayFading(false)
      setOverlayUnmounted(false)
      return
    }
    if (sliderImageReady) {
      setIsOverlayFading(true)
      const t = setTimeout(() => setOverlayUnmounted(true), 340)
      return () => clearTimeout(t)
    }
    const fallback = setTimeout(() => {
      setIsOverlayFading(true)
      setOverlayUnmounted(true)
    }, 6000)
    return () => clearTimeout(fallback)
  }, [webHeroLoaded, sliderImageReady, renderSlider])

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
  const [extrasReady, setExtrasReady] = useState(
    !deferExtras || Platform.OS !== 'web',
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
    let cancelled = false
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null
    const kick = () => {
      if (!cancelled) setExtrasReady(true)
    }
    if (
      typeof (window as unknown as Record<string, unknown>)
        ?.requestIdleCallback === 'function'
    ) {
      ;(
        window as unknown as {
          requestIdleCallback: (
            cb: () => void,
            opts: { timeout: number },
          ) => void
        }
      ).requestIdleCallback(kick, { timeout: 1200 })
    } else {
      fallbackTimeout = setTimeout(kick, 800)
    }
    return () => {
      cancelled = true
      if (fallbackTimeout) clearTimeout(fallbackTimeout)
    }
  }, [deferExtras])

  return {
    extrasReady,
  }
}

export function useTravelHeroState(
  travel: Travel,
  isMobile: boolean,
  onFirstImageLoad: () => void,
  deferExtras: boolean,
  renderSlider: boolean,
) {
  const media = useHeroMediaModel(travel, isMobile, onFirstImageLoad, renderSlider)
  const deferred = useDeferredHeroExtras(deferExtras)

  return {
    ...media,
    ...deferred,
  }
}
