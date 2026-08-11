import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

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
  /**
   * #1264: узел с УЖЕ декодированными пикселями. Нужен второй ступени заливки полей
   * — усреднению кадра в канву, когда манифест цвета не дал. Сообщается там же, где
   * `onNaturalSize`, то есть и на настоящем `load`, и на кэш-хите до маунта.
   */
  onDecoded?: (img: HTMLImageElement) => void;
  onError?: () => void;
  showImmediately?: boolean;
  /**
   * Keep a near-viewport request alive when a virtualized cell reuses this DOM
   * node for another source. The detached owner is created only inside the
   * browser's bounded native-lazy request band, so far-offscreen rows stay
   * deferred.
   */
  retainRequestOnSourceSwap?: boolean;
};

type RetainedWebImageRequest = {
  image: HTMLImageElement;
  timeout: ReturnType<typeof setTimeout>;
};

const retainedWebImageRequests = new Map<string, RetainedWebImageRequest>();
const RETAINED_WEB_IMAGE_TIMEOUT_MS = 60_000;
// Chromium starts native-lazy image transfers up to roughly 1250 px outside
// the viewport. Use the same bounded band for catalog request ownership: a
// narrower gate can miss an already-started transfer and let the next recycled
// source abort it. FlashList still limits how many catalog cells are mounted.
const RECYCLED_IMAGE_RETAIN_MARGIN_PX = 1250;
const LAZY_IMAGE_RECOVERY_MARGIN_PX = 300;
const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const isCurrentImageIdentityComplete = (image: HTMLImageElement, src: string): boolean => {
  if (!image.complete || image.naturalWidth <= 0) return false;
  const requestedIdentity = resolveImageIdentityKey(src);
  const currentIdentity = resolveImageIdentityKey(image.currentSrc || image.src);
  return requestedIdentity !== null && requestedIdentity === currentIdentity;
};

/**
 * FlashList keeps one `<img>` mounted and swaps `src/srcSet` as a slot moves.
 * Chromium aborts the old request when that happens, even when the element is
 * still connected. A detached `Image` sharing the same responsive source keeps
 * the already-started request owned until load/error, after which normal HTTP
 * cache reuse takes over. This is deliberately called only inside Chromium's
 * bounded native-lazy band; calling it for every lazy row would turn the whole
 * catalog into eager loading.
 */
