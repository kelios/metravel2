import { Platform } from 'react-native';
import { METRICS } from '@/constants/layout';
import {
  buildVersionedImageUrl,
  getOptimalImageSize,
  getPreferredImageFormat,
  optimizeImageUrl,
} from '@/utils/imageOptimization';
import { buildResponsiveImagePropsFromMedia } from '@/utils/travelMediaVariants';
import type { SliderImage } from './types';

export const DEFAULT_AR = 16 / 9;
export const DOT_SIZE = 6;
export const DOT_ACTIVE_SIZE = 24;
export const NAV_BTN_OFFSET = 16;
export const MOBILE_HEIGHT_PERCENT = 0.7;

/** Max container width per breakpoint (used for maxWidth + image optimization caps) */
export const SLIDER_MAX_WIDTH = {
  mobile: 768,
  tablet: 960,
  desktop: 1280,
} as const;

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(v)));

/**
 * Fraction of the slide width a finger drag must cover (without a flick) to
 * advance one slide. Standard carousels use ~25-33%; 30% feels natural on touch.
 */
export const SWIPE_DISTANCE_THRESHOLD_RATIO = 0.3;

/**
 * Minimum |velocity| (px/ms) that counts as a flick regardless of distance.
 * Tuned for touch: a deliberate flick easily clears this while a slow drag stays
 * below it, so a gentle hold-and-release snaps back.
 */
export const SWIPE_FLICK_VELOCITY = 0.3;

export interface ResolveSwipeTargetParams {
  currentIndex: number;
  /** Live track offset at release (negative = scrolled forward). */
  visualOffset: number;
  /** Drag velocity in px/ms (negative = moving left / towards next slide). */
  velocity: number;
  /** Measured slide width (same width snapOffsetForIndex uses). */
  width: number;
  maxIndex: number;
}

/**
 * Resolve which slide a horizontal swipe should land on.
 *
 * The target is anchored to the CURRENT index ±1 (one swipe = at most one slide)
 * instead of an absolute round across the whole track, so a swipe never snaps
 * back to the current slide unless the gesture was genuinely small.
 *
 * A swipe advances when EITHER the drag covered more than
 * `SWIPE_DISTANCE_THRESHOLD_RATIO` of a slide OR the release velocity is a flick
 * (`|velocity| >= SWIPE_FLICK_VELOCITY`) in the matching direction.
 */
export const resolveSwipeTargetIndex = ({
  currentIndex,
  visualOffset,
  velocity,
  width,
  maxIndex,
}: ResolveSwipeTargetParams): number => {
  const safeWidth = width > 0 ? width : 1;
  // Offset of the current slide's resting position (negative).
  const currentOffset = -clamp(currentIndex, 0, maxIndex) * safeWidth;
  // How far we dragged from the current slide. Positive = towards previous
  // (finger moved right), negative = towards next (finger moved left).
  const dragDelta = visualOffset - currentOffset;
  const distanceRatio = Math.abs(dragDelta) / safeWidth;

  const isFlick = Math.abs(velocity) >= SWIPE_FLICK_VELOCITY;
  const passedDistance = distanceRatio >= SWIPE_DISTANCE_THRESHOLD_RATIO;

  if (!isFlick && !passedDistance) {
    return clampInt(currentIndex, 0, maxIndex);
  }

  // Determine direction. A flick wins on its own sign; otherwise the drag sign.
  const direction = isFlick
    ? velocity < 0
      ? 1
      : -1
    : dragDelta < 0
      ? 1
      : -1;

  return clampInt(currentIndex + direction, 0, maxIndex);
};

export interface SliderViewportFlags {
  isMobile: boolean;
  isTablet: boolean;
}

export const getSliderViewportFlags = (width: number): SliderViewportFlags => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const { tablet, largeTablet } = METRICS.breakpoints;

  return {
    isMobile: safeWidth >= 0 && safeWidth < tablet,
    isTablet: safeWidth >= tablet && safeWidth < largeTablet,
  };
};

/* ---- Native buildUri (used by Slider.tsx) ---- */

