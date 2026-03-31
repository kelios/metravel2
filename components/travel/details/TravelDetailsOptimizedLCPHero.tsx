import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
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

export const NeutralHeroPlaceholder: React.FC<{ height?: number }> = ({ height }) => {
  const colors = useThemedColors();
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          width: '100%',
          height: height ? `${height}px` : '100%',
          borderRadius: 12,
          backgroundColor: colors.backgroundSecondary,
          opacity: 0,
          animation: 'fadeInPlaceholder 0.2s ease-in 0.15s forwards',
        }}
        aria-hidden="true"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeInPlaceholder {
            to { opacity: 1; }
          }
        `}} />
      </div>
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
  const lcpMaxWidth = isMobile ? 400 : 720;
  const lcpWidths = isMobile ? [320, 400] : [480, 720];
  const targetWidth =
    typeof window !== 'undefined'
      ? Math.min(window.innerWidth || lcpMaxWidth, lcpMaxWidth)
      : lcpMaxWidth;

  const responsive = buildResponsiveImageProps(baseSrc, {
    maxWidth: targetWidth,
    widths: lcpWidths,
    quality: isMobile ? 35 : 45,
    format: 'auto',
    fit: 'contain',
    dpr: isMobile ? 1 : 1.5,
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
          await el.decode();
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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = imgRef.current;
    if (!el || !el.complete || el.naturalWidth <= 0) return;
    void notifyReady();
  }, [notifyReady, srcWithRetry]);

  if (!srcWithRetry) return <NeutralHeroPlaceholder height={height} />;

  if (Platform.OS !== 'web') {
    return (
      <View style={{ width: '100%', height: '100%' }}>
        {loadError ? (
          <NeutralHeroPlaceholder height={height} />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <ImageCardMedia
              src={srcWithRetry}
              fit="contain"
              blurBackground
              allowCriticalWebBlur
              blurRadius={12}
              cachePolicy="memory-disk"
              priority="high"
              borderRadius={12}
              overlayColor={colors.surfaceMuted}
              imageProps={{ contentPosition: 'center' }}
              onLoad={() => {
                setLoadError(false);
                onLoad?.();
              }}
              onError={() => setLoadError(true)}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: fixedHeight,
        ...(height ? { minHeight: fixedHeight } : null),
      }}
    >
      {loadError ? (
        <NeutralHeroPlaceholder height={height} />
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
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes fadeInBackdrop {
              to { opacity: 0.9; }
            }
          `}} />
          {backdropSegments.length > 0 ? (
            <>
              {backdropSegments.map((segment, index) => (
                <div
                  key={`${index}-${segment.left}-${segment.top}-${segment.width}-${segment.height}`}
                  aria-hidden="true"
                  data-hero-backdrop="true"
                  data-hero-backdrop-segment="true"
                  data-hero-backdrop-layer="true"
                  style={{
                    position: 'absolute',
                    top: segment.top,
                    left: segment.left,
                    width: segment.width,
                    height: segment.height,
                    zIndex: 0,
                    backgroundImage: `url("${srcWithRetry.replace(/"/g, '\\"')}")`,
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'cover',
                    filter: 'blur(18px)',
                    transform: 'scale(1.08)',
                    transformOrigin: 'center',
                    opacity: 0,
                    transition: 'opacity 0.25s ease-in',
                    animation: 'fadeInBackdrop 0.3s ease-in 0.05s forwards',
                    pointerEvents: 'none',
                  }}
                />
              ))}
            </>
          ) : (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("${srcWithRetry.replace(/"/g, '\\"')}")`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
                filter: 'blur(18px)',
                transform: 'scale(1.08)',
                opacity: 0,
                transition: 'opacity 0.25s ease-in',
                animation: 'fadeInBackdrop 0.3s ease-in 0.05s forwards',
              }}
              data-hero-backdrop="true"
            />
          )}
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
              display: 'block',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
            loading="eager"
            decoding="auto"
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
