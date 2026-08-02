import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import type { TravelMediaImage } from '@/types/types';
import { IMAGE_QUALITY, IMAGE_WIDTHS } from '@/constants/imageContract';
import { useThemedColors } from '@/hooks/useTheme';
import { createSafeImageUrl } from '@/utils/travelMedia';
import { buildVersionedImageUrl } from '@/utils/imageOptimization';
import {
  buildResponsiveImagePropsPreferringMedia,
  getMediaPlaceholderData,
} from '@/utils/travelMediaVariants';
import { ImageDataPlaceholder } from '@/components/ui/ImageCardMedia';
import { markUriLoaded } from '@/components/travel/sliderParts/imageLoadCache';
import { translate as i18nT } from '@/i18n';

type ImgLike = {
  url: string;
  caption?: string;
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
  caption,
  onLoad,
  height,
  isMobile,
  media,
}: {
  img: ImgLike;
  alt?: string;
  caption?: string;
  onLoad?: () => void;
  height?: number;
  isMobile?: boolean;
  media?: TravelMediaImage | null;
}) {
  const [loadError, setLoadError] = useState(false);
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
  const [didTryApiPrefix, setDidTryApiPrefix] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const didNotifyLoadRef = useRef(false);
  const colors = useThemedColors();
  const visibleCaption = String(caption ?? img.caption ?? '').trim();

  const baseSrc = buildVersionedImageUrl(
    buildVersioned(img.url, img.updated_at ?? null, img.id),
    img.updated_at ?? null,
    img.id,
  );
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9;
  const lcpMaxWidth = isMobile ? 720 : 1280;
  // #1167: набор — из общего контракта (`constants/imageContract.ts`).
  const lcpWidths = isMobile ? IMAGE_WIDTHS.travelHeroMobile : IMAGE_WIDTHS.travelHeroDesktop;
  const targetWidth = lcpMaxWidth;

  const responsive = buildResponsiveImagePropsPreferringMedia(media ?? null, baseSrc, {
    maxWidth: targetWidth,
    widths: lcpWidths,
    quality: isMobile ? IMAGE_QUALITY.small : IMAGE_QUALITY.large,
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
  const mediaPlaceholder = useMemo(
    () => getMediaPlaceholderData(media ?? null),
    [media],
  );
  // #1208: hero переведён на ту же модель, что карточки каталога и галерея
  // (решение владельца «один слой», 2026-08-02): одна фотография — один растр.
  //
  // Раньше поля letterbox заливал ВТОРОЙ растр — крошечный вариант того же фото
  // под `filter: blur(18px)`, разложенный сегментами по полям. Он стоил лишнего
  // сетевого запроса, отдельного декода и целой геометрии (`getContainedMediaBox`
  // + `getBackdropSegments`) на самой тяжёлой странице сайта.
  //
  // Поля заливает `dominant_color` из манифеста: он приходит тем же ответом API,
  // стоит ноль запросов и виден ровно там, где фотографии нет. Blurhash на web
  // не берём — `expo-image` декодирует его в canvas и отдаёт `blob:`-PNG, то есть
  // это снова второй растр (см. `useBlurhashPlaceholder` в `ImageCardMedia`).
  const placeholderColor = mediaPlaceholder.dominantColor || '';
  const placeholderBlurhash = Platform.OS === 'web' ? null : mediaPlaceholder.blurhash;
  const hasDataPlaceholder = Boolean(placeholderBlurhash || placeholderColor);
  const fixedHeight = height ? `${Math.round(height)}px` : '100%';

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
          {hasDataPlaceholder ? (
            <div
              aria-hidden="true"
              data-hero-backdrop="true"
              data-hero-data-placeholder="true"
              style={{ position: 'absolute', inset: 0, zIndex: 0 }}
            >
              <ImageDataPlaceholder
                blurhash={placeholderBlurhash}
                color={placeholderColor}
                borderRadius={12}
                testID="travel-hero-data-placeholder"
              />
            </div>
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
            alt={alt || i18nT('travel:components.travel.details.TravelDetailsOptimizedLCPHero.defaultAlt')}
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
              // Critical HTML CSS paints an opaque neutral background on
              // img[data-lcp]. Keep it for legacy payloads, but make the sharp
              // layer transparent when a local data placeholder exists so the
              // blurhash/color below remains visible until decode completes.
              ...(hasDataPlaceholder ? { backgroundColor: 'transparent' } : null),
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
          {visibleCaption ? (
            <div
              data-testid="travel-hero-caption"
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 16,
                zIndex: 2,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  maxWidth: 720,
                  boxSizing: 'border-box',
                  padding: '10px 16px',
                  borderRadius: 16,
                  background: colors.overlay,
                  color: colors.textOnDark,
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: '22px',
                  letterSpacing: '-0.1px',
                  textAlign: 'center',
                  boxShadow: colors.boxShadows?.medium,
                  backdropFilter: 'blur(16px) saturate(1.25)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.25)',
                }}
              >
                {visibleCaption}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export const OptimizedLCPHero = React.memo(OptimizedLCPHeroInner);
export default OptimizedLCPHero;
