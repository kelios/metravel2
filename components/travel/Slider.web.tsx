import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia, { prefetchImage } from '@/components/ui/ImageCardMedia'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import {
  buildVersionedImageUrl,
  getOptimalImageSize,
  getPreferredImageFormat,
  optimizeImageUrl,
} from '@/utils/imageOptimization'

export interface SliderImage {
  url: string
  id: number | string
  updated_at?: string
  width?: number
  height?: number
}

export interface SliderProps {
  images: SliderImage[]
  showArrows?: boolean
  showDots?: boolean
  hideArrowsOnMobile?: boolean
  aspectRatio?: number
  fit?: 'contain' | 'cover'
  fullBleed?: boolean
  autoPlay?: boolean
  autoPlayInterval?: number
  onIndexChanged?: (index: number) => void
  imageProps?: any
  preloadCount?: number
  blurBackground?: boolean
  onFirstImageLoad?: () => void
  mobileHeightPercent?: number
  firstImagePreloaded?: boolean
}

export interface SliderRef {
  scrollTo: (index: number, animated?: boolean) => void
  next: () => void
  prev: () => void
}

const DEFAULT_AR = 16 / 9

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// Compute preferred format once at module level (never changes at runtime)
const PREFERRED_FORMAT = Platform.OS === 'web' ? getPreferredImageFormat() : undefined
const FIRST_SLIDE_URI_CACHE = new Map<string, string>()

const buildUri = (
  img: SliderImage,
  containerWidth?: number,
  containerHeight?: number,
  fit: 'contain' | 'cover' = 'contain',
  isFirst: boolean = false
) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id)
  const fitForUrl: 'contain' | 'cover' = fit === 'cover' ? 'contain' : fit

  if (containerWidth && img.width && img.height) {
    const aspectRatio = img.width / img.height
    const cappedWidth = Math.min(containerWidth, 1200)
    const optimalSize = getOptimalImageSize(cappedWidth, containerHeight, aspectRatio)
    const quality = isFirst ? 40 : 65

    return (
      optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
        format: PREFERRED_FORMAT,
        quality,
        fit: fitForUrl,
        dpr: 1,
      }) || versionedUrl
    )
  }

  if (containerWidth) {
    const cappedWidth = Math.min(containerWidth, 1200)
    const quality = isFirst ? 40 : 65
    return (
      optimizeImageUrl(versionedUrl, {
        width: cappedWidth,
        format: PREFERRED_FORMAT,
        quality,
        fit: fitForUrl,
        dpr: 1,
      }) || versionedUrl
    )
  }

  return versionedUrl
}

const SliderComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const {
    images,
    showArrows = true,
    showDots = true,
    hideArrowsOnMobile,
    aspectRatio = DEFAULT_AR,
    fit = 'contain',
    fullBleed = false,
    onIndexChanged,
    imageProps,
    preloadCount = 0,
    blurBackground = true,
    onFirstImageLoad,
    mobileHeightPercent = 0.6,
  } = props

  const insets = useSafeAreaInsets()
  const { width: winW, height: winH, isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone

  const [containerW, setContainerW] = useState(winW)
  const containerWRef = useRef(winW)
  const wrapperRef = useRef<any>(null)
  const scrollRef = useRef<any>(null)
  const indexRef = useRef(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const prefetchEnabledRef = useRef(Platform.OS !== 'web')
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstSlideStableKeyRef = useRef<string | null>(null)
  const firstSlideStableUriRef = useRef<string | null>(null)
  const firstSlideLockedRef = useRef(true)

  const syncContainerWidthFromDom = useCallback(() => {
    if (Platform.OS !== 'web') return
    const raw = wrapperRef.current as any
    const node = raw?._nativeNode || raw?._domNode || raw
    const w = node?.getBoundingClientRect?.()?.width
    if (!Number.isFinite(w) || w <= 0) return
    if (Math.abs(containerWRef.current - w) > 4) {
      containerWRef.current = w
      setContainerW(w)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    syncContainerWidthFromDom()

    const raw = wrapperRef.current as any
    const node = raw?._nativeNode || raw?._domNode || raw
    if (!node) return

    const canUseResizeObserver =
      typeof (globalThis as any).ResizeObserver !== 'undefined' &&
      typeof node === 'object' &&
      node?.nodeType === 1

    let ro: ResizeObserver | null = null
    if (canUseResizeObserver) {
      ro = new ResizeObserver(() => syncContainerWidthFromDom())
      ro.observe(node as Element)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncContainerWidthFromDom)
    }

    return () => {
      ro?.disconnect()
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncContainerWidthFromDom)
      }
    }
  }, [syncContainerWidthFromDom])

  const firstAR = useMemo(() => {
    const f = images[0]
    return f?.width && f?.height ? f.width / f.height : aspectRatio
  }, [images, aspectRatio])

  const shouldShowSideBlurPanels = useMemo(() => {
    if (Platform.OS !== 'web') return false
    if (!blurBackground) return false
    const f = images[0]
    return !(f?.width && f?.height)
  }, [blurBackground, images])

  const computeHeight = useCallback(
    (w: number) => {
      if (!images.length) return 0
      if (isMobile) {
        const viewportH = Math.max(0, winH)
        const targetH = viewportH * mobileHeightPercent
        const safeMax = Math.max(targetH, viewportH - (insets.top || 0) - (insets.bottom || 0))
        return clamp(targetH, 280, safeMax || targetH)
      }
      const targetH = winH * 0.7
      const h = w / firstAR
      return clamp(Math.max(h, targetH), 320, winH * 0.75)
    },
    [firstAR, images.length, insets.bottom, insets.top, isMobile, winH, mobileHeightPercent]
  )

  const containerH = useMemo(() => computeHeight(containerW), [computeHeight, containerW])

  const firstSlideStableKey = useMemo(() => {
    const first = images[0]
    if (!first) return null
    return `${String(first.id)}|${String(first.updated_at ?? '')}|${String(first.url)}|${fit}`
  }, [images, fit])

  useEffect(() => {
    if (firstSlideStableKeyRef.current === firstSlideStableKey) return
    firstSlideStableKeyRef.current = firstSlideStableKey
    firstSlideLockedRef.current = true
    firstSlideStableUriRef.current =
      firstSlideStableKey && FIRST_SLIDE_URI_CACHE.has(firstSlideStableKey)
        ? FIRST_SLIDE_URI_CACHE.get(firstSlideStableKey) || null
        : null
  }, [firstSlideStableKey])

  const uriMap = useMemo(
    () =>
      images.map((img, idx) => {
        // Keep first slide URI stable until first actual image load.
        // This prevents src swaps while width/hydration settles on web.
        if (Platform.OS === 'web' && idx === 0 && firstSlideLockedRef.current) {
          if (firstSlideStableUriRef.current) return firstSlideStableUriRef.current

          if (firstSlideStableKey && FIRST_SLIDE_URI_CACHE.has(firstSlideStableKey)) {
            const cached = FIRST_SLIDE_URI_CACHE.get(firstSlideStableKey) || null
            firstSlideStableUriRef.current = cached
            if (cached) return cached
          }

          const initial = buildUri(img, containerW, containerH, fit, true)
          firstSlideStableUriRef.current = initial
          if (firstSlideStableKey) {
            FIRST_SLIDE_URI_CACHE.set(firstSlideStableKey, initial)
          }
          return initial
        }

        return buildUri(img, containerW, containerH, fit, idx === 0)
      }),
    [images, containerW, containerH, fit, firstSlideStableKey]
  )

  const canPrefetchOnWeb = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection
    if (connection?.saveData) return false
    const effectiveType = String(connection?.effectiveType || '').toLowerCase()
    if (effectiveType.includes('2g') || effectiveType === '3g') return false
    if (isMobile && effectiveType && !effectiveType.includes('4g')) return false
    return true
  }, [isMobile])

  const effectivePreload = useMemo(() => {
    const effective = Math.max(0, preloadCount)
    if (Platform.OS === 'web') return effective > 0 ? effective : 1
    return effective
  }, [preloadCount])

  const warmNeighbors = useCallback(
    (idx: number) => {
      if (!canPrefetchOnWeb) return
      if (Platform.OS === 'web' && !prefetchEnabledRef.current) return
      if (!effectivePreload) return
      for (let d = -effectivePreload; d <= effectivePreload; d++) {
        if (d === 0) continue
        const t = idx + d
        if (t < 0 || t >= images.length) continue
        const u = uriMap[t]
        prefetchImage(u).catch(() => undefined)
      }
    },
    [canPrefetchOnWeb, effectivePreload, images.length, uriMap]
  )

  const enablePrefetch = useCallback(() => {
    if (Platform.OS !== 'web') return
    if (prefetchEnabledRef.current) return
    if (!canPrefetchOnWeb) return
    prefetchEnabledRef.current = true
    warmNeighbors(indexRef.current)
  }, [canPrefetchOnWeb, warmNeighbors])

  const setActiveIndex = useCallback(
    (idx: number) => {
      const clampedIdx = clamp(idx, 0, Math.max(0, images.length - 1))
      indexRef.current = clampedIdx
      setCurrentIndex((prev) => (prev === clampedIdx ? prev : clampedIdx))
      onIndexChanged?.(clampedIdx)
      warmNeighbors(clampedIdx)
    },
    [images.length, onIndexChanged, warmNeighbors]
  )

  const scrollTo = useCallback(
    (i: number, animated = true) => {
      const wrapped = clamp(i, 0, images.length - 1)
      scrollRef.current?.scrollTo?.({ x: wrapped * containerW, y: 0, animated })
      setActiveIndex(wrapped)
    },
    [containerW, images.length, setActiveIndex]
  )

  const next = useCallback(() => {
    enablePrefetch()
    if (!images.length) return
    const target = (indexRef.current + 1) % images.length
    scrollTo(target)
  }, [enablePrefetch, images.length, scrollTo])

  const prev = useCallback(() => {
    enablePrefetch()
    if (!images.length) return
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length)
    scrollTo(target)
  }, [enablePrefetch, images.length, scrollTo])

  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next,
      prev,
    }),
    [next, prev, scrollTo]
  )

  const onLayout = useCallback(
    (e: any) => {
      const w = e?.nativeEvent?.layout?.width
      if (!Number.isFinite(w)) return
      if (Math.abs(containerWRef.current - w) > 4) {
        containerWRef.current = w
        setContainerW(w)
      }
    },
    []
  )

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current)
        scrollIdleTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const x = indexRef.current * (containerW || 0)
    if (!Number.isFinite(x) || x <= 0) return
    scrollRef.current?.scrollTo?.({ x, y: 0, animated: false })
  }, [containerW])

  const keyExtractor = useCallback(
    (it: SliderImage, index: number) =>
      `${String(it.id)}|${String(it.updated_at ?? '')}|${String(it.url)}|${index}`,
    []
  )

  const handleFirstImageLoad = useCallback(() => {
    firstSlideLockedRef.current = false
    onFirstImageLoad?.()
    enablePrefetch()
  }, [onFirstImageLoad, enablePrefetch])

  // Memoize slide dimensions to avoid creating new style objects per slide
  const slideDimensions = useMemo(
    () => ({ width: containerW, height: containerH }),
    [containerW, containerH]
  )

  // Memoize merged imageProps to avoid new object per slide
  const mergedImagePropsBase = useMemo(
    () => ({ ...(imageProps || {}), contentPosition: 'center' as const }),
    [imageProps]
  )

  // Render all slides always — no placeholder logic.
  // Browser's native loading="lazy" handles deferred image fetching.
  // This eliminates React re-renders during scroll (no renderIndex dependency).
  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      const uri = uriMap[index] ?? item.url
      const isFirstSlide = index === 0
      // On mobile: only first slide is eager to avoid bandwidth competition
      // On desktop: first 3 slides load eagerly
      const isEager = isMobile ? index === 0 : index <= 2

      return (
        <View style={[styles.slide, slideDimensions, styles.slideSnap]}>
          <View style={styles.imageCardWrapper}>
            <View style={styles.imageCardSurface}>
              <ImageCardMedia
                src={uri}
                fit={fit}
                blurBackground={blurBackground}
                priority={isFirstSlide ? 'high' : (isEager ? 'normal' : 'low')}
                loading={isEager ? 'eager' : 'lazy'}
                prefetch={isFirstSlide}
                transition={0}
                style={styles.img}
                alt={`Фотография путешествия ${index + 1} из ${images.length}`}
                imageProps={{
                  ...mergedImagePropsBase,
                  testID: `slider-image-${index}`,
                  accessibilityRole: 'image',
                  accessibilityLabel: `Фотография путешествия ${index + 1} из ${images.length}`,
                }}
                onLoad={isFirstSlide ? handleFirstImageLoad : undefined}
              />
            </View>
          </View>
        </View>
      )
    },
    [blurBackground, fit, handleFirstImageLoad, images.length, isMobile, mergedImagePropsBase, slideDimensions, styles.imageCardSurface, styles.imageCardWrapper, styles.img, styles.slide, styles.slideSnap, uriMap]
  )

  // Minimal scroll handler — only update currentIndex when scroll settles.
  // No React state updates during scroll animation = zero flicker.
  const handleScroll = useCallback(
    (e: any) => {
      enablePrefetch()
      const x = e?.nativeEvent?.contentOffset?.x ?? 0

      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = setTimeout(() => {
        const idx = Math.round((x || 0) / (containerW || 1))
        setActiveIndex(idx)
      }, 80)
    },
    [containerW, enablePrefetch, setActiveIndex]
  )

  // Keyboard navigation for accessibility
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prev()
      } else if (e.key === 'ArrowRight') {
        next()
      }
    }
    // Only attach when slider is focused or hovered
    const wrapper = scrollRef.current as any
    const node = wrapper?._nativeNode || wrapper?._domNode || wrapper
    if (!node || typeof node.addEventListener !== 'function') return
    const parent = node.closest?.('[data-testid="slider-wrapper"]') || node.parentElement?.parentElement
    if (!parent) return
    parent.setAttribute('tabindex', '0')
    parent.addEventListener('keydown', handleKeyDown)
    return () => {
      parent.removeEventListener('keydown', handleKeyDown)
    }
  }, [next, prev])

  if (!images.length) return null

  const navInset = isMobile ? 8 : Math.max(insets.left || 0, insets.right || 0)
  const navOffset = Math.max(44, 16 + navInset)

  return (
    <View style={styles.sliderStack}>
      <View
        ref={wrapperRef}
        onLayout={Platform.OS === 'web' ? undefined : onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          Platform.OS === 'web' && !fullBleed
            ? ({ maxWidth: 1280, marginHorizontal: 'auto' } as any)
            : null,
        ]}
      >
        <View style={styles.clip}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={100}
            style={[styles.scrollView, styles.scrollSnap]}
            contentContainerStyle={[styles.scrollContent, { height: containerH }]}
            onScrollBeginDrag={() => {
              enablePrefetch()
            }}
            onScroll={handleScroll}
          >
            {images.map((item, index) => {
              // On mobile: only render slides within ±2 of current index to reduce DOM size
              // Other slides get an empty placeholder to preserve scroll position
              if (isMobile && images.length > 5 && Math.abs(index - currentIndex) > 2) {
                return (
                  <View key={keyExtractor(item, index)} style={[styles.slide, slideDimensions, styles.slideSnap]} />
                )
              }
              return (
                <React.Fragment key={keyExtractor(item, index)}>
                  {renderItem({ item, index })}
                </React.Fragment>
              )
            })}
          </ScrollView>
        </View>

        {Platform.OS === 'web' && shouldShowSideBlurPanels ? (
          <>
            <View
              pointerEvents="none"
              style={styles.edgeScrimLeft}
              testID={shouldShowSideBlurPanels ? `slider-side-blur-left-${currentIndex}` : undefined}
            />
            <View
              pointerEvents="none"
              style={styles.edgeScrimRight}
              testID={shouldShowSideBlurPanels ? `slider-side-blur-right-${currentIndex}` : undefined}
            />
          </>
        ) : null}

        {showArrows && images.length > 1 && !(isMobile && hideArrowsOnMobile) ? (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              onPress={prev}
              activeOpacity={0.8}
              style={[styles.navBtn, { left: navOffset }]}
            >
              <View style={styles.arrowIconContainer}>
                <Feather
                  name="chevron-left"
                  size={isMobile ? 20 : 24}
                  color={colors.textOnDark}
                  style={styles.arrowIcon}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next slide"
              onPress={next}
              activeOpacity={0.8}
              style={[styles.navBtn, { right: navOffset }]}
            >
              <View style={styles.arrowIconContainer}>
                <Feather
                  name="chevron-right"
                  size={isMobile ? 20 : 24}
                  color={colors.textOnDark}
                  style={styles.arrowIcon}
                />
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {images.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{images.length}
              </Text>
            </View>
          </View>
        ) : null}

        {showDots && images.length > 1 ? (
          <View style={styles.dots}>
            <View style={styles.dotsContainer}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex ? styles.dotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const Slider = forwardRef(SliderComponent)

export default memo(Slider)

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create<Record<string, any>>({
    sliderStack: {
      width: '100%',
      alignItems: 'center',
    },
    wrapper: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor: 'transparent',
      position: 'relative',
      borderRadius: 12,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web'
        ? ({ boxShadow: colors.boxShadows.heavy } as any)
        : null),
    },
    clip: {
      flex: 1,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      borderRadius: 12,
      backgroundColor: 'transparent',
      position: 'relative',
    },
    scrollView: {
      flex: 1,
    },
    scrollSnap: Platform.OS === 'web'
      ? ({
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
        } as any)
      : {},
    scrollContent: {
      flexDirection: 'row',
    },
    slide: {
      flexShrink: 0,
      position: 'relative',
      backgroundColor: '#1a1a1a',
      overflow: 'hidden',
    },
    slideSnap: Platform.OS === 'web'
      ? ({ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as any)
      : {},
    imageCardWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    imageCardSurface: {
      width: '100%',
      height: '100%',
      alignSelf: 'center',
      borderRadius: 0,
      overflow: 'hidden',
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    img: {
      width: '100%',
      height: '100%',
      borderRadius: 0,
    },
    navBtn: {
      position: 'absolute',
      top: '50%',
      marginTop: -28,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      width: 56,
      height: 56,
      borderRadius: 28,
      zIndex: 50,
      justifyContent: 'center',
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          } as any)
        : null),
    },
    arrowIconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    arrowIcon: {
      ...(Platform.OS === 'web'
        ? ({
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))',
          } as any)
        : {
            textShadowColor: 'rgba(0,0,0,0.65)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }),
    },
    edgeScrimLeft: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 140,
      zIndex: 20,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0))',
          } as any)
        : null),
    },
    edgeScrimRight: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: 140,
      zIndex: 20,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(to left, rgba(0,0,0,0.45), rgba(0,0,0,0))',
          } as any)
        : null),
    },
    dots: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 14,
      alignItems: 'center',
    },
    dotsContainer: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.overlayLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
    },
    dotActive: {
      width: 18,
      opacity: 1,
      backgroundColor: colors.text,
    },
    counter: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 50,
    },
    counterContainer: {
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any)
        : null),
    },
    counterText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700' as any,
      fontFamily: 'system-ui, -apple-system',
      letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  })
