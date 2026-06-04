import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image as RNImage,
  Platform,
} from 'react-native'

import { isIOSSafariUserAgent } from '@/components/ui/ImageCardMedia'
import { optimizeImageUrl } from '@/utils/imageOptimization'

type SlideSource = { uri?: string } | number | null | undefined

const getSlideRemoteUri = (source: SlideSource): string | null => {
  if (!source) return null

  if (typeof source === 'number') {
    // @ts-ignore RNImage.resolveAssetSource is available at runtime on web/native.
    const resolvedUri = RNImage.resolveAssetSource?.(source)?.uri
    return typeof resolvedUri === 'string' && resolvedUri.trim().length > 0
      ? resolvedUri.trim()
      : null
  }

  if (typeof source === 'object' && typeof source.uri === 'string') {
    const trimmedUri = source.uri.trim()
    return trimmedUri.length > 0 ? trimmedUri : null
  }

  return null
}

export const buildHomeHeroSlidePreloadUrl = (
  source: SlideSource,
  width: number,
  height: number,
): string | null => {
  const remoteUri = getSlideRemoteUri(source)
  if (!remoteUri) return null

  return (
    optimizeImageUrl(remoteUri, {
      width,
      height,
      quality: 75,
      fit: 'contain',
      format: 'auto',
    }) ?? remoteUri
  )
}

export const shouldDisableHomeHeroSliderBlur = (
  userAgent: string,
  maxTouchPoints = 0,
): boolean => isIOSSafariUserAgent(userAgent, maxTouchPoints)

type PreloadWebImageHandle = {
  promise: Promise<boolean>
  cancel: () => void
}

const preloadWebImage = (uri: string): PreloadWebImageHandle => {
  if (!uri || Platform.OS !== 'web') {
    return { promise: Promise.resolve(false), cancel: () => {} }
  }
  if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
    return { promise: Promise.resolve(false), cancel: () => {} }
  }

  const image = new window.Image()
  let settled = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let resolvePromise: (result: boolean) => void = () => {}

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    image.onload = null
    image.onerror = null
  }

  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve

    const settle = (result: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    image.onload = () => settle(true)
    image.onerror = () => settle(false)
    image.decoding = 'async'
    image.src = uri

    if (image.complete && image.naturalWidth > 0) {
      settle(true)
      return
    }

    timeoutId = setTimeout(() => settle(false), 1000)
  })

  const cancel = () => {
    if (settled) return
    settled = true
    cleanup()
    image.src = ''
    resolvePromise(false)
  }

  return { promise, cancel }
}

type UseHomeHeroSliderParams<TSlide> = {
  slides: readonly TSlide[]
  showSideSlider: boolean
  sliderMediaWidth: number
  sliderHeight: number
  prefersReducedMotion: boolean
  getSlideSource: (slide: TSlide) => SlideSource
}

