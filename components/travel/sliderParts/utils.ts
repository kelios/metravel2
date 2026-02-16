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
export const MOBILE_HEIGHT_PERCENT = 0.6;

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
      const cappedWidth = Math.min(containerWidth, 720);
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

export const FIRST_SLIDE_URI_CACHE = new Map<string, string>();
export const FIRST_SLIDE_URI_CACHE_MAX = 50;

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
    const cappedWidth = Math.min(containerWidth, 960);
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
    winH: number;
    insetsTop: number;
    insetsBottom: number;
    mobileHeightPercent: number;
    firstAR: number;
  },
) => {
  if (!opts.imagesLength) return 0;
  if (opts.isMobile) {
    const viewportH = Math.max(0, opts.winH);
    const targetH = viewportH * opts.mobileHeightPercent;
    const safeMax = Math.max(
      targetH,
      viewportH - (opts.insetsTop || 0) - (opts.insetsBottom || 0),
    );
    return clamp(targetH, 280, safeMax || targetH);
  }
  const targetH = opts.winH * 0.7;
  const h = w / opts.firstAR;
  return clamp(Math.max(h, targetH), 320, opts.winH * 0.75);
};
