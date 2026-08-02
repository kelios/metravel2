import { memo, useCallback, useEffect, useRef } from 'react';

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

  // #1212: битый `<img>` браузер рисует alt-текстом со значком сломанной
  // картинки — именно это видно в карточке квеста. Гасим узел прямо в
  // обработчике, тем же приёмом, что и раскрытие в `handleLoad`: родитель снимет
  // его следующим коммитом, но ни одного кадра с alt-текстом быть не должно.
  const handleError = useCallback(() => {
    const img = imgRef.current;
    if (img) img.style.opacity = '0';
    onError?.();
  }, [onError]);

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
        // Плавное появление имело смысл, только когда под фото лежала размытая
        // подложка и было во что «проявляться». Подложки на web больше нет
        // (#1208), поэтому переход убран — иначе это просто задержка кадра.
        transition: 'none',
        willChange: 'auto',
        contain: 'layout',
      }}
      loading={loading}
      decoding="auto"
      // @ts-ignore -- fetchPriority is a valid img attribute in browsers and not in React DOM typings yet
      fetchPriority={priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'auto'}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});