export const buildUriNative = (
  img: SliderImage,
  containerWidth?: number,
  containerHeight?: number,
  isFirst: boolean = false,
) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);
  const isWeb = Platform.OS === 'web';

  if (containerWidth && img.width && img.height) {
    if (isWeb) {
      const cappedWidth = Math.min(containerWidth, SLIDER_MAX_WIDTH.tablet);
      const quality = isFirst ? 45 : 35;
      return (
        optimizeImageUrl(versionedUrl, {
          width: cappedWidth,
          quality,
          fit: 'contain',
        }) || versionedUrl
      );
    }
    const aspectRatio = img.width / img.height;
    const optimalSize = getOptimalImageSize(
      containerWidth,
      containerHeight,
      aspectRatio,
    );
    const quality = isFirst ? 75 : 70;
    // getOptimalImageSize uses full device DPR on native, so a DPR-3 phone
    // requests a ~1280px neighbour and decodes it on-device, stalling swipe
    // 1→2. Cap neighbours to dpr 2; the active/first slide keeps full DPR.
    const width = isFirst
      ? optimalSize.width
      : Math.min(optimalSize.width, Math.round(containerWidth * 2));
    return (
      optimizeImageUrl(versionedUrl, {
        width,
        quality,
        fit: 'contain',
      }) || versionedUrl
    );
  }

  return versionedUrl;
};

/* ---- Web buildUri (used by Slider.web.tsx) ---- */

// Compute preferred format once at module level (never changes at runtime)
const PREFERRED_FORMAT =
  Platform.OS === 'web' ? getPreferredImageFormat() : undefined;

export const buildUriWeb = (
  img: SliderImage,
  containerWidth?: number,
  _containerHeight?: number,
  fit: 'contain' | 'cover' = 'contain',
  isFirst: boolean = false,
) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);
  const fitForUrl: 'contain' | 'cover' = fit === 'cover' ? 'contain' : fit;
  const effectiveDevicePixelRatio =
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;

  if (containerWidth) {
    const isMobileWidth = containerWidth <= SLIDER_MAX_WIDTH.mobile;
    const maxWidth = isFirst
      ? isMobileWidth
        ? 720
        : SLIDER_MAX_WIDTH.desktop
      : isMobileWidth
        ? SLIDER_MAX_WIDTH.mobile
        : SLIDER_MAX_WIDTH.desktop;
    const targetWidth = isFirst ? maxWidth : Math.min(containerWidth, maxWidth);
    const quality = isFirst
      ? isMobileWidth
        ? 72
        : 82
      : isMobileWidth
        ? 78
        : 78;
    const fromMedia = buildResponsiveImagePropsFromMedia(img.media, {
      maxWidth: targetWidth,
      widths: [320, 640, 720, 960, 1280],
      sizes: isMobileWidth ? '100vw' : '(max-width: 1280px) 100vw, 1280px',
    });
    if (fromMedia?.src) return fromMedia.src;

    const format = isFirst ? undefined : PREFERRED_FORMAT;
    // Neighbour slides don't need full device DPR — a contain+blur photo that's
    // only the swipe-target reveals imperceptibly sharper at dpr 3, but the
    // decode cost of the ~1.5× larger image stalls swipe 1→2 on mobile CPUs.
    // Cap mobile neighbours to dpr 2; first slide + desktop keep full DPR.
    const dpr = isFirst
      ? undefined
      : isMobileWidth
        ? Math.min(effectiveDevicePixelRatio, 2)
        : effectiveDevicePixelRatio;
    return (
      optimizeImageUrl(versionedUrl, {
        width: targetWidth,
        dpr,
        format,
        quality,
        fit: fitForUrl,
      }) || versionedUrl
    );
  }

  return versionedUrl;
};

/* ---- Shared computeHeight ---- */

export const computeSliderHeight = (
  w: number,
  opts: {
    imagesLength: number;
    isMobile: boolean;
    isTablet?: boolean;
    winH: number;
    insetsTop: number;
    insetsBottom: number;
    mobileHeightPercent: number;
    firstAR: number;
  },
) => {
  if (!opts.imagesLength) return 0;

  const ar = opts.firstAR || DEFAULT_AR;
  const arDriven = w / ar;

  if (opts.isMobile) {
    const viewportH = Math.max(0, opts.winH);
    const mobileH = viewportH * opts.mobileHeightPercent;
    return clamp(mobileH, 200, viewportH);
  }

  if (opts.isTablet) {
    const maxH = opts.winH * 0.7;
    return clamp(arDriven, 350, maxH);
  }

  // Desktop
  const maxH = opts.winH * 0.7;
  return clamp(arDriven, 400, maxH);
};
