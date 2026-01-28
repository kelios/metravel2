import React, {
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { FlatList, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'
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
}

export interface SliderRef {
  scrollTo: (index: number, animated?: boolean) => void
  next: () => void
  prev: () => void
}

const DEFAULT_AR = 16 / 9

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

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
    const quality = isFirst ? 55 : 65

    return (
      optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
        format: getPreferredImageFormat(),
        quality,
        fit: fitForUrl,
        dpr: 1,
      }) || versionedUrl
    )
  }

  if (containerWidth) {
    const cappedWidth = Math.min(containerWidth, 1200)
    const quality = isFirst ? 55 : 65
    return (
      optimizeImageUrl(versionedUrl, {
        width: cappedWidth,
        format: getPreferredImageFormat(),
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
  const listRef = useRef<FlatList<SliderImage>>(null)
  const indexRef = useRef(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [prefetchEnabled, setPrefetchEnabled] = useState(Platform.OS !== 'web')

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
      const h = w / firstAR
      return clamp(h, 320, 640)
    },
    [firstAR, images.length, insets.bottom, insets.top, isMobile, winH, mobileHeightPercent]
  )

  const containerH = useMemo(() => computeHeight(containerW), [computeHeight, containerW])

  const uriMap = useMemo(
    () =>
      images.map((img, idx) =>
        buildUri(img, containerW, containerH, fit, idx === 0)
      ),
    [images, containerW, containerH, fit]
  )

  const canPrefetchOnWeb = useMemo(() => {
    if (isMobile) return false
    if (typeof navigator === 'undefined') return false
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection
    if (connection?.saveData) return false
    const effectiveType = String(connection?.effectiveType || '').toLowerCase()
    if (effectiveType.includes('2g') || effectiveType === '3g') return false
    return true
  }, [isMobile])

  const effectivePreload = useMemo(() => {
    if (!prefetchEnabled) return 0
    const effective = Math.max(0, preloadCount)
    if (Platform.OS === 'web') return effective > 0 ? effective : 1
    return effective
  }, [prefetchEnabled, preloadCount])

  const warmNeighbors = useCallback(
    (idx: number) => {
      if (!canPrefetchOnWeb) return
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
    if (prefetchEnabled) return
    if (!canPrefetchOnWeb) return
    setPrefetchEnabled(true)
  }, [canPrefetchOnWeb, prefetchEnabled])

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
      listRef.current?.scrollToOffset({ offset: wrapped * containerW, animated })
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
      if (Math.abs(w - containerW) > 2) setContainerW(w)
    },
    [containerW]
  )

  const keyExtractor = useCallback((it: SliderImage) => String(it.id), [])

  const getItemLayout = useCallback(
    (_: any, i: number) => ({
      length: containerW,
      offset: containerW * i,
      index: i,
    }),
    [containerW]
  )

  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      const uri = uriMap[index] ?? item.url
      const isFirstSlide = index === 0
      const mainPriority = isFirstSlide ? 'high' : 'low'

      return (
        <View style={[styles.slide, { width: containerW, height: containerH }]}>
          <View style={styles.imageCardWrapper}>
            <View style={styles.imageCardSurface}>
              <ImageCardMedia
                src={uri}
                fit={fit}
                blurBackground={blurBackground}
                priority={mainPriority as any}
                loading={isFirstSlide ? 'eager' : 'lazy'}
                transition={0}
                style={styles.img}
                alt={`Фотография путешествия ${index + 1} из ${images.length}`}
                imageProps={{
                  ...(imageProps || {}),
                  contentPosition: 'center',
                  testID: `slider-image-${index}`,
                  accessibilityRole: 'image',
                  accessibilityLabel: `Фотография путешествия ${index + 1} из ${images.length}`,
                }}
                onLoad={() => {
                  if (index === 0) onFirstImageLoad?.()
                }}
              />
            </View>
          </View>
        </View>
      )
    },
    [blurBackground, containerH, containerW, fit, imageProps, images.length, onFirstImageLoad, styles.imageCardSurface, styles.imageCardWrapper, styles.img, styles.slide, uriMap]
  )

  if (!images.length) return null

  const navInset = isMobile ? 8 : Math.max(insets.left || 0, insets.right || 0)
  const navOffset = Math.max(44, 16 + navInset)

  return (
    <View style={styles.sliderStack}>
      <View
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          Platform.OS === 'web' && !fullBleed
            ? ({ maxWidth: 1280, marginHorizontal: 'auto' } as any)
            : null,
        ]}
      >
        <View style={styles.clip}>
          <FlatList
            ref={listRef}
            data={images}
            keyExtractor={keyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={renderItem}
            initialNumToRender={1}
            windowSize={2 + Math.max(0, preloadCount)}
            maxToRenderPerBatch={1 + Math.max(0, preloadCount)}
            getItemLayout={getItemLayout}
            onScrollBeginDrag={() => {
              enablePrefetch()
            }}
            onMomentumScrollEnd={(e) => {
              enablePrefetch()
              const x = e?.nativeEvent?.contentOffset?.x ?? 0
              const idx = Math.round(x / (containerW || 1))
              setActiveIndex(idx)
            }}
          />
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
    slide: {
      flex: 1,
      position: 'relative',
      backgroundColor: colors.mutedBackground,
    },
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
  })
