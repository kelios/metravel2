import { Platform } from 'react-native';
import {
  buildVersionedImageUrl,
  getOptimalImageSize,
  getPreferredImageFormat,
  optimizeImageUrl,
} from '@/utils/imageOptimization';
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
          dpr: 1,
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
    return (
      optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
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

  if (containerWidth) {
    const cappedWidth = Math.min(containerWidth, SLIDER_MAX_WIDTH.desktop);
    const quality = isFirst ? 55 : 65;
    return (
      optimizeImageUrl(versionedUrl, {
        width: cappedWidth,
        format: PREFERRED_FORMAT,
        quality,
        fit: fitForUrl,
        dpr: 1,
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
    const maxH = viewportH * opts.mobileHeightPercent;
    return clamp(arDriven, 200, maxH);
  }

  if (opts.isTablet) {
    const maxH = opts.winH * 0.75;
    return clamp(arDriven, 350, maxH);
  }

  // Desktop
  const maxH = opts.winH * 0.85;
  return clamp(arDriven, 400, maxH);
};
