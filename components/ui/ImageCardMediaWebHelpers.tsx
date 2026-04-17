import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ContainedMediaBox } from '@/components/ui/webBlurBackdropLayout';
import { getBackdropSegments } from '@/components/ui/webBlurBackdropLayout';

export type Priority = 'low' | 'normal' | 'high';

export const loadedWebImageBaseCache = new Set<string>();

export const resolveBaseImageKey = (value: string | null | undefined): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^(data:|blob:)/i.test(raw)) return raw;

  try {
    const url = new URL(raw, 'https://metravel.by');
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw.split('?')[0] || raw;
  }
};

export const hasOptimizationParams = (value: string | null | undefined): boolean => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return false;

  try {
    const url = new URL(raw, 'https://metravel.by');
    return ['w', 'h', 'q', 'fit', 'f', 'output'].some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
};

export const isIOSSafariUserAgent = (userAgent: string, maxTouchPoints = 0): boolean => {
  const normalizedUserAgent = String(userAgent || '');
  const isIOSDevice = /iPad|iPhone|iPod/i.test(normalizedUserAgent) || (
    /Macintosh/i.test(normalizedUserAgent) && maxTouchPoints > 1
  );
  const isSafari = /Safari/i.test(normalizedUserAgent) &&
    !/(Chrome|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Chromium|Firefox)/i.test(normalizedUserAgent);

  return isIOSDevice && isSafari;
};

export const isIOSSafariWeb = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = String(navigator.userAgent || '');
  const maxTouchPoints = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  return isIOSSafariUserAgent(userAgent, maxTouchPoints);
};

type WebMainImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  borderRadius: number;
  loading: 'lazy' | 'eager';
  priority: Priority;
  hasBlurBehind: boolean;
  loaded: boolean;
  srcSet?: string;
  sizes?: string;
  onLoad?: (resolvedSrc: string) => void;
  onError?: () => void;
  showImmediately?: boolean;
};

export const WebMainImage = memo(function WebMainImage({
  src,
  alt,
  width,
  height,
  fit,
  borderRadius,
  loading,
  priority,
  hasBlurBehind,
  loaded,
  srcSet,
  sizes,
  onLoad,
  onError,
  showImmediately = false,
}: WebMainImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const handleLoad = useCallback(() => {
    const resolvedSrc = imgRef.current?.currentSrc || src;
    onLoad?.(resolvedSrc);
  }, [onLoad, src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !loaded) {
      handleLoad();
    }
  }, [src, loaded, handleLoad]);

  return (
    <img
      ref={imgRef}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        objectFit: fit === 'cover' ? 'cover' : 'contain',
        objectPosition: 'center',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        zIndex: 1,
        borderRadius,
        display: 'block',
        opacity: showImmediately || loaded ? 1 : 0,
        transition: hasBlurBehind && !showImmediately ? 'opacity 0.2s ease' : 'none',
        willChange: hasBlurBehind && !showImmediately ? 'opacity' : 'auto',
        contain: 'layout',
      }}
      loading={loading}
      decoding="auto"
      // @ts-ignore -- fetchPriority is a valid img attribute in browsers and not in React DOM typings yet
      fetchPriority={priority === 'high' ? 'high' : 'auto'}
      onLoad={handleLoad}
      onError={onError}
    />
  );
});

type WebBlurBackdropProps = {
  src: string;
  alt?: string;
  width: number;
  height: number;
  borderRadius: number;
  fit: 'contain' | 'cover';
  useCssBackdrop?: boolean;
  visible?: boolean;
  contentBox?: ContainedMediaBox | null;
};

export const WebBlurBackdrop = memo(function WebBlurBackdrop({
  src,
  alt = '',
  width,
  height,
  borderRadius,
  fit,
  useCssBackdrop = false,
  visible = true,
  contentBox = null,
}: WebBlurBackdropProps) {
  const hasPreBlurredSource = /(?:\?|&)blur=\d+(?:&|$)/i.test(src);
  const backdropFit = 'cover';
  const backdropScale = fit === 'contain' ? 1.08 : 1.12;
  const backdropFilter = hasPreBlurredSource
    ? 'saturate(1.08)'
    : fit === 'contain'
      ? 'blur(20px) saturate(1.04)'
      : 'blur(24px) saturate(1.15)';
  const backdropSegments = useMemo(
    () =>
      useCssBackdrop && fit === 'contain'
        ? getBackdropSegments({
            containerWidth: width,
            containerHeight: height,
            contentBox,
          })
        : [],
    [contentBox, fit, height, useCssBackdrop, width]
  );
  const shouldSplitBackdrop = useCssBackdrop && backdropSegments.length > 0;

  if (shouldSplitBackdrop) {
    return (
      <>
        {backdropSegments.map((segment, index) => (
          <div
            key={`${index}-${segment.left}-${segment.top}-${segment.width}-${segment.height}`}
            aria-hidden="true"
            data-blur-backdrop="true"
            data-blur-backdrop-segment="true"
            data-blur-backdrop-layer="true"
            style={{
              position: 'absolute',
              top: segment.top,
              left: segment.left,
              width: segment.width,
              height: segment.height,
              zIndex: 0,
              borderRadius,
              backgroundImage: `url("${src.replace(/"/g, '\\"')}")`,
              backgroundSize: backdropFit,
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              filter: backdropFilter,
              transform: `scale(${backdropScale})`,
              transformOrigin: 'center',
              opacity: visible ? 0.95 : 0,
              contain: 'paint',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              pointerEvents: 'none',
              transition: 'opacity 0.15s ease-in',
            }}
          />
        ))}
      </>
    );
  }

  if (useCssBackdrop) {
    return (
      <div
        aria-hidden="true"
        data-blur-backdrop="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          minWidth: '100%',
          minHeight: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          display: 'block',
          zIndex: 0,
          borderRadius,
          transform: `translate(-50%, -50%) scale(${backdropScale})`,
          backgroundImage: `url("${src.replace(/"/g, '\\"')}")`,
          backgroundSize: backdropFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: backdropFilter,
          opacity: visible ? 0.95 : 0,
          contain: 'paint',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          pointerEvents: 'none',
          transition: 'opacity 0.15s ease-in',
        }}
      />
    );
  }

  const loading = fit === 'contain' ? 'lazy' : 'eager';
  const fetchPriority = fit === 'contain' ? 'low' : 'auto';

  const targetOpacity = visible ? '1' : '0';

  return (
    <img
      ref={(img) => {
        if (img && img.complete && img.naturalWidth > 0) {
          img.style.opacity = targetOpacity;
        }
      }}
      aria-hidden="true"
      data-blur-backdrop="true"
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100%',
        height: '100%',
        minWidth: '100%',
        minHeight: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        display: 'block',
        objectFit: backdropFit,
        objectPosition: 'center',
        zIndex: 0,
        borderRadius,
        transform: `translate(-50%, -50%) scale(${backdropScale})`,
        filter: backdropFilter,
        opacity: 0,
        contain: 'paint',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        pointerEvents: 'none',
        transition: 'opacity 0.15s ease-in',
      }}
      loading={loading}
      decoding="async"
      // @ts-ignore -- fetchPriority is a valid img attribute in browsers and not in React DOM typings yet
      fetchPriority={fetchPriority}
      onLoad={(e) => {
        const img = e.currentTarget;
        img.style.opacity = targetOpacity;
      }}
    />
  );
});
