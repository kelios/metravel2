import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  forwardRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import type { SliderProps, SliderRef } from './sliderParts/types';
import { buildUriWeb, SLIDER_MAX_WIDTH, DEFAULT_AR, MOBILE_HEIGHT_PERCENT } from './sliderParts/utils';
import { createSliderStyles, MAX_VISIBLE_DOTS } from './sliderParts/styles';
import Slide from './sliderParts/Slide';
import { useSliderCore } from './sliderParts/useSliderCore';
import { useSliderTrack } from './sliderParts/useSliderTrack';
import { useSliderTransitionOverlay } from './sliderParts/useSliderTransitionOverlay';
import { useSliderPointerDrag } from './sliderParts/useSliderPointerDrag';

export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

// ---------------------------------------------------------------------------
// Global hover styles (injected once)
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  const STYLE_ID = 'slider-web-carousel-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
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
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// NavArrows
// ---------------------------------------------------------------------------

interface NavArrowsProps {
  imagesLen: number;
  isMobile: boolean;
  isTablet: boolean;
  hideArrowsOnMobile?: boolean;
  navOffset: number;
  styles: Record<string, any>;
  onPrev: () => void;
  onNext: () => void;
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
  if (imagesLen < 2 || (isMobile && hideArrowsOnMobile)) return null;
  const iconSize = isMobile ? 16 : isTablet ? 18 : 20;
  const mobileWebVisibleStyle = isMobile
    ? ({
        opacity: 1,
        backgroundColor: 'rgba(0,0,0,0.42)',
        borderColor: 'rgba(255,255,255,0.28)',
      } as any)
    : null;

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous slide"
        onPress={onPrev}
        activeOpacity={0.9}
        style={[
          styles.navBtn,
          isMobile ? styles.navBtnMobile : isTablet ? styles.navBtnTablet : styles.navBtnDesktop,
          mobileWebVisibleStyle,
          { left: navOffset },
        ]}
        {...({ className: 'slider-nav-btn' } as any)}
      >
        <View style={styles.arrowIconContainer}>
          <Feather name="chevron-left" size={iconSize} color="rgba(255,255,255,0.95)" style={styles.arrowIcon} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next slide"
        onPress={onNext}
        activeOpacity={0.9}
        style={[
          styles.navBtn,
          isMobile ? styles.navBtnMobile : isTablet ? styles.navBtnTablet : styles.navBtnDesktop,
          mobileWebVisibleStyle,
          { right: navOffset },
        ]}
        {...({ className: 'slider-nav-btn' } as any)}
      >
        <View style={styles.arrowIconContainer}>
          <Feather name="chevron-right" size={iconSize} color="rgba(255,255,255,0.95)" style={styles.arrowIcon} />
        </View>
      </TouchableOpacity>
    </>
  );
});

// ---------------------------------------------------------------------------
// PaginationDots
// ---------------------------------------------------------------------------

interface PaginationDotsProps {
  total: number;
  currentIndex: number;
  isMobile: boolean;
  styles: Record<string, any>;
}