export const useHomeHeroSlider = <TSlide>({
  slides,
  showSideSlider,
  sliderMediaWidth,
  sliderHeight,
  prefersReducedMotion,
  getSlideSource,
}: UseHomeHeroSliderParams<TSlide>) => {
  const waveBreath = useRef(new Animated.Value(0)).current
  const [activeSlide, setActiveSlide] = useState(0)
  const [visibleSlide, setVisibleSlide] = useState(0)
  const [fadingSlide, setFadingSlide] = useState<number | null>(null)
  const [loadedSlides, setLoadedSlides] = useState<Set<number>>(
    () => new Set([0]),
  )
  const previousVisibleSlideRef = useRef(0)
  const totalSlides = slides.length

  const loadedSlidesRef = useRef(loadedSlides)
  loadedSlidesRef.current = loadedSlides

  const markSlideAsLoaded = useCallback((slideIndex: number) => {
    setLoadedSlides((prev) => {
      if (prev.has(slideIndex)) return prev
      const next = new Set(prev)
      next.add(slideIndex)
      return next
    })
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisibleSlide(activeSlide)
      markSlideAsLoaded(activeSlide)
      return
    }

    if (totalSlides === 0) return

    let cancelled = false
    const preloadHandles: PreloadWebImageHandle[] = []

    const preloadSlide = async (slideIndex: number) => {
      if (loadedSlidesRef.current.has(slideIndex)) return

      const remoteUri = buildHomeHeroSlidePreloadUrl(
        getSlideSource(slides[slideIndex]),
        sliderMediaWidth,
        sliderHeight,
      )

      if (!remoteUri) {
        if (!cancelled) markSlideAsLoaded(slideIndex)
        return
      }

      const handle = preloadWebImage(remoteUri)
      preloadHandles.push(handle)
      const preloadSucceeded = await handle.promise
      if (!cancelled && preloadSucceeded) {
        markSlideAsLoaded(slideIndex)
      }
    }

    const nextSlide = (activeSlide + 1) % totalSlides
    void preloadSlide(activeSlide)
    void preloadSlide(nextSlide)

    return () => {
      cancelled = true
      preloadHandles.forEach((handle) => handle.cancel())
    }
  }, [
    activeSlide,
    getSlideSource,
    markSlideAsLoaded,
    sliderHeight,
    sliderMediaWidth,
    slides,
    totalSlides,
  ])

  useEffect(() => {
    if (totalSlides === 0) return

    if (activeSlide >= totalSlides) setActiveSlide(0)
    if (visibleSlide >= totalSlides) setVisibleSlide(0)
    setFadingSlide((current) =>
      current !== null && current >= totalSlides ? null : current,
    )
  }, [activeSlide, totalSlides, visibleSlide])

  useEffect(() => {
    if (loadedSlides.has(activeSlide)) {
      setVisibleSlide(activeSlide)
    }
  }, [activeSlide, loadedSlides])

  useEffect(() => {
    const previousVisibleSlide = previousVisibleSlideRef.current
    if (previousVisibleSlide === visibleSlide) return

    previousVisibleSlideRef.current = visibleSlide
    setFadingSlide(previousVisibleSlide)

    if (Platform.OS !== 'web') {
      setFadingSlide(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFadingSlide((current) =>
        current === previousVisibleSlide ? null : current,
      )
    }, 520)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [visibleSlide])

  useEffect(() => {
    if (!showSideSlider || prefersReducedMotion || totalSlides === 0) return

    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % totalSlides)
    }, 8000)

    return () => clearInterval(interval)
  }, [prefersReducedMotion, showSideSlider, totalSlides])

  useEffect(() => {
    if (!showSideSlider || prefersReducedMotion) {
      waveBreath.stopAnimation()
      waveBreath.setValue(0)
      return
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveBreath, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveBreath, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )

    loop.start()

    return () => {
      loop.stop()
      waveBreath.stopAnimation()
    }
  }, [prefersReducedMotion, showSideSlider, waveBreath])

  const handlePrevSlide = useCallback(() => {
    setActiveSlide((prev) =>
      totalSlides === 0 ? 0 : (prev - 1 + totalSlides) % totalSlides,
    )
  }, [totalSlides])

  const handleNextSlide = useCallback(() => {
    setActiveSlide((prev) =>
      totalSlides === 0 ? 0 : (prev + 1) % totalSlides,
    )
  }, [totalSlides])

  const renderedSlideIndices = useMemo(() => {
    if (
      fadingSlide === null ||
      fadingSlide === visibleSlide ||
      !loadedSlides.has(fadingSlide)
    ) {
      return [visibleSlide]
    }

    return [fadingSlide, visibleSlide]
  }, [fadingSlide, loadedSlides, visibleSlide])

  const topWaveAnimatedStyle = useMemo(
    () => ({
      opacity: waveBreath.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.34, 0.46, 0.38],
      }),
      transform: [
        {
          translateY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -2],
          }),
        },
        {
          scaleX: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.014],
          }),
        },
        {
          scaleY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.025],
          }),
        },
      ],
    }),
    [waveBreath],
  )

  const bottomWaveAnimatedStyle = useMemo(
    () => ({
      opacity: waveBreath.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.4, 0.54, 0.44],
      }),
      transform: [
        {
          translateY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 2],
          }),
        },
        {
          scaleX: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1.01, 1.024],
          }),
        },
        {
          scaleY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.036],
          }),
        },
      ],
    }),
    [waveBreath],
  )

  return {
    activeSlide,
    currentSlide: slides[visibleSlide],
    handleNextSlide,
    handlePrevSlide,
    loadedSlides,
    markSlideAsLoaded,
    renderedSlideIndices,
    topWaveAnimatedStyle,
    bottomWaveAnimatedStyle,
    visibleSlide,
  }
}
