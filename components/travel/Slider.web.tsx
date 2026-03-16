import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import {
  View,
  LayoutChangeEvent,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import type { SliderProps, SliderRef } from './sliderParts/types';
import { buildUriWeb, SLIDER_MAX_WIDTH, DEFAULT_AR, MOBILE_HEIGHT_PERCENT, clamp } from './sliderParts/utils';
import { createSliderStyles, MAX_VISIBLE_DOTS } from './sliderParts/styles';
import Slide from './sliderParts/Slide';
import { getTouchGestureAxis } from './sliderParts/useWebScrollInteraction';
import { useSliderCore } from './sliderParts/useSliderCore';

export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

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

type GestureAxis = 'x' | 'y' | null;

interface DragState {
  pointerId: number | null;
  pointerType: string | null;
  startX: number;
  startY: number;
  baseOffset: number;
  lastX: number;
  lastTs: number;
  velocity: number;
  axis: GestureAxis;
  hasMoved: boolean;
}

const initialDragState = (): DragState => ({
  pointerId: null,
  pointerType: null,
  startX: 0,
  startY: 0,
  baseOffset: 0,
  lastX: 0,
  lastTs: 0,
  velocity: 0,
  axis: null,
  hasMoved: false,
});

const SliderWebComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createSliderStyles(colors), [colors]);

  const {
    images,
    showArrows = true,
    showDots = true,
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
  } = props;

  const sliderInstanceId = useId();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobileDevice = isPhone || isLargePhone;
  const effectivePreloadCount = isMobileDevice ? Math.max(preloadCountProp, 2) : preloadCountProp;
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
    setActiveIndex,
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
    buildUri: (img, w, h, isFirst) => buildUriWeb(img, w, h, fit, isFirst),
    deferWebPrefetchUntilInteraction: effectivePreloadCount < 1,
    handleAppState: false,
    includeUriMap: false,
  });

  const [layoutMeasured, setLayoutMeasured] = useState(false);
  const [measuredSlideWidth, setMeasuredSlideWidth] = useState<number | null>(null);
  const [, setLoadedSlideIndices] = useState<Set<number>>(
    () => new Set(firstImagePreloaded ? [0] : []),
  );
  const [transitionOverlayUri, setTransitionOverlayUri] = useState<string | null>(
    null,
  );
  const [transitionOverlayFading, setTransitionOverlayFading] = useState(false);

  const wrapperRef = useRef<any>(null);
  const viewportRef = useRef<any>(null);
  const trackRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const overlayRevealFrameRef = useRef<number | null>(null);
  const overlayFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStateRef = useRef<DragState>(initialDragState());
  const visualOffsetRef = useRef(0);
  const currentIndexRef = useRef(0);
  const loadedSlideIndicesRef = useRef<Set<number>>(new Set(firstImagePreloaded ? [0] : []));

  const computedH = coreContainerH;
  const containerH = fillContainer ? '100%' : computedH;
  const renderedSlideWidth = measuredSlideWidth ?? containerW;
  const maxIndex = Math.max(0, images.length - 1);
  const slideHeight = fillContainer ? '100%' : computedH;
  const imagesLen = images.length;
  const navOffset = isMobile ? 8 : isTablet ? 12 : Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0));

  useEffect(() => {
    const nextLoaded = new Set<number>(firstImagePreloaded ? [0] : []);
    loadedSlideIndicesRef.current = nextLoaded;
    setLoadedSlideIndices(nextLoaded);
    setTransitionOverlayUri(null);
    setTransitionOverlayFading(false);
    if (overlayFadeTimerRef.current) {
      clearTimeout(overlayFadeTimerRef.current);
      overlayFadeTimerRef.current = null;
    }
  }, [images, firstImagePreloaded]);

  const getDomNode = useCallback((target: unknown): HTMLElement | null => {
    if (!target) return null;
    if (target instanceof HTMLElement) return target;
    const anyTarget = target as Record<string, unknown>;
    if (anyTarget._nativeNode instanceof HTMLElement) return anyTarget._nativeNode;
    if (anyTarget._domNode instanceof HTMLElement) return anyTarget._domNode;
    if (typeof anyTarget.getNode === 'function') {
      const node = (anyTarget.getNode as () => unknown)();
      if (node instanceof HTMLElement) return node;
    }
    return null;
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const clearOverlayRevealFrame = useCallback(() => {
    if (overlayRevealFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(overlayRevealFrameRef.current);
      overlayRevealFrameRef.current = null;
    }
  }, []);

  const applyOffset = useCallback((offset: number, withTransition: boolean, durationMs = 280) => {
    const roundedOffset = Math.round(offset);
    const previousRoundedOffset = Math.round(visualOffsetRef.current);
    const trackNode = getDomNode(trackRef.current);
    if (!trackNode) {
      visualOffsetRef.current = offset;
      return;
    }
    if (!withTransition && previousRoundedOffset === roundedOffset) {
      return;
    }
    visualOffsetRef.current = offset;
    trackNode.style.transition = withTransition
      ? `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : 'none';
    trackNode.style.transform = `translate3d(${roundedOffset}px, 0, 0)`;
  }, [getDomNode]);

  const snapOffsetForIndex = useCallback((idx: number, widthOverride?: number) => {
    const width = widthOverride ?? containerWRef.current ?? renderedSlideWidth;
    return -clamp(idx, 0, maxIndex) * width;
  }, [containerWRef, maxIndex, renderedSlideWidth]);

  const animateToIndex = useCallback((idx: number, animated = true) => {
    const clampedIndex = clamp(idx, 0, maxIndex);
    const currentSlideIndex = currentIndexRef.current;
    const currentSlideLoaded = loadedSlideIndicesRef.current.has(currentSlideIndex);
    const targetSlideLoaded = loadedSlideIndicesRef.current.has(clampedIndex);
    if (
      clampedIndex !== currentSlideIndex &&
      currentSlideLoaded &&
      !targetSlideLoaded
    ) {
      setTransitionOverlayFading(false);
      setTransitionOverlayUri(getUri(currentSlideIndex));
      if (overlayFadeTimerRef.current) {
        clearTimeout(overlayFadeTimerRef.current);
        overlayFadeTimerRef.current = null;
      }
    } else if (targetSlideLoaded) {
      setTransitionOverlayUri(null);
      setTransitionOverlayFading(false);
    }
    const targetOffset = snapOffsetForIndex(clampedIndex);
    stopAnimation();
    applyOffset(targetOffset, animated);
    setActiveIndex(clampedIndex);
  }, [applyOffset, getUri, maxIndex, setActiveIndex, snapOffsetForIndex, stopAnimation]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    applyOffset(snapOffsetForIndex(currentIndex), false);
  }, [applyOffset, currentIndex, snapOffsetForIndex]);

  const syncWidthFromDom = useCallback(() => {
    const wrapperNode = getDomNode(wrapperRef.current);
    const width = wrapperNode?.getBoundingClientRect?.().width ?? 0;
    if (!Number.isFinite(width) || width <= 0) return;
    setMeasuredSlideWidth(width);
    setLayoutMeasured(true);
    setContainerWidth(width);
    applyOffset(snapOffsetForIndex(currentIndexRef.current, width), false);
  }, [applyOffset, currentIndexRef, getDomNode, setContainerWidth, snapOffsetForIndex]);

  useEffect(() => {
    syncWidthFromDom();
    const wrapperNode = getDomNode(wrapperRef.current);
    if (!wrapperNode) return;

    const canUseResizeObserver =
      typeof (globalThis as any).ResizeObserver !== 'undefined' &&
      typeof wrapperNode === 'object' &&
      wrapperNode.nodeType === 1;

    let observer: ResizeObserver | null = null;
    if (canUseResizeObserver) {
      observer = new ResizeObserver(() => syncWidthFromDom());
      observer.observe(wrapperNode);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncWidthFromDom);
    }

    return () => {
      observer?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncWidthFromDom);
      }
    };
  }, [getDomNode, syncWidthFromDom]);

  const scrollToDom = useCallback((idx: number, animated = true) => {
    animateToIndex(idx, animated);
  }, [animateToIndex]);

  useEffect(() => {
    setScrollToImpl(scrollToDom);
  }, [scrollToDom, setScrollToImpl]);

  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        const nextIndex = Math.min(maxIndex, currentIndexRef.current + 1);
        if (nextIndex !== currentIndexRef.current) scrollTo(nextIndex);
      },
      prev: () => {
        const prevIndex = Math.max(0, currentIndexRef.current - 1);
        if (prevIndex !== currentIndexRef.current) scrollTo(prevIndex);
      },
    }),
    [maxIndex, scrollTo],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setMeasuredSlideWidth(width);
    setContainerWidth(width);
    setLayoutMeasured(true);
    applyOffset(snapOffsetForIndex(indexRef.current, width), false);
  }, [applyOffset, indexRef, setContainerWidth, snapOffsetForIndex]);

  useEffect(() => {
    const viewportNode = getDomNode(viewportRef.current);
    const wrapperNode = getDomNode(wrapperRef.current);
    if (!viewportNode || !wrapperNode || typeof window === 'undefined') return;

    wrapperNode.setAttribute('tabindex', '0');

    const resetDrag = () => {
      const activePointerId = dragStateRef.current.pointerId;
      dragStateRef.current = initialDragState();
      viewportNode.style.cursor = '';
      viewportNode.style.userSelect = '';
      try {
        if (activePointerId != null) {
          viewportNode.releasePointerCapture(activePointerId);
        }
      } catch {
        // noop
      }
    };

    const beginPointer = (event: PointerEvent) => {
      if (imagesLen < 2) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      stopAnimation();
      pauseAutoplay();
      dismissSwipeHint();
      enablePrefetch();

      const baseOffset = snapOffsetForIndex(currentIndexRef.current);
      dragStateRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType || null,
        startX: event.clientX,
        startY: event.clientY,
        baseOffset,
        lastX: event.clientX,
        lastTs: performance.now(),
        velocity: 0,
        axis: event.pointerType === 'mouse' ? 'x' : null,
        hasMoved: false,
      };

      viewportNode.style.cursor = event.pointerType === 'mouse' ? 'grabbing' : '';
      viewportNode.style.userSelect = 'none';
      applyOffset(baseOffset, false);

      try {
        viewportNode.setPointerCapture(event.pointerId);
      } catch {
        // noop
      }
    };

    const movePointer = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId == null || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (drag.axis == null) {
        drag.axis = getTouchGestureAxis(deltaX, deltaY);
        if (drag.axis === 'y') {
          resumeAutoplay();
          resetDrag();
          return;
        }
        if (drag.axis == null) return;
      }

      if (drag.axis !== 'x') return;

      drag.hasMoved = true;
      event.preventDefault();
      const nextOffset = clamp(
        drag.baseOffset + deltaX,
        snapOffsetForIndex(maxIndex) - 36,
        36,
      );
      applyOffset(nextOffset, false);

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTs);
      drag.velocity = (event.clientX - drag.lastX) / dt;
      drag.lastX = event.clientX;
      drag.lastTs = now;
    };

    const endPointer = (event?: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId == null) return;
      if (event && drag.pointerId !== event.pointerId) return;

      const width = containerWRef.current || renderedSlideWidth || 1;
      const projectedOffset = visualOffsetRef.current + drag.velocity * Math.min(220, Math.max(120, width * 0.28));
      const targetIndex = clamp(Math.round(-projectedOffset / width), 0, maxIndex);
      const draggedHorizontally = drag.axis === 'x' && drag.hasMoved;

      resetDrag();
      if (draggedHorizontally) {
        animateToIndex(targetIndex, true);
      } else {
        applyOffset(snapOffsetForIndex(currentIndexRef.current), true, 200);
      }
      resumeAutoplay();
    };

    const handleLostPointerCapture = () => {
      if (dragStateRef.current.pointerId == null) return;
      resetDrag();
      applyOffset(snapOffsetForIndex(currentIndexRef.current), true, 200);
      resumeAutoplay();
    };

    viewportNode.addEventListener('pointerdown', beginPointer, { passive: true });
    viewportNode.addEventListener('pointermove', movePointer, { passive: false });
    viewportNode.addEventListener('pointerup', endPointer, { passive: true });
    viewportNode.addEventListener('pointercancel', endPointer, { passive: true });
    viewportNode.addEventListener('lostpointercapture', handleLostPointerCapture, { passive: true } as any);

    return () => {
      viewportNode.removeEventListener('pointerdown', beginPointer as EventListener);
      viewportNode.removeEventListener('pointermove', movePointer as EventListener);
      viewportNode.removeEventListener('pointerup', endPointer as EventListener);
      viewportNode.removeEventListener('pointercancel', endPointer as EventListener);
      viewportNode.removeEventListener('lostpointercapture', handleLostPointerCapture as EventListener);
      resetDrag();
    };
  }, [
    animateToIndex,
    applyOffset,
    containerWRef,
    dismissSwipeHint,
    enablePrefetch,
    getDomNode,
    imagesLen,
    maxIndex,
    pauseAutoplay,
    renderedSlideWidth,
    resumeAutoplay,
    scrollTo,
    snapOffsetForIndex,
    stopAnimation,
  ]);

  useEffect(() => {
    return () => {
      stopAnimation();
      clearOverlayRevealFrame();
      if (overlayFadeTimerRef.current) {
        clearTimeout(overlayFadeTimerRef.current);
      }
    };
  }, [clearOverlayRevealFrame, stopAnimation]);

  const handleSlideLoad = useCallback((index: number) => {
    setLoadedSlideIndices((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      loadedSlideIndicesRef.current = next;
      return next;
    });

    if (index === currentIndexRef.current && transitionOverlayUri) {
      if (overlayFadeTimerRef.current) {
        clearTimeout(overlayFadeTimerRef.current);
      }
      clearOverlayRevealFrame();

      const startOverlayFade = () => {
        setTransitionOverlayFading(true);
        overlayFadeTimerRef.current = setTimeout(() => {
          setTransitionOverlayUri(null);
          setTransitionOverlayFading(false);
          overlayFadeTimerRef.current = null;
        }, 140);
      };

      if (typeof window === 'undefined') {
        startOverlayFade();
      } else {
        overlayRevealFrameRef.current = window.requestAnimationFrame(() => {
          overlayRevealFrameRef.current = window.requestAnimationFrame(() => {
            overlayRevealFrameRef.current = null;
            startOverlayFade();
          });
        });
      }
    }
  }, [clearOverlayRevealFrame, transitionOverlayUri]);

  const viewportTouchAction = isMobile ? 'pan-y pinch-zoom' : 'pan-x';

  const onWrapperKeyDown = useCallback((event: any) => {
    if (imagesLen < 2) return;
    dismissSwipeHint();
    enablePrefetch();

    const key = typeof event?.key === 'string' ? event.key : '';
    if (key === 'ArrowLeft') {
      event?.preventDefault?.();
      scrollTo(Math.max(0, currentIndexRef.current - 1));
    } else if (key === 'ArrowRight') {
      event?.preventDefault?.();
      scrollTo(Math.min(maxIndex, currentIndexRef.current + 1));
    } else if (key === 'Home') {
      event?.preventDefault?.();
      scrollTo(0);
    } else if (key === 'End') {
      event?.preventDefault?.();
      scrollTo(maxIndex);
    }
  }, [dismissSwipeHint, enablePrefetch, imagesLen, maxIndex, scrollTo]);

  const onPrev = useCallback(() => {
    enablePrefetch();
    const target = Math.max(0, currentIndexRef.current - 1);
    if (target !== currentIndexRef.current) scrollTo(target);
  }, [enablePrefetch, scrollTo]);

  const onNext = useCallback(() => {
    enablePrefetch();
    const target = Math.min(maxIndex, currentIndexRef.current + 1);
    if (target !== currentIndexRef.current) scrollTo(target);
  }, [enablePrefetch, maxIndex, scrollTo]);

  if (!images.length) return null;

  return (
    <View style={[styles.sliderStack, fillContainer && { height: '100%' }]} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
        onLayout={onLayout}
        onKeyDown={Platform.OS === 'web' ? (onWrapperKeyDown as any) : undefined}
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
          {transitionOverlayUri ? (
            <View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 6,
                  opacity: transitionOverlayFading ? 0 : 1,
                  transition: 'opacity 140ms ease',
                } as any,
              ]}
            >
              <ImageCardMedia
                src={transitionOverlayUri}
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
            </View>
          ) : null}
          <View
            ref={viewportRef}
            testID="slider-scroll"
            accessibilityRole="adjustable"
            accessibilityLabel="Галерея изображений"
            {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
            style={[
              styles.carouselViewport,
              { height: containerH },
              ({ touchAction: viewportTouchAction } as any),
            ]}
          >
            <View
              ref={trackRef}
              style={[
                styles.carouselTrack,
                {
                  width: layoutMeasured ? renderedSlideWidth * imagesLen : `${imagesLen * 100}%`,
                  height: containerH,
                  transform: `translate3d(${Math.round(snapOffsetForIndex(currentIndex))}px, 0, 0)`,
                },
              ]}
            >
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
                        width: layoutMeasured ? renderedSlideWidth : '100%',
                        height: containerH,
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
                      blurBackground={blurBackground}
                      isActive={index === currentIndex}
                      imageProps={imageProps}
                      onFirstImageLoad={onFirstImageLoad}
                      onImagePress={onImagePress}
                      firstImagePreloaded={firstImagePreloaded}
                      preloadPriority={preloadPriority}
                      fit={fit}
                      onSlideLoad={handleSlideLoad}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {showArrows && imagesLen > 1 && (
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

        {imagesLen > 1 && (
          <View style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}>
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{imagesLen}
              </Text>
            </View>
          </View>
        )}

        {showDots && imagesLen > 1 && (
          <PaginationDots total={imagesLen} currentIndex={currentIndex} isMobile={isMobile} styles={styles} />
        )}
      </View>
    </View>
  );
};

const SliderWeb = forwardRef(SliderWebComponent);

export default memo(SliderWeb);
