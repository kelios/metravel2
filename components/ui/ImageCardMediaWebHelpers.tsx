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

const OPTIMIZATION_PARAM_KEYS = ['w', 'h', 'q', 'fit', 'f', 'output'];

// Identity key strips ONLY optimization params (w/h/q/fit/f/output) so it stays
// stable across scroll/resize re-fetches, but PRESERVES meaningful query such as
// signatures or `?v=` versioning. Two images sharing origin+path but differing by
// signature/version must NOT collapse to the same key (otherwise webLoaded/node
// reuse shows a stale image for the new source).
export const resolveImageIdentityKey = (value: string | null | undefined): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^(data:|blob:)/i.test(raw)) return raw;

  try {
    const url = new URL(raw, 'https://metravel.by');
    OPTIMIZATION_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));
    const query = url.searchParams.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
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

export const isIOSWebKitUserAgent = (userAgent: string, maxTouchPoints = 0): boolean => {
  const normalizedUserAgent = String(userAgent || '');
  return (
    /iPad|iPhone|iPod/i.test(normalizedUserAgent) ||
    (/Macintosh/i.test(normalizedUserAgent) && maxTouchPoints > 1)
  );
};

export const isIOSSafariUserAgent = (userAgent: string, maxTouchPoints = 0): boolean => {
  const normalizedUserAgent = String(userAgent || '');
  const isIOSDevice = isIOSWebKitUserAgent(normalizedUserAgent, maxTouchPoints);
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

// Any iOS device — including Chrome/Firefox/etc. on iOS, which are all WebKit
// under the hood and share the same pointer-event-shim behaviour where a late
// preventDefault on a synthesized pointermove is ignored. Gestures driven from
// raw touch events must use this, not the Safari-only check above.
export const isIOSWebKit = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = String(navigator.userAgent || '');
  const maxTouchPoints = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  return isIOSWebKitUserAgent(userAgent, maxTouchPoints);
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
  /**
   * #1177: вторым аргументом — фактические пропорции выбранного кандидата.
   * Пропорции нужны, чтобы посчитать поля letterbox и нарисовать подложку
   * сегментами, а не одним `div` на всю плитку. Отдельным колбэком делать нельзя:
   * состояние «показан» и «известны пропорции» обязаны попасть в ОДИН React-коммит,
   * иначе между ними успевает встать кадр, где самый крупный элемент — подложка,
   * и LCP-кандидат фиксируется по ней.
   */
  onLoad?: (resolvedSrc: string, naturalSize?: { width: number; height: number }) => void;
  /**
   * #1177: пропорции отдельно от события загрузки.
   *
   * Первый слайд приходит из кэша hero-preload: узел вставляется уже `complete`, и
   * родитель считает его загруженным ещё до маунта, поэтому отчёт через `onLoad`
   * до него не доходит. Проверено в браузере на прод-сборке: соседние слайды уходили
   * в сегменты, а слайд 0 — самый крупный и единственный видимый — оставался с
   * подложкой на всю плитку. Здесь пропорции сообщаются в момент привязки узла.
   */
  onNaturalSize?: (naturalSize: { width: number; height: number }) => void;
  onError?: () => void;
  showImmediately?: boolean;
};