const retainWebImageRequest = ({
  src,
  srcSet,
  sizes,
  priority,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  priority: Priority;
}): void => {
  if (typeof Image === 'undefined') return;
  const key = `${src}\n${srcSet ?? ''}\n${sizes ?? ''}`;
  if (retainedWebImageRequests.has(key)) return;

  const image = new Image();
  const release = () => {
    const retained = retainedWebImageRequests.get(key);
    if (!retained || retained.image !== image) return;
    clearTimeout(retained.timeout);
    retainedWebImageRequests.delete(key);
  };
  const timeout = setTimeout(release, RETAINED_WEB_IMAGE_TIMEOUT_MS);
  retainedWebImageRequests.set(key, { image, timeout });
  image.addEventListener('load', release, { once: true });
  image.addEventListener('error', release, { once: true });
  image.decoding = 'async';
  image.loading = 'eager';
  image.fetchPriority = priority === 'high' ? 'high' : 'low';
  if (sizes) image.sizes = sizes;
  if (srcSet) image.srcset = srcSet;
  image.src = src;
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
  onDecoded,
  onError,
  showImmediately = false,
  retainRequestOnSourceSwap = false,
}: WebMainImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const loadReportedRef = useRef(false);
  /**
   * `attachImgRef` обязан оставаться стабильным (см. комментарий у него): любая
   * пересборка заставляет React отвязать ref, а в этом окне `handleLoad` теряет
   * доступ к `currentSrc`. Колбэк семпла меняет идентичность, когда заливка уже
   * найдена, поэтому он живёт в ref, а не в зависимостях.
   */
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;
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
    if (natural && img) onDecodedRef.current?.(img);

    if (loadReportedRef.current) return;
    loadReportedRef.current = true;
    const resolvedSrc = img?.currentSrc || src;
    onLoad?.(resolvedSrc, natural);
  }, [onLoad, onNaturalSize, src]);

  // A new source must be able to report its own load again.
  useEffect(() => {
    loadReportedRef.current = false;
  }, [src]);

  // Start the keeper in the same commit that rewrites the recycled node's
  // responsive source. Waiting for IntersectionObserver alone leaves a race:
  // under CPU ×4 the next 50 ms recycle can arrive before its callback. The
  // geometry check follows Chromium's bounded native-lazy request band. The
  // narrower decode-recovery observer below remains at 300 px.
  useWebLayoutEffect(() => {
    if (!retainRequestOnSourceSwap || typeof window === 'undefined') return;
    const img = imgRef.current;
    if (!img) return;
    const retainIfNearViewport = (): boolean => {
      const rect = img.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const isNearViewport =
        rect.bottom >= -RECYCLED_IMAGE_RETAIN_MARGIN_PX &&
        rect.top <= viewportHeight + RECYCLED_IMAGE_RETAIN_MARGIN_PX &&
        rect.right >= 0 &&
        rect.left <= viewportWidth;
      // The initial row flips eager/high -> lazy/low after the first scroll.
      // That policy-only update must not create a detached owner for an image
      // whose same identity is already decoded. During a real recycle swap the
      // node still reports the previous currentSrc, so the keeper stays active.
      if (isNearViewport && !isCurrentImageIdentityComplete(img, src)) {
        retainWebImageRequest({ src, srcSet, sizes, priority });
      }
      return isNearViewport;
    };
    if (retainIfNearViewport() || typeof IntersectionObserver === 'undefined') return;

    // A freshly remounted FlashList slot can still have its old/far geometry in
    // the layout effect. Observe the same bounded band so its request gains an
    // owner as soon as FlashList places it, without enabling decode recovery.
    const retainObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!isCurrentImageIdentityComplete(img, src)) {
        retainWebImageRequest({ src, srcSet, sizes, priority });
      }
      retainObserver.disconnect();
    }, {
      rootMargin: `${RECYCLED_IMAGE_RETAIN_MARGIN_PX}px 0px`,
    });
    retainObserver.observe(img);
    return () => retainObserver.disconnect();
  }, [retainRequestOnSourceSwap, src, srcSet, sizes, priority]);

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
      if (natural) onDecodedRef.current?.(node);
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
    //
    // Исключение — активный гейт раскрытия (`showImmediately=false` и слой ещё
    // не загружен): это рециклируемая ячейка, где узел УЖЕ погашен, чтобы не
    // показывать чужой кадр. Там потерянное событие `load` оставило бы карточку
    // пустой навсегда, поэтому страховка нужна и ленивым картинкам — но всё так
    // же по IntersectionObserver, то есть только рядом с вьюпортом.
    const revealGateActive = !showImmediately && !loaded;
    if (!img || (loading !== 'eager' && !isIOSWebKit() && !revealGateActive)) return;

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

      if (retainRequestOnSourceSwap && !isCurrentImageIdentityComplete(img, src)) {
        retainWebImageRequest({ src, srcSet, sizes, priority });
      }

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
        rootMargin: `${LAZY_IMAGE_RECOVERY_MARGIN_PX}px 0px`,
      });
      intersectionObserver.observe(img);
    }

    return () => {
      cancelled = true;
      intersectionObserver?.disconnect();
      if (pollTimer !== undefined) clearInterval(pollTimer);
    };
  }, [
    src,
    srcSet,
    sizes,
    priority,
    loaded,
    loading,
    showImmediately,
    retainRequestOnSourceSwap,
    handleLoad,
  ]);

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