const PaginationDots = memo(function PaginationDots({ total, currentIndex, isMobile, styles }: PaginationDotsProps) {
  const dots = useMemo(() => {
    if (total <= MAX_VISIBLE_DOTS) {
      return Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
      ));
    }

    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    let windowStart = currentIndex - half;
    let windowEnd = currentIndex + half;

    if (windowStart < 0) {
      windowStart = 0;
      windowEnd = MAX_VISIBLE_DOTS - 1;
    }
    if (windowEnd >= total) {
      windowEnd = total - 1;
      windowStart = total - MAX_VISIBLE_DOTS;
    }

    return Array.from({ length: windowEnd - windowStart + 1 }, (_, offset) => {
      const i = windowStart + offset;
      const distFromActive = Math.abs(i - currentIndex);
      const isEdge = i === windowStart || i === windowEnd;
      const isActive = i === currentIndex;
      const dotStyle = isActive
        ? [styles.dot, styles.dotActive]
        : isEdge && distFromActive >= 2
          ? [styles.dot, styles.dotTiny]
          : distFromActive >= 2
            ? [styles.dot, styles.dotSmall]
            : [styles.dot];

      return <View key={i} style={dotStyle} />;
    });
  }, [currentIndex, styles.dot, styles.dotActive, styles.dotSmall, styles.dotTiny, total]);

  if (total < 2) return null;

  return (
    <View style={[styles.dots, isMobile && styles.dotsMobile, { pointerEvents: 'none' }]}>
      <View style={styles.dotsContainer}>{dots}</View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main slider component
// ---------------------------------------------------------------------------

const SliderWebComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createSliderStyles(colors), [colors]);

  const {
    images,
    showArrows = true,
    showDots = true,
    controlsVisible = true,
    hideArrowsOnMobile = true,
    aspectRatio = DEFAULT_AR,
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
  } = props;

  const sliderInstanceId = useId();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobileDevice = isPhone || isLargePhone;
  const effectivePreloadCount = isMobileDevice ? Math.max(preloadCountProp, 2) : preloadCountProp;

  const buildUri = useCallback(
    (img: any, w: number, h: number, isFirst: boolean) => buildUriWeb(img, w, h, fit, isFirst),
    [fit],
  );

  // --- Core state ---
  const {
    containerW,
    containerH: coreContainerH,
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
  });

  const computedH = coreContainerH;
  const containerH = fillContainer ? '100%' : computedH;
  const maxIndex = Math.max(0, images.length - 1);
  const slideHeight = fillContainer ? '100%' : computedH;
  const imagesLen = images.length;
  const navOffset = isMobile ? 8 : isTablet ? 12 : Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0));

  // --- Transition overlay ---
  const {
    overlayUri,
    overlayVisible,
    handleSlideLoad,
    onBeforeNavigate,
  } = useSliderTransitionOverlay({
    images,
    getUri,
    indexRef,
    currentIndex,
    blurBackground,
    firstImagePreloaded,
  });

  // --- Track animation + width ---
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
    onBeforeNavigate,
  });

  // --- Pointer drag + keyboard ---
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
    animateToIndex,
    stopAnimation,
    scrollTo,
    pauseAutoplay,
    resumeAutoplay,
    dismissSwipeHint,
    enablePrefetch,
  });

  // --- Wire scrollTo implementation ---
  const scrollToDom = useCallback(
    (idx: number, animated = true) => animateToIndex(idx, animated),
    [animateToIndex],
  );

  useEffect(() => {
    setScrollToImpl(scrollToDom);
  }, [scrollToDom, setScrollToImpl]);

  // --- Imperative ref ---
  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        const nextIndex = Math.min(maxIndex, indexRef.current + 1);
        if (nextIndex !== indexRef.current) scrollTo(nextIndex);
      },
      prev: () => {
        const prevIndex = Math.max(0, indexRef.current - 1);
        if (prevIndex !== indexRef.current) scrollTo(prevIndex);
      },
    }),
    [indexRef, maxIndex, scrollTo],
  );

  // --- Navigation callbacks ---
  const onPrev = useCallback(() => {
    enablePrefetch();
    const target = Math.max(0, indexRef.current - 1);
    if (target !== indexRef.current) scrollTo(target);
  }, [enablePrefetch, indexRef, scrollTo]);

  const onNext = useCallback(() => {
    enablePrefetch();
    const target = Math.min(maxIndex, indexRef.current + 1);
    if (target !== indexRef.current) scrollTo(target);
  }, [enablePrefetch, indexRef, maxIndex, scrollTo]);

  if (!images.length) return null;

  // --- Render ---
  return (
    <View style={[styles.sliderStack, fillContainer && { height: '100%' }]} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          isMobile && !fillContainer && styles.wrapperMobile,
          isTablet && !fillContainer && styles.wrapperTablet,
          !fullBleed
            ? ({
                maxWidth: isMobile ? undefined : isTablet ? SLIDER_MAX_WIDTH.tablet : SLIDER_MAX_WIDTH.desktop,
                marginHorizontal: 'auto',
              } as any)
            : null,
        ]}
      >
        <View style={styles.clip} testID="slider-clip">
          {/* Transition overlay — always mounted, visibility via CSS opacity.
              Covers viewport while the target slide's image is loading. */}
          <View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                inset: 0,
                zIndex: 6,
                opacity: overlayVisible ? 1 : 0,
                transition: 'opacity 300ms ease',
                willChange: overlayUri ? 'opacity' : 'auto',
              } as any,
            ]}
          >
            {overlayUri ? (
              <ImageCardMedia
                src={overlayUri}
                width={renderedSlideWidth}
                height={computedH}
                fit={fit}
                blurBackground={blurBackground}
                blurRadius={12}
                priority="high"
                loading="eager"
                transition={0}
                style={styles.img}
                showImmediately
                allowCriticalWebBlur={blurBackground}
              />
            ) : null}
          </View>

          {/* Carousel viewport + track */}
          <View
            ref={viewportRef}
            testID="slider-scroll"
            accessibilityRole="adjustable"
            accessibilityLabel="Галерея изображений"
            {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
            style={[
              styles.carouselViewport,
              { height: containerH },
              ({ touchAction: isMobile ? 'pan-y pinch-zoom' : 'pan-x' } as any),
            ]}
          >
            <View
              ref={trackRef}
              style={[
                styles.carouselTrack,
                {
                  width: imagesLen === 1 ? '100%' : (layoutMeasured ? renderedSlideWidth * imagesLen : `${imagesLen * 100}%`),
                  height: containerH,
                },
              ]}
            >
              {/* Blur backdrop slides — inside the track so they share the
                  same CSS transform and scroll perfectly in sync with photos. */}
              {blurBackground ? (
                <View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      flexDirection: 'row',
                      zIndex: 0,
                    } as any,
                  ]}
                >
                  {images.map((_, idx) => {
                    // Skip rendering first slide blur when LCP Hero overlay covers it
                    const shouldSkipImage = skipFirstSlideImage && idx === 0;
                    return (
                      <View
                        key={`blur-${idx}`}
                        pointerEvents="none"
                        style={[
                          {
                            width: imagesLen === 1 ? '100%' : (layoutMeasured ? renderedSlideWidth : `${100 / imagesLen}%`),
                            height: '100%',
                            flexShrink: 0,
                          },
                        ]}
                      >
                        {!shouldSkipImage && (
                          <ImageCardMedia
                            src={getUri(idx)}
                            width={renderedSlideWidth}
                            height={computedH}
                            fit={fit}
                            blurBackground
                            blurOnly
                            blurRadius={12}
                            priority={idx === 0 ? 'high' : 'low'}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            transition={0}
                            showImmediately={idx === 0}
                            allowCriticalWebBlur
                            style={styles.img}
                            testID={idx === 0 ? 'slider-shared-blur-backdrop' : undefined}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {images.map((item, index) => {
                const distanceToCurrent = Math.abs(index - currentIndex);
                const preloadPriority =
                  prefetchEnabled && distanceToCurrent <= (isMobile ? 2 : 1);

                return (
                  <View
                    key={`${String(item.id)}|${index}`}
                    testID={`slider-slide-${index}`}
                    {...({ dataSet: { testid: `slider-slide-${index}` } } as any)}
                    style={[
                      styles.slide,
                      {
                        width: imagesLen === 1 ? '100%' : (layoutMeasured ? renderedSlideWidth : '100%'),
                        height: containerH,
                        zIndex: 1,
                      },
                    ]}
                  >
                    <Slide
                      item={item}
                      index={index}
                      uri={getUri(index)}
                      containerW={renderedSlideWidth}
                      slideHeight={slideHeight}
                      slideHeightPx={computedH}
                      imagesLength={imagesLen}
                      styles={styles}
                      blurBackground={false}
                      isActive={index === currentIndex}
                      imageProps={imageProps}
                      onFirstImageLoad={onFirstImageLoad}
                      onImagePress={onImagePress}
                      firstImagePreloaded={firstImagePreloaded}
                      preloadPriority={preloadPriority}
                      fit={fit}
                      onSlideLoad={handleSlideLoad}
                      skipImage={skipFirstSlideImage && index === 0}
                    />
                  </View>
                );
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
          <View style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}>
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{imagesLen}
              </Text>
            </View>
          </View>
        )}

        {controlsVisible && showDots && imagesLen > 1 && (
          <PaginationDots total={imagesLen} currentIndex={currentIndex} isMobile={isMobile} styles={styles} />
        )}
      </View>
    </View>
  );
};

const SliderWeb = forwardRef(SliderWebComponent);

export default memo(SliderWeb);
