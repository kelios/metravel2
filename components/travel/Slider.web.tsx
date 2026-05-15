import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { SliderProps, SliderRef } from './sliderParts/types'
import {
  DEFAULT_AR,
  MOBILE_HEIGHT_PERCENT,
  SLIDER_MAX_WIDTH,
  buildUriWeb,
  getSliderViewportFlags,
} from './sliderParts/utils'
import { MAX_VISIBLE_DOTS, createSliderStyles } from './sliderParts/styles'
import Slide from './sliderParts/Slide'
import { useSliderCore } from './sliderParts/useSliderCore'
import { useSliderTrack } from './sliderParts/useSliderTrack'
import { useSliderPointerDrag } from './sliderParts/useSliderPointerDrag'

export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types'

if (typeof document !== 'undefined') {
  const STYLE_ID = 'slider-web-carousel-styles'
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      [data-testid="slider-wrapper"]:hover [aria-label="Previous slide"],
      [data-testid="slider-wrapper"]:hover [aria-label="Next slide"] {
        opacity: 1 !important;
      }
      [aria-label="Previous slide"]:hover,
      [aria-label="Next slide"]:hover {
        background-color: rgba(0,0,0,0.5) !important;
        border-color: rgba(255,255,255,0.3) !important;
        transform: scale(1.08) !important;
      }
      [aria-label="Previous slide"]:active,
      [aria-label="Next slide"]:active {
        transform: scale(0.95) !important;
      }
    `
    document.head.appendChild(style)
  }
}

const POINTER_EVENTS_NONE = { pointerEvents: 'none' as const }
const MOBILE_ARROW_VISIBLE_STYLE = {
  opacity: 1,
  backgroundColor: 'rgba(0,0,0,0.42)',
  borderColor: 'rgba(255,255,255,0.28)',
} as any

function getNavOffset(isMobile: boolean, isTablet: boolean, insets: { left?: number; right?: number }) {
  if (isMobile) return 8
  if (isTablet) return 12
  return Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0))
}

function getArrowIconSize(isMobile: boolean, isTablet: boolean) {
  if (isMobile) return 16
  if (isTablet) return 18
  return 20
}

interface NavArrowButtonProps {
  direction: 'prev' | 'next'
  iconSize: number
  isMobile: boolean
  isTablet: boolean
  navOffset: number
  styles: Record<string, any>
  onPress: () => void
}

const NavArrowButton = memo(function NavArrowButton({
  direction,
  iconSize,
  isMobile,
  isTablet,
  navOffset,
  styles,
  onPress,
}: NavArrowButtonProps) {
  const sideStyle = isMobile ? styles.navBtnMobile : isTablet ? styles.navBtnTablet : styles.navBtnDesktop
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={direction === 'prev' ? 'Previous slide' : 'Next slide'}
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.navBtn,
        sideStyle,
        isMobile && MOBILE_ARROW_VISIBLE_STYLE,
        direction === 'prev' ? { left: navOffset } : { right: navOffset },
      ]}
      {...({ className: 'slider-nav-btn' } as any)}
    >
      <View style={styles.arrowIconContainer}>
        <Feather
          name={direction === 'prev' ? 'chevron-left' : 'chevron-right'}
          size={iconSize}
          color="rgba(255,255,255,0.95)"
          style={styles.arrowIcon}
        />
      </View>
    </TouchableOpacity>
  )
})

interface NavArrowsProps {
  imagesLen: number
  isMobile: boolean
  isTablet: boolean
  hideArrowsOnMobile?: boolean
  navOffset: number
  styles: Record<string, any>
  onPrev: () => void
  onNext: () => void
}

const NavArrows = memo(function NavArrows({
  imagesLen,
  isMobile,
  isTablet,
  hideArrowsOnMobile,
  navOffset,
  styles,
  onPrev,
  onNext,
}: NavArrowsProps) {
  if (imagesLen < 2 || (isMobile && hideArrowsOnMobile)) return null
  const iconSize = getArrowIconSize(isMobile, isTablet)
  return (
    <>
      <NavArrowButton
        direction="prev"
        iconSize={iconSize}
        isMobile={isMobile}
        isTablet={isTablet}
        navOffset={navOffset}
        styles={styles}
        onPress={onPrev}
      />
      <NavArrowButton
        direction="next"
        iconSize={iconSize}
        isMobile={isMobile}
        isTablet={isTablet}
        navOffset={navOffset}
        styles={styles}
        onPress={onNext}
      />
    </>
  )
})

interface PaginationDotsProps {
  total: number
  currentIndex: number
  isMobile: boolean
  styles: Record<string, any>
}

const PaginationDots = memo(function PaginationDots({
  total,
  currentIndex,
  isMobile,
  styles,
}: PaginationDotsProps) {
  const dots = useMemo(() => {
    if (total <= MAX_VISIBLE_DOTS) {
      return Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
      ))
    }

    const half = Math.floor(MAX_VISIBLE_DOTS / 2)
    let windowStart = currentIndex - half
    let windowEnd = currentIndex + half
    if (windowStart < 0) {
      windowStart = 0
      windowEnd = MAX_VISIBLE_DOTS - 1
    }
    if (windowEnd >= total) {
      windowEnd = total - 1
      windowStart = total - MAX_VISIBLE_DOTS
    }

    return Array.from({ length: windowEnd - windowStart + 1 }, (_, offset) => {
      const i = windowStart + offset
      const distFromActive = Math.abs(i - currentIndex)
      const isEdge = i === windowStart || i === windowEnd
      const isActive = i === currentIndex

      let dotStyle: any
      if (isActive) dotStyle = [styles.dot, styles.dotActive]
      else if (isEdge && distFromActive >= 2) dotStyle = [styles.dot, styles.dotTiny]
      else if (distFromActive >= 2) dotStyle = [styles.dot, styles.dotSmall]
      else dotStyle = [styles.dot]

      return <View key={i} style={dotStyle} />
    })
  }, [currentIndex, total, styles])

  if (total < 2) return null
  return (
    <View style={[styles.dots, isMobile && styles.dotsMobile, POINTER_EVENTS_NONE]}>
      <View style={styles.dotsContainer}>{dots}</View>
    </View>
  )
})

const SliderWebComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createSliderStyles(colors), [colors])

  const {
    images,
    showArrows = true,
    showDots = true,
    controlsVisible = true,
    hideArrowsOnMobile = true,
    aspectRatio = DEFAULT_AR,
    contentAspectRatio,
    fit = 'contain',
    fullBleed = false,
    autoPlay = true,
    autoPlayInterval = 6000,
    onIndexChanged,
    imageProps,
    preloadCount: preloadCountProp = 1,
    blurBackground = true,
    onFirstImageLoad,
    mobileHeightPercent = MOBILE_HEIGHT_PERCENT,
    onImagePress,
    firstImagePreloaded,
    fillContainer = false,
    skipFirstSlideImage = false,
  } = props

  const sliderInstanceId = useId()
  const dataSetSliderId = useMemo(
    () => ({ dataSet: { sliderInstance: sliderInstanceId } } as any),
    [sliderInstanceId],
  )

  const { width: viewportWidth } = useWindowDimensions()
  const { isMobile: isMobileDevice } = useMemo(
    () => getSliderViewportFlags(viewportWidth),
    [viewportWidth],
  )
  const effectivePreloadCount = isMobileDevice
    ? Math.max(preloadCountProp, 1)
    : preloadCountProp

  const buildUri = useCallback(
    (img: any, w: number, h: number, isFirst: boolean) => buildUriWeb(img, w, h, fit, isFirst),
    [fit],
  )

  const {
    containerW,
    containerH: containerHeightPx,
    currentIndex,
    indexRef,
    containerWRef,
    isMobile,
    isTablet,
    insets,
    getUri,
    setContainerWidth,
    dismissSwipeHint,
    prefetchEnabled,
    enablePrefetch,
    scrollTo,
    setScrollToImpl,
    pauseAutoplay,
    resumeAutoplay,
  } = useSliderCore({
    images,
    aspectRatio,
    autoPlay,
    autoPlayInterval,
    preloadCount: effectivePreloadCount,
    mobileHeightPercent,
    onIndexChanged,
    buildUri,
    deferWebPrefetchUntilInteraction: effectivePreloadCount < 1,
    handleAppState: false,
    includeUriMap: false,
  })

  const [firstImageLoaded, setFirstImageLoaded] = useState(!!firstImagePreloaded)
  useEffect(() => {
    if (firstImagePreloaded) setFirstImageLoaded(true)
  }, [firstImagePreloaded])
  const handleFirstImageLoad = useCallback(() => {
    setFirstImageLoaded(true)
    onFirstImageLoad?.()
  }, [onFirstImageLoad])

  const containerHeight = fillContainer ? ('100%' as const) : containerHeightPx
  const maxIndex = Math.max(0, images.length - 1)
  const imagesLen = images.length
  const navOffset = getNavOffset(isMobile, isTablet, insets)

  const {
    wrapperRef,
    viewportRef,
    trackRef,
    layoutMeasured,
    effectiveSlideWidth: renderedSlideWidth,
    applyOffset,
    snapOffsetForIndex,
    animateToIndex,
    stopAnimation,
    onLayout,
  } = useSliderTrack({
    containerWRef,
    indexRef,
    maxIndex,
    renderedSlideWidth: containerW,
    setContainerWidth,
  })

  const slideWidthStyle =
    imagesLen === 1 ? '100%' : layoutMeasured ? renderedSlideWidth : `${100 / imagesLen}%`
  const slideMediaWidth = layoutMeasured ? renderedSlideWidth : '100%'
  const trackWidth =
    imagesLen === 1
      ? '100%'
      : layoutMeasured
        ? renderedSlideWidth * imagesLen
        : `${imagesLen * 100}%`

  useSliderPointerDrag({
    viewportRef,
    wrapperRef,
    imagesLen,
    isMobile,
    maxIndex,
    indexRef,
    containerWRef,
    renderedSlideWidth,
    applyOffset,
    snapOffsetForIndex,
    stopAnimation,
    scrollTo,
    pauseAutoplay,
    resumeAutoplay,
    dismissSwipeHint,
    enablePrefetch,
  })

  const scrollToDom = useCallback(
    (idx: number, animated = true) => animateToIndex(idx, animated),
    [animateToIndex],
  )
  useEffect(() => {
    setScrollToImpl(scrollToDom)
  }, [scrollToDom, setScrollToImpl])

  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        const target = Math.min(maxIndex, indexRef.current + 1)
        if (target !== indexRef.current) scrollTo(target)
      },
      prev: () => {
        const target = Math.max(0, indexRef.current - 1)
        if (target !== indexRef.current) scrollTo(target)
      },
    }),
    [indexRef, maxIndex, scrollTo],
  )

  const onPrev = useCallback(() => {
    enablePrefetch()
    const target = Math.max(0, indexRef.current - 1)
    if (target !== indexRef.current) scrollTo(target)
  }, [enablePrefetch, indexRef, scrollTo])

  const onNext = useCallback(() => {
    enablePrefetch()
    const target = Math.min(maxIndex, indexRef.current + 1)
    if (target !== indexRef.current) scrollTo(target)
  }, [enablePrefetch, indexRef, maxIndex, scrollTo])

  const wrapperMaxStyle = useMemo(() => {
    if (fullBleed) return null
    return {
      maxWidth: isMobile ? undefined : isTablet ? SLIDER_MAX_WIDTH.tablet : SLIDER_MAX_WIDTH.desktop,
      marginHorizontal: 'auto',
    } as any
  }, [fullBleed, isMobile, isTablet])

  const viewportTouchAction = useMemo(
    () => ({ touchAction: isMobile ? 'pan-y pinch-zoom' : 'pan-x' } as any),
    [isMobile],
  )

  if (!images.length) return null

  return (
    <View
      style={[styles.sliderStack, fillContainer && { height: '100%' }]}
      testID="slider-stack"
    >
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...dataSetSliderId}
        {...({ tabIndex: 0 } as any)}
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerHeight },
          isMobile && !fillContainer && styles.wrapperMobile,
          isTablet && !fillContainer && styles.wrapperTablet,
          wrapperMaxStyle,
        ]}
      >
        <View style={styles.clip} testID="slider-clip">
          <View
            ref={viewportRef}
            testID="slider-scroll"
            accessibilityRole="adjustable"
            accessibilityLabel="Галерея изображений"
            {...dataSetSliderId}
            style={[styles.carouselViewport, { height: containerHeight }, viewportTouchAction]}
          >
            <View
              ref={trackRef}
              style={[
                styles.carouselTrack,
                { width: trackWidth, height: containerHeight },
              ]}
            >
              {images.map((item, index) => {
                const distanceToCurrent = Math.abs(index - currentIndex)
                const allowNeighbourPreload =
                  layoutMeasured && (firstImageLoaded || currentIndex > 0 || isMobileDevice)
                const preloadPriority =
                  prefetchEnabled &&
                  (distanceToCurrent === 0 ||
                    (distanceToCurrent <= effectivePreloadCount && allowNeighbourPreload))
                const prepareBlur = layoutMeasured && blurBackground && distanceToCurrent <= 1
                const slideUri = index === currentIndex || layoutMeasured ? getUri(index) : ''

                return (
                  <View
                    key={`${String(item.id)}|${index}`}
                    testID={`slider-slide-${index}`}
                    {...({ dataSet: { testid: `slider-slide-${index}` } } as any)}
                    style={[
                      styles.slide,
                      { width: slideWidthStyle, height: containerHeight, zIndex: 1 },
                    ]}
                  >
                    <Slide
                      item={item}
                      index={index}
                      uri={slideUri}
                      containerW={slideMediaWidth}
                      slideHeight={containerHeight}
                      slideHeightPx={containerHeightPx}
                      imagesLength={imagesLen}
                      styles={styles}
                      blurBackground={blurBackground}
                      isActive={index === currentIndex}
                      imageProps={imageProps}
                      onFirstImageLoad={handleFirstImageLoad}
                      onImagePress={onImagePress}
                      firstImagePreloaded={firstImagePreloaded}
                      preloadPriority={preloadPriority}
                      fit={fit}
                      contentAspectRatio={contentAspectRatio ?? aspectRatio}
                      prepareBlur={prepareBlur}
                      skipImage={skipFirstSlideImage && index === 0}
                    />
                  </View>
                )
              })}
            </View>
          </View>
        </View>

        {controlsVisible && showArrows && imagesLen > 1 && (
          <NavArrows
            imagesLen={imagesLen}
            isMobile={isMobile}
            isTablet={isTablet}
            hideArrowsOnMobile={hideArrowsOnMobile}
            navOffset={navOffset}
            styles={styles}
            onPrev={onPrev}
            onNext={onNext}
          />
        )}

        {controlsVisible && imagesLen > 1 && (
          <View
            style={[styles.counter, isMobile && styles.counterMobile, POINTER_EVENTS_NONE]}
          >
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{imagesLen}
              </Text>
            </View>
          </View>
        )}

        {controlsVisible && showDots && imagesLen > 1 && (
          <PaginationDots
            total={imagesLen}
            currentIndex={currentIndex}
            isMobile={isMobile}
            styles={styles}
          />
        )}
      </View>
    </View>
  )
}

const SliderWeb = forwardRef(SliderWebComponent)
export default memo(SliderWeb)
