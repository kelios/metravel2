import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { useThemedColors } from '@/hooks/useTheme';
import { createSafeImageUrl } from '@/utils/travelMedia';
import {
  buildResponsiveImageProps,
  buildVersionedImageUrl,
} from '@/utils/imageOptimization';
import { markUriLoaded } from '@/components/travel/sliderParts/imageLoadCache';
import {
  getBackdropSegments,
  getContainedMediaBox,
} from '@/components/ui/webBlurBackdropLayout';

type ImgLike = {
  url: string;
  width?: number;
  height?: number;
  updated_at?: string | null;
  id?: number | string;
};

const buildVersioned = (url?: string, updated_at?: string | null, id?: any) =>
  createSafeImageUrl(url, updated_at, id);

const buildApiPrefixedUrl = (value: string): string | null => {
  try {
    const baseRaw =
      process.env.EXPO_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    if (!/\/api\/?$/i.test(baseRaw)) return null;
    const apiOrigin = baseRaw.replace(/\/api\/?$/, '');
    const parsed = new URL(value, apiOrigin);
    if (parsed.pathname.startsWith('/api/')) return null;
    return `${apiOrigin}/api${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

export const OVERLAY_TRANSITION_MS = 320;

export const NeutralHeroPlaceholder: React.FC<{ height?: number; variant?: 'loading' | 'error' }> = ({ height, variant = 'loading' }) => {
  const colors = useThemedColors();
  const isError = variant === 'error';
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          width: '100%',
          height: height ? `${height}px` : '100%',
          borderRadius: 12,
          backgroundColor: colors.backgroundSecondary,
          opacity: isError ? 1 : 0,
          animation: isError ? undefined : 'fadeInPlaceholder 0.2s ease-in 0.15s forwards',
        }}
        aria-hidden="true"
        data-testid="travel-hero-neutral-placeholder"
      />
    );
  }
  return (
    <View
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        backgroundColor: colors.backgroundSecondary,
      }}
    />
  );
};

function OptimizedLCPHeroInner({
  img,
  alt,
  onLoad,
  height,
  isMobile,
  containerWidth,
}: {
  img: ImgLike;
  alt?: string;
  onLoad?: () => void;
  height?: number;
  isMobile?: boolean;
  containerWidth?: number | null;
}) {
  const [loadError, setLoadError] = useState(false);
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
  const [didTryApiPrefix, setDidTryApiPrefix] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const didNotifyLoadRef = useRef(false);
  const colors = useThemedColors();

  const baseSrc = buildVersionedImageUrl(
    buildVersioned(img.url, img.updated_at ?? null, img.id),
    img.updated_at ?? null,
    img.id,
  );
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9;
  const lcpMaxWidth = isMobile ? 720 : 1280;
  const lcpWidths = isMobile ? [320, 480, 640, 720] : [720, 960, 1280];
  const targetWidth = lcpMaxWidth;

  const responsive = buildResponsiveImageProps(baseSrc, {
    maxWidth: targetWidth,
    widths: lcpWidths,
    quality: isMobile ? 72 : 82,
    format: 'auto',
    fit: 'contain',
    sizes: isMobile ? '100vw' : '(max-width: 1024px) 92vw, 720px',
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = imgRef.current;
    if (!el) return;
    try {
      (el as any).fetchPriority = 'high';
      el.setAttribute('fetchPriority', 'high');
    } catch {
      /* noop */
    }

    // Add preconnect for image domain to speed up loading
    if (typeof document !== 'undefined' && baseSrc) {
      try {
        const url = new URL(baseSrc);
        const origin = url.origin;
        if (origin && origin !== window.location.origin) {
          const existingPreconnect = document.querySelector(`link[rel="preconnect"][href="${origin}"]`);
          if (!existingPreconnect) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = origin;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
          }
        }
      } catch {
        /* noop */
      }
    }
  }, [baseSrc]);

  const srcWithRetry = overrideSrc || responsive.src || baseSrc;
  const fixedHeight = height ? `${Math.round(height)}px` : '100%';
  const backdropBox = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (typeof height !== 'number' || height <= 0) return null;

    const resolvedWidth =
      typeof containerWidth === 'number' && containerWidth > 0
        ? containerWidth
        : targetWidth;

    return getContainedMediaBox({
      containerWidth: resolvedWidth,
      containerHeight: height,
      contentAspectRatio: ratio,
    });
  }, [containerWidth, height, ratio, targetWidth]);
  const backdropSegments = useMemo(() => {
    if (Platform.OS !== 'web') return [];
    if (typeof height !== 'number' || height <= 0) return [];

    const resolvedWidth =
      typeof containerWidth === 'number' && containerWidth > 0
        ? containerWidth
        : targetWidth;

    return getBackdropSegments({
      containerWidth: resolvedWidth,
      containerHeight: height,
      contentBox: backdropBox,
    });
  }, [backdropBox, containerWidth, height, targetWidth]);

  const notifyReady = useCallback(async () => {
    if (didNotifyLoadRef.current) return;

    if (Platform.OS === 'web') {
      const el = imgRef.current;
      if (!el || !el.complete || el.naturalWidth <= 0) return;

      if (typeof el.decode === 'function') {
        try {
          // iOS Safari can hang on decode() indefinitely for certain images
          // (progressive JPEGs, memory pressure). Race with a timeout so we
          // don't block the LCP→slider transition forever.
          const DECODE_TIMEOUT_MS = 2000;
          await Promise.race([
            el.decode(),
            new Promise<void>((resolve) => setTimeout(resolve, DECODE_TIMEOUT_MS)),
          ]);
        } catch {
          // Browsers may reject decode() for already-decoded/cached images.
        }
      }

      if (!el.complete || el.naturalWidth <= 0 || didNotifyLoadRef.current) return;

      // Mark URI as loaded so Slider knows this image is already cached
      markUriLoaded(srcWithRetry);
    }

    didNotifyLoadRef.current = true;
    onLoad?.();
  }, [onLoad, srcWithRetry]);

  // On client-side (SPA) navigation between travels the same hero instance is
  // reused (it has no `key`), so per-image state survives the swap. Left as-is,
  // `didNotifyLoadRef` stays `true` from the previous travel and short-circuits
  // `notifyReady` — the new hero's onLoad/cache-hit never releases the LCP gate,
  // and the skeleton overlay hangs over already-painted content (white screen).
  // Reset the load-notify guard and the per-image error/fallback state whenever
  // the underlying image changes so the new hero behaves like a fresh mount.
  useEffect(() => {
    didNotifyLoadRef.current = false;
    setOverrideSrc(null);
    setDidTryApiPrefix(false);
    setLoadError(false);
  }, [baseSrc]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = imgRef.current;
    if (!el || !el.complete || el.naturalWidth <= 0) return;
    void notifyReady();
  }, [notifyReady, srcWithRetry]);

  if (!srcWithRetry) return <NeutralHeroPlaceholder height={height} />;

  if (Platform.OS !== 'web') return <NeutralHeroPlaceholder height={height} />;

  return (
    <div
      style={{
        width: '100%',
        height: fixedHeight,
        ...(height ? { minHeight: fixedHeight } : null),
      }}
    >
      {loadError ? (
        <NeutralHeroPlaceholder height={height} variant="error" />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: colors.backgroundSecondary,
          }}
        >
          {backdropSegments.length > 0 ? (
            <>
              {backdropSegments.map((segment, index) => (
                <div
                  key={`${index}-${segment.left}-${segment.top}-${segment.width}-${segment.height}`}
                  aria-hidden="true"
                  data-hero-backdrop="true"
                  data-hero-backdrop-segment="true"
                  data-hero-backdrop-layer="true"
                  className="travel-lcp-hero-backdrop-segment"
                  style={{
                    position: 'absolute',
                    top: segment.top,
                    left: segment.left,
                    width: segment.width,
                    height: segment.height,
                    zIndex: 0,
                    backgroundImage: `url("${srcWithRetry.replace(/"/g, '\\"')}")`,
                    opacity: 1,
                  }}
                />
              ))}
            </>
          ) : null}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              backgroundColor: 'rgba(7,12,19,0.24)',
              pointerEvents: 'none',
            }}
            data-hero-backdrop-overlay="true"
          />
          <img
            src={srcWithRetry}
            srcSet={responsive.srcSet}
            sizes={responsive.sizes}
            alt={alt || 'Фотография маршрута путешествия'}
            width={img.width || 1200}
            height={img.height || Math.round(1200 / ratio)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              width: '100%',
              height: '100%',
              minWidth: 0,
              minHeight: 0,
              maxWidth: 'none',
              maxHeight: 'none',
              display: 'block',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            ref={imgRef as any}
            referrerPolicy="no-referrer-when-downgrade"
            data-lcp
            onLoad={() => {
              void notifyReady();
            }}
            onError={() => {
              if (!didTryApiPrefix) {
                const fallback = buildApiPrefixedUrl(srcWithRetry);
                if (fallback) {
                  setDidTryApiPrefix(true);
                  setOverrideSrc(fallback);
                  return;
                }
                setDidTryApiPrefix(true);
              }
              setLoadError(true);
              onLoad?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

export const OptimizedLCPHero = React.memo(OptimizedLCPHeroInner);
export default OptimizedLCPHero;