const naturalSizeOf = (img: HTMLImageElement | null): { width: number; height: number } | undefined => {
  if (!img) return undefined;
  const width = Number(img.naturalWidth);
  const height = Number(img.naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return { width, height };
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
  onNaturalSize,
  onError,
  showImmediately = false,
}: WebMainImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const loadReportedRef = useRef(false);
  const handleLoad = useCallback(() => {
    // Раскрываем резкий слой прямо здесь, а не следующим React-рендером. Блюр-подложка
    // ставит свою `opacity` в DOM из собственного `load`, поэтому ожидание `setState`
    // давало видимую двухфазность: сначала кадр «только блюр», затем фото поверх.
    // Событие `load` означает, что пиксели выбранного кандидата готовы, так что
    // раскрытие тут не обходит decode-гейт, а лишь не опаздывает на кадр.
    const img = imgRef.current;
    if (img) img.style.opacity = '1';

    // #1177: пропорции сообщаем ДО once-гарда.
    //
    // Родитель имеет право считать слой загруженным ещё до маунта — так работает
    // первый слайд, чей файл уже лежит в кэше от hero-preload. Тогда эффект ниже
    // вызывает `handleLoad()` немедленно, пикселей ещё нет, `naturalSizeOf` отдаёт
    // undefined, а `loadReportedRef` уже взведён — и настоящее событие `load`
    // возвращалось на строке ниже, так и не сообщив пропорции. В браузере это
    // выглядело так: соседние слайды уходили в сегменты, а слайд 0 — единственный
    // видимый — оставался с подложкой на всю плитку.
    const natural = naturalSizeOf(img);
    if (natural) onNaturalSize?.(natural);

    if (loadReportedRef.current) return;
    loadReportedRef.current = true;
    const resolvedSrc = img?.currentSrc || src;
    onLoad?.(resolvedSrc, natural);
  }, [onLoad, onNaturalSize, src]);

  // A new source must be able to report its own load again.
  useEffect(() => {
    loadReportedRef.current = false;
  }, [src]);

  // Стабильная функция: инлайновая пересоздавалась бы каждый рендер, и React на
  // каждом коммите отвязывал бы ref (`null`), а в этом окне `handleLoad` потерял бы
  // доступ к `currentSrc`.
  const attachImgRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    // Кэш-хит: у файла из памяти браузера пиксели есть уже к моменту вставки узла.
    // Ставим `opacity` до первого paint, иначе кадр «только блюр» видно даже там,
    // где ждать нечего — на возврате назад, повторном открытии и соседних слайдах.
    if (node && node.complete && node.naturalWidth > 0) {
      node.style.opacity = '1';
      // #1177: и сразу отдаём пропорции. Родитель мог посчитать этот слой уже
      // загруженным до маунта (кэш hero-preload у первого слайда) — тогда `onLoad`
      // не сработает, и без этого вызова подложка навсегда осталась бы на всю плитку.
      const natural = naturalSizeOf(node);
      if (natural) onNaturalSize?.(natural);
    }
  }, [onNaturalSize]);

  // То же самое, когда родитель СНОВА закрыл уже показанный слой: активный слайд
  // включает decode-гейт, ячейка списка переиспользуется. `<img>` с неизменным `src`
  // второго события `load` не выдаёт, поэтому без сброса единственный, кто мог бы
  // подтвердить готовность, молчит — и слой навсегда остаётся под блюром.
  useEffect(() => {
    if (!loaded) loadReportedRef.current = false;
  }, [loaded]);

  // Synthesize onLoad for cache hits and for iOS WebKit images whose real load event
  // is lost after a responsive-source swap or scroll restoration. Chrome, Firefox,
  // and Safari on iOS all use WebKit, so relying only on the DOM event can leave the
  // sharp layer at opacity:0 forever while its blurhash remains visible. `decode()`
  // follows the selected srcSet candidate until it is ready; bounded polling covers
  // WebKit builds where decode rejects even though the image later completes.
  useEffect(() => {
    const img = imgRef.current;
    if (loaded || (img && img.complete && img.naturalWidth > 0)) {
      handleLoad();
      return;
    }

    // Eager list/hero media can miss the event during a very fast cache hit in
    // Chromium too (observed on production after the iOS fix: complete=true,
    // naturalWidth>0, opacity remained 0). Lazy completion polling stays
    // iOS-WebKit-only so desktop article media does not keep background timers.
    if (!img || (loading !== 'eager' && !isIOSWebKit())) return;

    let cancelled = false;
    let recoveryStarted = false;
    let attempts = 0;
    let intersectionObserver: IntersectionObserver | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    const reportIfReady = (): boolean => {
      if (cancelled || !img.complete || img.naturalWidth <= 0) return false;
      handleLoad();
      return true;
    };

    const startRecovery = () => {
      if (cancelled || recoveryStarted) return;
      recoveryStarted = true;
      intersectionObserver?.disconnect();

      // For lazy article media this runs only once IntersectionObserver reports
      // that the image is close to the viewport, so decode() does not turn all
      // description photos into eager requests.
      if (typeof img.decode === 'function') {
        void img.decode().then(reportIfReady).catch(() => {
          // Keep the bounded completion poll alive; the native onLoad handler is
          // still the primary path and will report immediately if it does fire.
        });
      }

      pollTimer = setInterval(() => {
        attempts += 1;
        if (reportIfReady() || attempts >= 120) {
          if (pollTimer !== undefined) clearInterval(pollTimer);
        }
      }, 250);
    };

    if (loading === 'eager') {
      startRecovery();
    } else if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) startRecovery();
      }, {
        rootMargin: '300px 0px',
      });
      intersectionObserver.observe(img);
    }

    return () => {
      cancelled = true;
      intersectionObserver?.disconnect();
      if (pollTimer !== undefined) clearInterval(pollTimer);
    };
  }, [src, loaded, loading, handleLoad]);

  return (
    <img
      ref={attachImgRef}
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
        transition: hasBlurBehind && !showImmediately ? 'opacity 0.15s ease-in' : 'none',
        willChange: hasBlurBehind && !showImmediately ? 'opacity' : 'auto',
        contain: 'layout',
      }}
      loading={loading}
      decoding="auto"
      // @ts-ignore -- fetchPriority is a valid img attribute in browsers and not in React DOM typings yet
      fetchPriority={priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'auto'}
      onLoad={handleLoad}
      onError={onError}
    />
  );
});

/**
 * Самый узкий кандидат из `srcSet` — для размытого CSS-фона, где деталь всё равно
 * теряется. Возвращает null, если набора нет или он невалиден, чтобы вызывающий
 * откатился на обычный `src`.
 */
