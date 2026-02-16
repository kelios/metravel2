import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia, { prefetchImage } from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import type { SliderImage, SliderProps, SliderRef } from './sliderParts/types'
import {
  clamp,
  buildUriWeb as buildUri,
  computeSliderHeight,
  FIRST_SLIDE_URI_CACHE,
  FIRST_SLIDE_URI_CACHE_MAX,
  DEFAULT_AR,
} from './sliderParts/utils'

export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types'

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
  const sliderInstanceId = useId()

  const [containerW, setContainerW] = useState(winW)
  const containerWRef = useRef(winW)
  const wrapperRef = useRef<any>(null)
  const scrollRef = useRef<any>(null)
  const indexRef = useRef(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const prefetchEnabledRef = useRef(Platform.OS !== 'web')
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragScrollLeftRef = useRef(0)
  const firstSlideStableKeyRef = useRef<string | null>(null)
  const firstSlideStableUriRef = useRef<string | null>(null)
  const firstSlideLockedRef = useRef(true)

  const getWrapperNode = useCallback((): HTMLElement | null => {
    const raw = wrapperRef.current as any
    const node = (raw?._nativeNode || raw?._domNode || raw) as HTMLElement | null
    if (node && typeof node.getBoundingClientRect === 'function') return node
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return document.querySelector(
        `[data-testid="slider-wrapper"][data-slider-instance="${sliderInstanceId}"]`
      ) as HTMLElement | null
    }
    return null
  }, [sliderInstanceId])

  const syncContainerWidthFromDom = useCallback(() => {
    if (Platform.OS !== 'web') return
    const node = getWrapperNode()
    const w = node?.getBoundingClientRect?.()?.width ?? 0
    if (!Number.isFinite(w) || w <= 0) return
    if (Math.abs(containerWRef.current - w) > 4) {
      containerWRef.current = w
      setContainerW(w)
    }
  }, [getWrapperNode])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    syncContainerWidthFromDom()

    const node = getWrapperNode()
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
    (w: number) =>
      computeSliderHeight(w, {
        imagesLength: images.length,
        isMobile,
        winH,
        insetsTop: insets.top || 0,
        insetsBottom: insets.bottom || 0,
        mobileHeightPercent,
        firstAR,
      }),
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
            if (FIRST_SLIDE_URI_CACHE.size >= FIRST_SLIDE_URI_CACHE_MAX) {
              const oldest = FIRST_SLIDE_URI_CACHE.keys().next().value
              if (oldest !== undefined) FIRST_SLIDE_URI_CACHE.delete(oldest)
            }
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

  const getScrollNode = useCallback((): HTMLElement | null => {
    const raw = scrollRef.current as any
    const node: HTMLElement | null = raw?._nativeNode || raw?._domNode || raw
    if (node && typeof node.scrollTo === 'function') return node
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Scope DOM fallback to the current slider instance.
      return document.querySelector(
        `[data-testid="slider-scroll"][data-slider-instance="${sliderInstanceId}"]`
      ) as HTMLElement | null
    }
    return node && typeof node.scrollTo === 'function' ? node : null
  }, [sliderInstanceId])

  const scrollTo = useCallback(
    (i: number, _animated = true) => {
      const wrapped = clamp(i, 0, images.length - 1)
      const node = getScrollNode()
      if (node) {
        const left = wrapped * containerW
        if (Platform.OS === 'web') {
          // scroll-snap-type blocks programmatic scrollTo in Chromium.
          // Temporarily disable, scroll, then re-enable after paint.
          // scrollSnapType is managed via DOM only (not in React styles)
          // so React re-renders won't re-apply it.
          node.style.scrollSnapType = 'none'
          void node.offsetHeight
          node.scrollTo({ left, top: 0, behavior: 'instant' })
          requestAnimationFrame(() => {
            node.style.scrollSnapType = 'x mandatory'
          })
        } else {
          node.scrollTo({ left, top: 0, behavior: _animated ? 'smooth' : 'instant' })
        }
      }
      setActiveIndex(wrapped)
    },
    [containerW, getScrollNode, images.length, setActiveIndex]
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
    const left = indexRef.current * (containerW || 0)
    if (!Number.isFinite(left) || left <= 0) return
    const node = getScrollNode()
    if (node) {
      if (Platform.OS === 'web') {
        node.style.scrollSnapType = 'none'
        void node.offsetHeight
        node.scrollTo({ left, top: 0, behavior: 'instant' })
        requestAnimationFrame(() => {
          node.style.scrollSnapType = 'x mandatory'
        })
      } else {
        node.scrollTo({ left, top: 0, behavior: 'instant' })
      }
    }
  }, [containerW, getScrollNode])

  // Apply scroll-snap-type via DOM (not React styles) so React re-renders
  // don't re-apply it and interfere with programmatic scrollTo.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const node = getScrollNode()
    if (node) node.style.scrollSnapType = 'x mandatory'
  }, [getScrollNode])

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

  const slideDimensions = useMemo(
    () => ({ width: containerW, height: containerH }),
    [containerW, containerH]
  )

  const mergedImagePropsBase = useMemo(
    () => ({ ...(imageProps || {}), contentPosition: 'center' as const }),
    [imageProps]
  )

  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      const uri = uriMap[index] ?? item.url
      const isFirstSlide = index === 0
      const isEager = index === 0

      return (
        <View style={[styles.slide, slideDimensions, styles.slideSnap]}>
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
      )
    },
    [blurBackground, fit, handleFirstImageLoad, images.length, mergedImagePropsBase, slideDimensions, styles.img, styles.slide, styles.slideSnap, uriMap]
  )

  const handleScroll = useCallback(
    (e: any) => {
      enablePrefetch()

      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = setTimeout(() => {
        // Read scrollLeft at idle time (not at event time) so containerW is current
        const node = getScrollNode()
        const x = node?.scrollLeft ?? 0
        const cw = containerWRef.current || 1
        const idx = Math.round(x / cw)
        setActiveIndex(idx)
      }, 80)
    },
    [enablePrefetch, getScrollNode, setActiveIndex]
  )

  const nextRef = useRef(next)
  nextRef.current = next
  const prevRef = useRef(prev)
  prevRef.current = prev

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevRef.current()
      } else if (e.key === 'ArrowRight') {
        nextRef.current()
      }
    }
    const node = getScrollNode()
    if (!node) return
    const parent = (node.closest?.('[data-testid="slider-wrapper"]') || node.parentElement?.parentElement) as HTMLElement | null
    if (!parent) return
    parent.setAttribute('tabindex', '0')
    parent.addEventListener('keydown', handleKeyDown as EventListener)
    return () => {
      parent.removeEventListener('keydown', handleKeyDown as EventListener)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const node = getScrollNode()
    if (!node) return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      isDraggingRef.current = true
      dragStartXRef.current = e.pageX
      dragScrollLeftRef.current = node.scrollLeft
      node.style.cursor = 'grabbing'
      node.style.scrollSnapType = 'none'
      node.style.userSelect = 'none'
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      const dx = e.pageX - dragStartXRef.current
      node.scrollLeft = dragScrollLeftRef.current - dx
    }
    const snapToSlide = (targetIdx: number) => {
      const cw = containerWRef.current || 1
      // Set scroll position synchronously, then re-enable snap after
      // the browser has painted the new position (double-rAF).
      node.scrollLeft = targetIdx * cw
      setActiveIndex(targetIdx)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.style.scrollSnapType = 'x mandatory'
        })
      })
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      node.style.cursor = ''
      node.style.userSelect = ''
      const dx = e.pageX - dragStartXRef.current
      const cw = containerWRef.current || 1
      const cur = indexRef.current
      const threshold = cw * 0.15
      let target = cur
      if (dx < -threshold) target = cur + 1
      else if (dx > threshold) target = cur - 1
      target = clamp(target, 0, Math.max(0, images.length - 1))
      snapToSlide(target)
    }
    const onMouseLeave = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      node.style.cursor = ''
      node.style.userSelect = ''
      const cw = containerWRef.current || 1
      const idx = Math.round(node.scrollLeft / cw)
      const target = clamp(idx, 0, Math.max(0, images.length - 1))
      snapToSlide(target)
    }

    // Handle native scroll end for touch devices (scroll-snap finishes)
    const onScrollEnd = () => {
      const cw = containerWRef.current || 1
      const idx = Math.round(node.scrollLeft / cw)
      const target = clamp(idx, 0, Math.max(0, images.length - 1))
      setActiveIndex(target)
    }

    node.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    node.addEventListener('mouseleave', onMouseLeave)
    node.addEventListener('scrollend', onScrollEnd)
    return () => {
      node.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      node.removeEventListener('mouseleave', onMouseLeave)
      node.removeEventListener('scrollend', onScrollEnd)
    }
  }, [images.length, setActiveIndex])

  if (!images.length) return null

  const navInset = isMobile ? 8 : Math.max(insets.left || 0, insets.right || 0)
  const navOffset = Math.max(44, 16 + navInset)

  return (
    <View style={styles.sliderStack} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        dataSet={{ sliderInstance: sliderInstanceId }}
        onLayout={Platform.OS === 'web' ? undefined : onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          Platform.OS === 'web' && !fullBleed
            ? ({ maxWidth: 1280, marginHorizontal: 'auto' } as any)
            : null,
        ]}
      >
        <View style={styles.clip} testID="slider-clip">
          <ScrollView
            ref={scrollRef}
            horizontal
            dataSet={{ sliderInstance: sliderInstanceId }}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={100}
            style={[styles.scrollView, styles.scrollSnap]}
            contentContainerStyle={[styles.scrollContent, { height: containerH }]}
            onScrollBeginDrag={() => {
              enablePrefetch()
            }}
            onScroll={handleScroll}
            testID="slider-scroll"
          >
            {images.map((item, index) => {
              const renderWindow = isMobile ? 2 : 3
              if (images.length > 5 && index !== 0 && Math.abs(index - currentIndex) > renderWindow) {
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
              style={[styles.edgeScrimLeft, { pointerEvents: 'none' }]}
              testID={shouldShowSideBlurPanels ? `slider-side-blur-left-${currentIndex}` : undefined}
            />
            <View
              style={[styles.edgeScrimRight, { pointerEvents: 'none' }]}
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
          <View style={[styles.counter, { pointerEvents: 'none' }]}>
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
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    clip: {
      flex: 1,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: 'transparent',
      position: 'relative',
    },
    scrollView: {
      flex: 1,
      ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : {}),
    },
    scrollSnap: Platform.OS === 'web'
      ? ({
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
          touchAction: 'pan-x pan-y',
          overflowX: 'auto',
          overflowY: 'hidden',
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
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          } as any)
        : null),
    },
    arrowIconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    arrowIcon: {},
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