export function pickNarrowestSrcSetCandidate(srcSet?: string): string | null {
  const raw = String(srcSet || '').trim();
  if (!raw) return null;
  let best: { url: string; width: number } | null = null;
  for (const part of raw.split(',')) {
    const [url, descriptor] = part.trim().split(/\s+/);
    if (!url) continue;
    const width = Number.parseInt(String(descriptor || ''), 10);
    if (!Number.isFinite(width) || width <= 0) continue;
    if (!best || width < best.width) best = { url, width };
  }
  return best ? best.url : null;
}

type WebBlurBackdropProps = {
  src: string;
  /**
   * #1111: тот же `srcSet`/`sizes`, что у резкого слоя. Без них подложка грузит
   * ровно `src`, а main через `srcSet` выбирает другого кандидата — один файл
   * уезжает в две загрузки. Замер прода 2026-07-28 на карточке квеста: у обоих
   * слоёв `src` был `?w=160`, но main с `sizes: 132px` при DPR 2 брал `?w=320`.
   */
  srcSet?: string;
  sizes?: string;
  alt?: string;
  width: number;
  height: number;
  borderRadius: number;
  fit: 'contain' | 'cover';
  useCssBackdrop?: boolean;
  visible?: boolean;
  contentBox?: ContainedMediaBox | null;
  /**
   * #1177: у резкого слоя УЖЕ есть пиксели (подтверждённый decode, а не просто
   * `showImmediately`). В сегментном режиме это снимает base-слой на всю плитку:
   * поля letterbox закрыты сегментами, центр — самим фото, и подложке больше нечего
   * закрывать. После раскрытия база — невидимый прямоугольник, который по площади
   * больше кадра и потому перетягивает на себя LCP-кандидата (замер прода
   * 2026-07-31: base 381×489 = 159 909 px² против фото 353×353 = 124 609 px²).
   *
   * Именно decode, а не «разрешено показать»: у eager/high-priority медиа показ
   * разрешён с первого кадра, и снятие базы по нему оставило бы пустой центр до
   * прихода пикселей.
   */
  contentRevealed?: boolean;
};

export const WebBlurBackdrop = memo(function WebBlurBackdrop({
  src,
  srcSet,
  sizes,
  alt = '',
  width,
  height,
  borderRadius,
  fit,
  useCssBackdrop = false,
  visible = true,
  contentBox = null,
  contentRevealed = false,
}: WebBlurBackdropProps) {
  const hasPreBlurredSource = /(?:\?|&)blur=\d+(?:&|$)/i.test(src);
  const backdropFit = 'cover';
  const backdropScale = fit === 'contain' ? 1.08 : 1.12;
  const backdropFilter = hasPreBlurredSource
    ? 'saturate(1.08)'
    : fit === 'contain'
      ? 'blur(20px) saturate(1.08) brightness(0.86)'
      : 'blur(24px) saturate(1.15) brightness(0.9)';
  // #1111: CSS-фон не умеет выбирать кандидата из `srcSet` — он грузит ровно тот
  // URL, что стоит в `url()`. У hero `src` намеренно не оптимизирован
  // (`preserveOptimizedWebSrc` держит его равным preload-адресу), поэтому фон
  // тянул полноразмерный файл: замер прода 2026-07-28 — `?v=2051` без ресайза,
  // 121 КБ, только чтобы размыть его в CSS.
  //
  // Размытие уничтожает детали, поэтому фону достаточно самого узкого кандидата
  // из того же `srcSet` — те же 7 КБ вместо 121 КБ. Отдельным файлом это остаётся,
  // но крошечным; полностью убрать вторую загрузку можно только подставляя фону
  // `currentSrc` main-слоя уже после его onLoad.
  const backdropUrl = useMemo(() => pickNarrowestSrcSetCandidate(srcSet) ?? src, [srcSet, src]);
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
        {contentRevealed ? null : (
        <div
          aria-hidden="true"
          data-blur-backdrop="true"
          data-blur-backdrop-base="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            borderRadius,
            backgroundImage: `url("${backdropUrl.replace(/"/g, '\\"')}")`,
            backgroundSize: backdropFit,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: backdropFilter,
            transform: `scale(${backdropScale})`,
            transformOrigin: 'center',
            opacity: visible ? 1 : 0,
            contain: 'paint',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            pointerEvents: 'none',
            transition: 'opacity 0.15s ease-in',
          }}
        />
        )}
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
              backgroundImage: `url("${backdropUrl.replace(/"/g, '\\"')}")`,
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
        <div
          aria-hidden="true"
          data-blur-backdrop-overlay="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            borderRadius,
            backgroundColor: 'rgba(7,12,19,0.22)',
            pointerEvents: 'none',
          }}
        />
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
          backgroundImage: `url("${backdropUrl.replace(/"/g, '\\"')}")`,
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

  const targetOpacity = visible ? '0.95' : '0';

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
      // Кандидаты те же, что у резкого слоя, иначе браузер выберет другой вариант
      // и один файл превратится в две загрузки (#1111).
      srcSet={srcSet}
      sizes={sizes}
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
        opacity: visible ? 0.95 : 0,
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
