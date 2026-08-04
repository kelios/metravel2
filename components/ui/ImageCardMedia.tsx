import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl, generateSrcSet } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  WebMainImage,
  hasOptimizationParams,
  isIOSSafariUserAgent,
  isIOSWebKit,
  isIOSWebKitUserAgent,
  loadedWebImageBaseCache,
  resolveImageIdentityKey,
  type Priority,
} from '@/components/ui/ImageCardMediaWebHelpers';

const isRootRelativeUrl = (value: string): boolean => /^\/(?!\/)/.test(value);

/**
 * Потолок ширины sharp-слоя на native — верхняя ступень whitelist прокси, которая
 * никогда не даёт апскейла. См. `buildNativeSharpImageSource` и #1113.
 */
const NATIVE_SHARP_MAX_WIDTH = 800;

/** Web: верхний кандидат в `srcSet` карточки. См. `webSrcSet` и #1113. */
const WEB_SRCSET_MAX_WIDTH = 1280;

/**
 * #1212: состояние сбоя загрузки web-картинки.
 *
 * - `waiting`  — сбой был, запроса в полёте нет, ждём паузу перед ретраем;
 * - `retrying` — единственная повторная попытка смонтирована;
 * - `failed`   — и она не удалась: нейтральный плейсхолдер до смены картинки.
 */
type WebLoadFailure = {
  identity: string;
  phase: 'waiting' | 'retrying' | 'failed';
};

/**
 * Пауза перед ретраем и её разброс.
 *
 * Замер прода 2026-08-02 на `/quests`: 8 обложек, запрошенных ОДНОВРЕМЕННО, дали
 * 6 × HTTP 503, а те же 8 URL через 900 мс последовательно — 8 × 200 (0,28–0,4 с).
 * Сервер режет пачку, а не файлы. Мгновенный ретрай попадает в то же окно и
 * гарантированно получает второй 503, поэтому пауза здесь несущая, а не
 * косметическая.
 *
 * Разброс обязателен: без него все карточки страницы повторяют запрос синхронно
 * и собирают новую пачку — ровно ту, из-за которой пришёл 503.
 *
 * Это retry-логика, а не таймер раскрытия контента: всё это время уже показан
 * финальный нейтральный плейсхолдер (docs/RULES.md → Timeout policy).
 */
const WEB_RETRY_BASE_DELAY_MS = 600;
const WEB_RETRY_JITTER_MS = 600;

type NativeSharpSourceArgs = {
  uri: string;
  width?: number;
  height?: number;
  quality: number;
  fit: 'contain' | 'cover';
  pixelRatio: number;
};

export function buildNativeSharpImageSource({
  uri,
  width,
  height,
  quality,
  fit,
  pixelRatio,
}: NativeSharpSourceArgs): { uri: string } | null {
  // `source` может прийти объектом без `uri` (например `{ uri: undefined }` из
  // нормализаторов профиля) — на native это роняло весь рендер карточки на
  // `uri.trim()`. Падение живёт в main с момента появления функции: 11 кейсов
  // `__tests__/components/profile.test.tsx` красные и на чистом HEAD 627d7f4d.
  const normalizedUri = typeof uri === 'string' ? uri.trim() : '';
  if (!normalizedUri || /^(data:|blob:|file:)/i.test(normalizedUri)) return null;
  if (hasOptimizationParams(normalizedUri)) return null;
  const baseWidth = width ?? height;
  if (!baseWidth || baseWidth <= 0) return null;
  const dpr = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  // #1113: потолок был ровно 1024 — ширина, которой у прокси НЕТ. На такой запрос
  // сервер молча отдаёт оригинал, поэтому «сайзинг» sharp-слоя из #1103 для крупных
  // карточек не работал вовсе. Замер прода 2026-07-28 (исходник 1024×576, 132 344 B):
  // w=1024 → 132 344 B (оригинал), w=800 → 53 104 B. Берём 800 — верхнюю ступень
  // whitelist, которая гарантированно ≤ оригинала (1280 на квадратных 1080×1080
  // оригиналах галереи означал бы апскейл тяжелее исходника).
  const targetWidth = Math.min(NATIVE_SHARP_MAX_WIDTH, Math.round(baseWidth * dpr));
  // Высота в URL не участвует: прокси ресайзит только по `w`, а `h` делал ссылку
  // зависимой от геометрии контейнера и плодил дубликаты вариантов.
  const optimized = optimizeImageUrl(normalizedUri, {
    width: targetWidth,
    quality,
    fit,
  });
  return optimized && optimized !== normalizedUri ? { uri: optimized } : null;
}

type Props = {
  src?: string | null;
  source?: { uri: string } | number | null;
  alt?: string;
  height?: number;
  width?: number | string;
  borderRadius?: number;
  fit?: 'contain' | 'cover';
  blurBackground?: boolean;
  /** Native-only: keep the sharp layer hidden until its blur backdrop is ready. */
  synchronizeNativeBlurReveal?: boolean;
  blurRadius?: number;
  blurOnly?: boolean;
  quality?: number;
  overlayColor?: string;
  placeholderBlurhash?: string;
  /** Backend dominant color used when a blurhash is unavailable. */
  placeholderColor?: string | null;
  /**
   * Low-quality preview URL (e.g. a small thumbnail) shown immediately, blurred,
   * while the main image is still loading. Gives catalog cards a colored preview
   * instead of an empty grey block during lazy fetch. Does NOT change when the
   * sharp main image is revealed — reveal still waits for the main decode.
   */
  placeholderSrc?: string | null;
  priority?: Priority;
  loading?: 'lazy' | 'eager';
  prefetch?: boolean;
  transition?: number;
  cachePolicy?: ExpoImageProps['cachePolicy'];
  imageProps?: Partial<ExpoImageProps>;
  showLoadingIndicator?: boolean;
  testID?: string;
  style?: any;
  onLoad?: () => void;
  onError?: () => void;
  recyclingKey?: string;
  /** Show image immediately without waiting for load (for cached images). */
  showImmediately?: boolean;
  /** Allow blurred web backdrop even for eager/high-priority images. */
  allowCriticalWebBlur?: boolean;
  /** On web, keep main image hidden until onLoad even for eager/high-priority media. */
  revealOnLoadOnly?: boolean;
  /**
   * Принимается для совместимости с вызывающими (слайдеры передают его для native).
   * На web не используется: сегментной blur-подложки, ради которой считалась
   * геометрия полей, больше нет — поля заливает `placeholderColor`.
   */
  contentAspectRatio?: number;
  /** Preserve the exact pre-optimized URL for critical web media that must match preload. */
  preserveOptimizedWebSrc?: boolean;
  /** Skip web URL resizing when the upstream optimizer returns padded contain canvases. */
  optimizeWeb?: boolean;
  /**
   * Web-only responsive source prepared by a caller that already owns the image
   * variant contract, for example backend media manifest entries.
   */
  webResponsiveSource?: {
    src?: string | null;
    srcSet?: string | null;
    sizes?: string | null;
  } | null;
};

function ImageCardMedia({
  src,
  source,
  alt,
  height,
  width = '100%',
  borderRadius = 12,
  fit = 'contain',
  blurBackground = true,
  synchronizeNativeBlurReveal = false,
  blurRadius = 16,
  blurOnly = false,
  quality = 60,
  overlayColor,
  placeholderBlurhash,
  placeholderColor,
  placeholderSrc,
  priority = 'normal',
  loading = 'lazy',
  prefetch = false,
  transition,
  cachePolicy,
  imageProps,
  showLoadingIndicator = true,
  testID,
  style,
  onLoad,
  onError,
  recyclingKey,
  showImmediately = false,
  allowCriticalWebBlur = false,
  revealOnLoadOnly = false,
  preserveOptimizedWebSrc = false,
  optimizeWeb = true,
  webResponsiveSource,
}: Props) {
  const isJest =
    typeof process !== 'undefined' && !!process.env.JEST_WORKER_ID;
  const disableRemoteImages =
    __DEV__ && process.env.EXPO_PUBLIC_DISABLE_REMOTE_IMAGES === 'true';
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isIOSWebKitWeb = useMemo(() => isIOSWebKit(), []);
  const contentFit: ImageContentFit = fit === 'cover' ? 'cover' : 'contain';
  const normalizedPlaceholderBlurhash =
    typeof placeholderBlurhash === 'string' ? placeholderBlurhash.trim() : '';
  const normalizedPlaceholderColor =
    typeof placeholderColor === 'string' &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(placeholderColor.trim())
      ? placeholderColor.trim()
      : '';
  /**
   * На web blurhash в слой не идёт: `expo-image` декодирует его в canvas 32×32,
   * апскейлит ×10 и отдаёт `blob:`-PNG 320×320 (~48 КБ и отдельная строка в
   * Network на каждую плитку — см. `expo-image/src/utils/blurhash/useBlurhash.tsx`,
   * `scaleRatio = 10`). Для заливки полей под размытием этого не нужно: там
   * достаточно `dominant_color`, который приходит тем же манифестом и стоит ноль
   * ресурсов. На native blurhash остаётся — там его рисует сама expo-image.
   */
  const useBlurhashPlaceholder =
    Platform.OS !== 'web' && Boolean(normalizedPlaceholderBlurhash);
  const hasDataPlaceholder = Boolean(
    useBlurhashPlaceholder || normalizedPlaceholderColor,
  );
  const resolvedSource = useMemo(() => {
    if (source) return source;
    if (src) return { uri: src };
    return null;
  }, [source, src]);
  // Identity key keeps signature/`?v=` query (distinguishes different images) while
  // ignoring optimization params (stable across scroll/resize). Used for load-state
  // reset, the loaded-cache and the web media React key so query-only-differing
  // images don't reuse a stale node / stale "loaded" flag.
  const currentImageIdentityKey = useMemo(() => {
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    if (typeof resolvedSource === 'string') {
      return resolveImageIdentityKey(resolvedSource);
    }
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return resolveImageIdentityKey(uri);
  }, [resolvedSource]);
  const [webLoaded, setWebLoaded] = useState(() => {
    // revealOnLoadOnly is an exact decode gate. The shared cache is keyed by
    // image identity (optimization params removed), so a previously loaded 160px
    // thumbnail must not make a new 1280px candidate visible before it decodes.
    return !revealOnLoadOnly && !!(
      currentImageIdentityKey && loadedWebImageBaseCache.has(currentImageIdentityKey)
    );
  });
  const baseUriRef = useRef<string | null>(currentImageIdentityKey);
  const revealOnLoadOnlyRef = useRef(revealOnLoadOnly);
  /**
   * Identity, для которой пришло НАСТОЯЩЕЕ событие `load` (а не догадка по
   * `loadedWebImageBaseCache`). `revealOnLoadOnly` — это гейт ДО первого
   * подтверждённого decode; после него закрывать уже показанные пиксели нельзя.
   *
   * Слайд галереи грузится соседом (гейта нет, фото раскрыто), а активным
   * состоянием `Slide` включает `revealOnLoadOnly` на том же URL. Сброс
   * «загружено» в этот момент гасил фото, а `<img>` не повторяет `load` для
   * неизменного `src` — на iPhone был виден только первый кадр, а все следующие
   * оставались размытой подложкой.
   */
  const decodedIdentityRef = useRef<string | null>(null);
  const hasConfirmedDecode =
    decodedIdentityRef.current !== null &&
    decodedIdentityRef.current === currentImageIdentityKey;
  // FlashList recycles a mounted card synchronously. Do not let the previous
  // item's `webLoaded=true` leak into the first paint of the next identity while
  // the reset effect is still pending.
  const effectiveWebLoaded =
    baseUriRef.current === currentImageIdentityKey &&
    (revealOnLoadOnlyRef.current === revealOnLoadOnly || hasConfirmedDecode)
      ? webLoaded
      : false;

  /**
   * #1212: сбой загрузки на web не должен становиться вечным.
   *
   * Компонент только пробрасывал `onError` наружу и своего состояния ошибки не
   * имел. Потребитель, который проп не передаёт (`QuestForCityCard`), оставался
   * с битым `<img>` навсегда: браузер рисует в кадре `alt` («Обложка квеста …»
   * на проде 2026-08-02), нового запроса никто не делает. Одного оборванного
   * ответа — например при рестарте app/nginx на деплое — хватало, чтобы карточка
   * осталась сломанной до перезагрузки страницы.
   *
   * Хранится ИДЕНТИЧНОСТЬ картинки, а не булев флаг: тогда смена картинки
   * (recycle ячейки FlashList, следующий слайд) сбрасывает состояние сама, без
   * отдельного эффекта. `null`-ключ (источника нет) не считается совпадением —
   * иначе пустая карточка стартовала бы «сломанной».
   *
   * Только web: тот же класс сбоя на native закрыт в `OptimizedImage` — там свой
   * ретрай (#802) и свой нейтральный `errorContainer`, дублировать их нечем.
   */
  const [webFailure, setWebFailure] = useState<WebLoadFailure | null>(null);
  /**
   * Идентичность, для которой ремоунт-ретрай уже сделан.
   *
   * Суффикс ключа обязан пережить УСПЕХ ретрая: если считать его прямо из фазы
   * `retrying`, удачная загрузка снимает состояние сбоя, ключ возвращается к
   * базовому, React выбрасывает только что загруженный `<img>` и монтирует
   * новый — браузер уходит за тем же URL третий раз. Замер прода 2026-08-03,
   * transient-режим: `ABORT → PASS(3899 мс) → PASS(4524 мс)`, оба PASS одним
   * `?w=320&q=60&fit=contain`.
   */
  const [retriedIdentity, setRetriedIdentity] = useState<string | null>(null);
  /** Идентичность, о терминальном сбое которой уже сообщили наружу. */
  const reportedFailureRef = useRef<string | null>(null);
  const activeWebFailure =
    webFailure && currentImageIdentityKey && webFailure.identity === currentImageIdentityKey
      ? webFailure
      : null;
  // `waiting` — запроса в полёте нет, показываем плейсхолдер; `failed` — то же,
  // но уже окончательно. `retrying` рисуется как обычная картинка.
  const hasWebLoadError =
    activeWebFailure?.phase === 'waiting' || activeWebFailure?.phase === 'failed';
  const hasRetriedWebLoad =
    Boolean(currentImageIdentityKey) && retriedIdentity === currentImageIdentityKey;

  const resolvedBorderRadius = useMemo(() => {
    const flattened = StyleSheet.flatten(style) as any;
    const override = flattened?.borderRadius;
    return typeof override === 'number' ? override : borderRadius;
  }, [borderRadius, style]);

  // For require() sources (numbers), we use OptimizedImage with ExpoImage
  // which handles them natively. No need to resolve URI manually.
  const shouldDisableNetwork = useMemo(() => {
    if (!disableRemoteImages) return false;
    if (!resolvedSource || typeof resolvedSource === 'number') return false;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return false;
    return !/^(data:|blob:)/i.test(uri);
  }, [disableRemoteImages, resolvedSource]);

  const resolvedLoading = useMemo(() => {
    if (Platform.OS !== 'web') return loading;
    if (loading !== 'lazy') return loading;
    // iOS WebKit can leave a lazy <img> below the blurred backdrop without
    // dispatching the load event after scroll/restoration. Because the sharp
    // layer is revealed by that event, shared-blur media stays eager there.
    // A no-blur catalog cover has no competing composited layer, so preserve
    // browser-native lazy loading instead of firing every image in the list.
    return isIOSWebKitWeb && blurBackground ? 'eager' : loading;
  }, [blurBackground, isIOSWebKitWeb, loading]);

  // Stabilize width/height for image optimization to prevent URL changes on scroll
  // Only update when change is significant (>50px) to avoid re-fetching images
  const stableWidthRef = useRef<number | undefined>(typeof width === 'number' ? width : undefined);
  const stableHeightRef = useRef<number | undefined>(typeof height === 'number' ? height : undefined);
  // Separate identity trackers per dimension so each memo resets its own baseline
  // when the image identity changes (recycle) without cross-memo coordination.
  const stableWidthIdentityRef = useRef<string | null>(null);
  const stableHeightIdentityRef = useRef<string | null>(null);

  const stableWidth = useMemo(() => {
    const numericWidth = typeof width === 'number' ? width : undefined;
    // On recycle (new image in a reused cell) reset the baseline to current props
    // so the new src isn't optimized for the previous item's dimensions.
    if (currentImageIdentityKey !== stableWidthIdentityRef.current) {
      stableWidthIdentityRef.current = currentImageIdentityKey;
      stableWidthRef.current = numericWidth;
      return stableWidthRef.current;
    }
    if (numericWidth !== undefined && stableWidthRef.current !== undefined) {
      if (Math.abs(numericWidth - stableWidthRef.current) > 50) {
        stableWidthRef.current = numericWidth;
      }
    } else if (numericWidth !== undefined) {
      stableWidthRef.current = numericWidth;
    }
    return stableWidthRef.current;
  }, [width, currentImageIdentityKey]);

  const stableHeight = useMemo(() => {
    const numericHeight = typeof height === 'number' ? height : undefined;
    if (currentImageIdentityKey !== stableHeightIdentityRef.current) {
      stableHeightIdentityRef.current = currentImageIdentityKey;
      stableHeightRef.current = numericHeight;
      return stableHeightRef.current;
    }
    if (numericHeight !== undefined && stableHeightRef.current !== undefined) {
      if (Math.abs(numericHeight - stableHeightRef.current) > 50) {
        stableHeightRef.current = numericHeight;
      }
    } else if (numericHeight !== undefined) {
      stableHeightRef.current = numericHeight;
    }
    return stableHeightRef.current;
  }, [height, currentImageIdentityKey]);

  // Native: sharp-слой уходил в Glide исходным URL даже при известных width/height —
  // прокси-сайзинг жил только у hero (buildUriNative) и у 96px-блюра выше. Карточка
  // 132dp платила полный вес оригинала (quest-обложки ~290 КБ, #1103). Сайзим URL от
  // стабильной геометрии × физический DPR с потолком 1024 (потолок бэка, #1074).
  // Уже оптимизированные и локальные URL не трогаем.
  const nativeSharpSource = useMemo(() => {
    if (Platform.OS === 'web' || !resolvedSource || typeof resolvedSource === 'number') return null;
    return buildNativeSharpImageSource({
      uri: resolvedSource.uri,
      width: stableWidth,
      height: stableHeight,
      quality,
      fit: contentFit === 'contain' ? 'contain' : 'cover',
      pixelRatio: PixelRatio.get(),
    });
  }, [contentFit, quality, resolvedSource, stableHeight, stableWidth]);

  const shouldPreserveProvidedOptimizedUrl = useCallback((uri: string): boolean => {
    if (!hasOptimizationParams(uri)) return false;
    // An explicitly preserved URL (e.g. slider's buildUriWeb output) is already the
    // FINAL variant — honor it for EVERY slide state, not only the active/critical-blur
    // one. Otherwise preloaded/neighbour slides re-optimize the src and emit a srcSet,
    // so the browser downloads a second differently-sized variant of the same photo
    // (the gallery double-fetch).
    if (preserveOptimizedWebSrc) return true;
    if (!allowCriticalWebBlur) return false;
    // All iPhone browsers use WebKit and need the responsive Retina ladder.
    return !isIOSWebKitWeb;
  }, [allowCriticalWebBlur, isIOSWebKitWeb, preserveOptimizedWebSrc]);

  const providedWebResponsiveSource = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    const nextSrc = typeof webResponsiveSource?.src === 'string' ? webResponsiveSource.src.trim() : '';
    if (!nextSrc) return null;
    return {
      src: nextSrc,
      srcSet:
        typeof webResponsiveSource?.srcSet === 'string' && webResponsiveSource.srcSet.trim()
          ? webResponsiveSource.srcSet.trim()
          : undefined,
      sizes:
        typeof webResponsiveSource?.sizes === 'string' && webResponsiveSource.sizes.trim()
          ? webResponsiveSource.sizes.trim()
          : undefined,
    };
  }, [webResponsiveSource]);

  const webOptimizedSource = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (providedWebResponsiveSource?.src) return providedWebResponsiveSource.src;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    // Handle local asset string from require() on web
    if (typeof resolvedSource === 'string') return resolvedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    if (isRootRelativeUrl(uri)) return uri;
    if (!optimizeWeb) return uri;
    if (shouldPreserveProvidedOptimizedUrl(uri)) return uri;
    if (!stableWidth && !stableHeight) return null;
    return (
      optimizeImageUrl(uri, {
        width: stableWidth,
        quality,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
      }) ?? uri
    );
  }, [providedWebResponsiveSource, resolvedSource, optimizeWeb, shouldPreserveProvidedOptimizedUrl, stableWidth, stableHeight, contentFit, quality]);
  const webMainSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    // For require() sources (numbers), return null to use OptimizedImage/ExpoImage
    if (typeof resolvedSource === 'number') return null;
    if (!resolvedSource) return null;
    // Handle local asset string from require() on web
    if (typeof resolvedSource === 'string') return resolvedSource;
    if (shouldDisableNetwork) return null;
    if (webOptimizedSource) return webOptimizedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return uri || null;
  }, [resolvedSource, shouldDisableNetwork, webOptimizedSource]);

  const webSrcSet = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (providedWebResponsiveSource) return providedWebResponsiveSource.srcSet;
    if (!resolvedSource || typeof resolvedSource === 'number') return undefined;
    // Skip srcset for local assets
    if (typeof resolvedSource === 'string') return undefined;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return undefined;
    if (isRootRelativeUrl(uri)) return undefined;
    if (!optimizeWeb) return undefined;
    if (shouldPreserveProvidedOptimizedUrl(uri)) return undefined;
    // Use stable width to prevent srcset changes on scroll
    const baseWidth = stableWidth ?? (isIOSWebKitWeb ? 400 : 320);
    const maxResponsiveMultiplier = isIOSWebKitWeb ? 3 : 2;
    const srcSetWidths = [
      Math.max(160, Math.round(baseWidth * 0.5)),
      Math.max(320, Math.round(baseWidth)),
      Math.max(480, Math.round(baseWidth * 1.5)),
      Math.max(640, Math.round(baseWidth * 2)),
      ...(maxResponsiveMultiplier > 2
        ? [Math.max(720, Math.round(baseWidth * maxResponsiveMultiplier))]
        : []),
    ];
    // #1113: верхние кандидаты (baseWidth × 2…3) уходили в 1024/2048 — ступени, которых
    // у прокси нет, поэтому retina-браузер выбирал ровно тот вариант, на который сервер
    // отвечал ОРИГИНАЛОМ. Лестница это уже чинит, но кандидаты крупнее 1280 всё равно
    // бессмысленны для карточек: исходники галереи редко шире, а прокси на такой запрос
    // отдаёт апскейл тяжелее оригинала (w=1920 из 1024×576 → 378 418 B против 132 344 B).
    const uniqueSortedWidths = Array.from(
      new Set(srcSetWidths.map((value) => Math.min(WEB_SRCSET_MAX_WIDTH, value))),
    ).sort((a, b) => a - b);
    /**
     * Полы 160/320/480/640 выше не зависят от размера слота, поэтому мелкие слоты
     * получали кандидатов заведомо крупнее, чем им нужно даже на retina. Для
     * аватара это оплачивалось мастером: слот 96 CSS px на DPR 2 требует 192, в
     * наборе ближайшим оказывался 320 — а 320 у storage-профиля `avatar` и есть
     * МАСТЕР. Замер прода 2026-08-03,
     * `/avatar/profile/82/avatar/f9b9811452104523b2088f840a77a6ee.webp`:
     *
     *   w=96  →     738 B  stored-derivative
     *   w=160 →   1 572 B  stored-derivative
     *   w=320 →  88 492 B  stored-master
     *
     * То есть ~87 КБ лишних на каждый такой аватар (на travel-детали их минимум
     * два). Отсекаем кандидатов крупнее того, что слот способен показать на своём
     * DPR-множителе; если так не остаётся ни одного — держим самую мелкую ступень,
     * чтобы `srcSet` не исчез вовсе.
     */
    const slotPixelCap = Math.round(baseWidth * maxResponsiveMultiplier);
    const withinSlot = uniqueSortedWidths.filter((value) => value <= slotPixelCap);
    const effectiveWidths = withinSlot.length ? withinSlot : uniqueSortedWidths.slice(0, 1);
    return (
      generateSrcSet(uri, effectiveWidths, {
        quality,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
      }) || undefined
    );
  }, [providedWebResponsiveSource, resolvedSource, optimizeWeb, shouldPreserveProvidedOptimizedUrl, contentFit, quality, stableWidth, isIOSWebKitWeb]);

  const webSizes = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (providedWebResponsiveSource?.sizes) return providedWebResponsiveSource.sizes;
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      return `${Math.round(width)}px`;
    }
    if (isIOSWebKitWeb) {
      return '(min-width: 768px) 50vw, 100vw';
    }
    return '(min-width: 1024px) 320px, (min-width: 768px) 33vw, 50vw';
  }, [providedWebResponsiveSource, width, isIOSWebKitWeb]);

  // Решение владельца 2026-08-02: на web одна картинка — один растр. Размытой
  // подложки нет ни здесь, ни в hero travel-детали (#1208); поля letterbox
  // заливает `dominant_color` из манифеста. Native не трогаем — там переходом
  // управляет сама expo-image.
  /**
   * #1177: геометрия для сегментного режима подложки.
   *
   * Раньше требовались ЧИСЛОВЫЕ `width`/`height` и проп `contentAspectRatio`, и в
   * галерее травела не было ни того, ни другого: слайдер отдаёт `containerW` строкой
   * (`'100%'`), а `contentAspectRatio` приходит только когда в gallery-пейлоаде есть
   * `width`/`height` — а их там нет. В итоге подложка всегда рисовалась одним `div`
   * на всю плитку и по площади перекрывала само фото.
   *
   * Оба недостающих числа берём из DOM: размер — из контейнера, пропорции — из
   * `naturalWidth/naturalHeight` уже загруженного резкого слоя.
   */
  // When blur backdrop reuses the main image URL, both the CSS background-image
  // and the <img> share one browser cache entry. The sharp image appears as soon
  // as data arrives — no need for an opacity fade that creates a "blur first,
  // image second" flash during scroll.
  /**
   * Решение владельца 2026-08-02: гейта раскрытия на web больше нет.
   *
   * Гейт держал `<img>` в `opacity: 0` до события `load` и показывал вместо фото
   * подложку. Он и был причиной «сначала виден только размытый фон», а на
   * квестах фото иногда так и не раскрывалось: событие `load` не приходило
   * (кэш-хит по неизменному `src`), и слайд оставался размытым навсегда.
   *
   * Браузер и так рисует прогрессивно и не показывает пустой `<img>`, у которого
   * есть предыдущий декодированный кадр, — то есть гейт не защищал ни от чего,
   * что браузер не умеет сам.
   */
  const shouldShowWebImageImmediately = Platform.OS !== 'web' ? showImmediately : true;

  const shouldRevealWebMedia = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    return shouldShowWebImageImmediately || effectiveWebLoaded;
  }, [effectiveWebLoaded, shouldShowWebImageImmediately]);

  /**
   * #1145: blurhash-подложка на web — это `<ExpoImage source={{blurhash}}>`, то есть
   * настоящий `<img>` с `blob:`-адресом, `loading="lazy"` и `fetchpriority="auto"`.
   * Она рисуется в режиме `cover` на всю плитку, поэтому по площади перекрывает
   * `contain`-фото и Chrome берёт LCP по ней. На travel-детали слайдер монтируется
   * уже после гидрации, и в прод-замере 2026-07-30 именно такая подложка стала
   * финальным LCP-кандидатом: mobile 10 925 мс / desktop 11 283 мс, Load Delay 83–91 %.
   *
   * Смысл подложки — закрыть паузу ДО появления резкого слоя. Когда картинка уже
   * показана (первый слайд приходит из кэша hero), подложка не нужна: она невидима
   * под непрозрачным фото, но остаётся LCP-кандидатом и лишним DOM-узлом.
   * На native поведение не меняем — там переходом управляет сама expo-image.
   */
  /**
   * На web слой из данных остаётся видимым ВСЕГДА: он и есть заливка полей
   * letterbox под `contain`-фото. Раньше он снимался после раскрытия картинки,
   * и в `contain` поля становились пустыми — ради них и поднимали сетевую
   * blur-подложку. Слой стоит под фото (`zIndex: 0`), поэтому на кадре его видно
   * ровно там, где фото нет.
   */
  const shouldRenderDataPlaceholder = hasDataPlaceholder;

  // Скелет ждал раскрытия фото; раскрытия больше нет, а под фото лежит заливка.
  const shouldRenderWebSkeleton = false;

  // Low-quality preview shown immediately (blurred) while the main image loads,
  // so a catalog card reads as "loading" with the photo's colors instead of an
  // empty grey block. Independent of the sharp reveal gate.
  const webPlaceholderSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (hasDataPlaceholder) return null;
    const raw = typeof placeholderSrc === 'string' ? placeholderSrc.trim() : '';
    if (!raw) return null;
    if (raw === webMainSrc) return null;
    if (isRootRelativeUrl(raw)) return raw;
    return (
      optimizeImageUrl(raw, {
        width: 64,
        quality: 28,
        format: 'jpg',
        fit: 'cover',
      }) ?? raw
    );
  }, [hasDataPlaceholder, placeholderSrc, webMainSrc]);

  const shouldRenderWebPlaceholder = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (blurOnly) return false;
    if (!webPlaceholderSrc) return false;
    return !shouldRevealWebMedia;
  }, [blurOnly, shouldRevealWebMedia, webPlaceholderSrc]);
  /**
   * Ключ web-узлов ПОЗИЦИОННЫЙ, а не по идентичности картинки.
   *
   * FlashList рециклит ряды: ячейка переиспользуется (`slot-${index}` в
   * `RightColumn`), но если `<img>` внутри ключевать по URL/`recyclingKey`,
   * React уничтожает узел и монтирует новый. Свежий `<img>` до декода пуст,
   * поэтому при скролле кадр моргал, а браузер заводил новый запрос вместо
   * смены `src`. Со стабильным ключом узел переиспользуется, меняется только
   * `src`, и предыдущий декодированный кадр держится до появления нового.
   *
   * Так уже было сделано (`key="main-web-media"`), но `5dccae12` вернул ключ по
   * идентичности, чтобы форсировать `load` на iPhone. Это больше не нужно: гейта
   * раскрытия нет, ждать событие `load` некому.
   */
  const webMediaInstanceKey = 'web-media';

  const webImageProps = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return {};
  }, []);

  // Track the base URI (without optimization params) to avoid resetting loaded state
  // when only width/quality changes but the source image is the same
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Reset loaded state when the underlying image identity changes (different
    // signature/version), but stay stable across optimization-param changes.
    const identityChanged = currentImageIdentityKey !== baseUriRef.current;
    const revealModeChanged = revealOnLoadOnly !== revealOnLoadOnlyRef.current;
    if (identityChanged || revealModeChanged) {
      baseUriRef.current = currentImageIdentityKey;
      revealOnLoadOnlyRef.current = revealOnLoadOnly;
      if (identityChanged) {
        decodedIdentityRef.current = null;
        // #1212: новой картинке — новый бюджет попыток. Само по себе состояние
        // сбоя привязано к идентичности и на чужую картинку не действует, но
        // рециклируемая ячейка может вернуться к прежнему URL (X → Y → X), и
        // без сброса она отрисовала бы плейсхолдер, даже не попробовав.
        setWebFailure(null);
        setRetriedIdentity(null);
        reportedFailureRef.current = null;
      }
      // Смена только режима раскрытия у картинки, чей decode уже подтверждён
      // событием `load`, ничего не сбрасывает: гасить показанные пиксели нечем,
      // а вернуть их обратно уже некому.
      const keepConfirmedDecode =
        !identityChanged &&
        decodedIdentityRef.current !== null &&
        decodedIdentityRef.current === currentImageIdentityKey;
      if (!keepConfirmedDecode) {
        setWebLoaded(
          !revealOnLoadOnly && Boolean(
            currentImageIdentityKey && loadedWebImageBaseCache.has(currentImageIdentityKey)
          )
        );
      }
    }
  }, [currentImageIdentityKey, revealOnLoadOnly]);

  const handleWebLoad = useCallback((
    _resolvedSrc: string,
    naturalSize?: { width: number; height: number },
  ) => {
    if (currentImageIdentityKey) {
      loadedWebImageBaseCache.add(currentImageIdentityKey);
      decodedIdentityRef.current = currentImageIdentityKey;
    }
    setWebLoaded(true);
    // Состояние сбоя снимают только НАСТОЯЩИЕ пиксели.
    //
    // `WebMainImage` рапортует загрузку и по догадке `loadedWebImageBaseCache`
    // (тот же файл уже грузился в другой карточке): тогда «загрузка» приходит
    // РАНЬШЕ реального события `error` и у неё нет `naturalSize`. Пока такая
    // догадка возвращала бюджет попыток, сбойная картинка уходила в бесконечный
    // цикл ремоунт → запрос → ошибка.
    if (naturalSize) setWebFailure(null);
    onLoad?.();
  }, [currentImageIdentityKey, onLoad]);

  /**
   * Первый сбой — одна повторная попытка ТЕМ ЖЕ URL после паузы: ключ узла
   * получает суффикс `-retry`, React выбрасывает битый `<img>` и монтирует
   * новый, браузер повторяет запрос. Cache-busting-параметра здесь быть не
   * может: второй URL на тот же visual slot ломает инвариант #1208 и
   * `check:image-architecture`.
   *
   * `onError` наружу вызывается на терминальном сбое, а не на первой попытке:
   * потребители (`ArticleListItem`, `UnifiedTravelCard`) держат на нём своё
   * состояние «картинки нет», и поднимать его до исчерпания ретрая рано.
   */
  const handleWebError = useCallback(() => {
    if (!currentImageIdentityKey) return;
    setWebFailure((previous) => {
      const active =
        previous && previous.identity === currentImageIdentityKey ? previous : null;
      // Ошибка может прийти только от смонтированного узла, то есть в фазах
      // «первый показ» (записи нет) и `retrying`.
      if (!active) return { identity: currentImageIdentityKey, phase: 'waiting' };
      if (active.phase === 'retrying') return { identity: currentImageIdentityKey, phase: 'failed' };
      return active;
    });
  }, [currentImageIdentityKey]);

  // Терминальный сбой сообщаем вызывающему из эффекта, а не из сеттера: вызов
  // чужого колбэка внутри updater'а состояния запрещён (React зовёт его в фазе
  // рендера и может повторить).
  useEffect(() => {
    if (activeWebFailure?.phase !== 'failed') return;
    if (reportedFailureRef.current === activeWebFailure.identity) return;
    reportedFailureRef.current = activeWebFailure.identity;
    onError?.();
  }, [activeWebFailure, onError]);

  // Пауза перед единственным ретраем. Разброс не даёт всем карточкам страницы
  // повторить запрос синхронно и собрать новую пачку (см. замер выше).
  useEffect(() => {
    if (activeWebFailure?.phase !== 'waiting') return;
    const identity = activeWebFailure.identity;
    const timer = setTimeout(
      () => {
        setRetriedIdentity(identity);
        setWebFailure({ identity, phase: 'retrying' });
      },
      WEB_RETRY_BASE_DELAY_MS + Math.random() * WEB_RETRY_JITTER_MS,
    );
    return () => clearTimeout(timer);
  }, [activeWebFailure]);

  const prefetchHref = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (webOptimizedSource) return webOptimizedSource;
    if (resolvedSource && typeof resolvedSource !== 'number') {
      const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
      return uri || null;
    }
    return src ?? null;
  }, [webOptimizedSource, resolvedSource, src]);

  const canUseResourceHint = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!prefetchHref) return false;
    if (typeof window === 'undefined') return false;
    try {
      const resolved = new URL(prefetchHref, window.location.origin);
      return resolved.origin === window.location.origin;
    } catch {
      return false;
    }
  }, [prefetchHref]);

  const shouldAddWebPrefetchHint = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!prefetch) return false;
    if (resolvedLoading !== 'lazy') return false;
    if (priority !== 'low') return false;
    return true;
  }, [prefetch, resolvedLoading, priority]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (shouldDisableNetwork) return;
    if (!shouldAddWebPrefetchHint) return;
    if (!prefetchHref) return;
    if (!canUseResourceHint) return;
    if (typeof document === 'undefined') return;

    // Keep this as a low-priority prefetch hint only for genuinely non-critical,
    // lazily rendered same-origin images. Critical images are already requested
    // by the actual <img> element via loading/fetchPriority and should not add
    // extra head hints that can survive route changes and trigger browser warnings.
    const rel = 'prefetch';
    const id = `img-hint-${encodeURIComponent(prefetchHref)}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = rel;
    // Атрибутом, а не свойством: для `rel=prefetch` `as` обязателен, иначе браузер
    // кладёт ресурс в кэш без нужного destination и повторно скачивает его при показе.
    link.setAttribute('as', 'image');
    link.href = prefetchHref;
    document.head.appendChild(link);

    // Удаляем узел при unmount / смене prefetchHref — иначе в ленивых списках
    // <head> копит по одному осиротевшему <link> на каждый уникальный URL.
    return () => {
      link.remove();
    };
  }, [shouldAddWebPrefetchHint, prefetchHref, shouldDisableNetwork, canUseResourceHint]);

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: resolvedBorderRadius,
        },
        style,
      ]}
      {...(Platform.OS === 'web' && testID ? ({ 'data-testid': testID } as any) : {})}
      testID={Platform.OS === 'web' ? undefined : testID}
    >
      {resolvedSource && !shouldDisableNetwork && !hasWebLoadError ? (
        <>
          {shouldRenderDataPlaceholder ? (
            <ImageDataPlaceholder
              blurhash={useBlurhashPlaceholder ? normalizedPlaceholderBlurhash : null}
              color={normalizedPlaceholderColor || null}
              borderRadius={resolvedBorderRadius}
              testID={testID ? `${testID}-data-placeholder` : undefined}
            />
          ) : null}
          {shouldRenderWebPlaceholder && webPlaceholderSrc ? (
            <img
              key={`placeholder-${webMediaInstanceKey}`}
              aria-hidden="true"
              src={webPlaceholderSrc}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: resolvedBorderRadius,
                filter: 'blur(12px) saturate(1.05)',
                transform: 'scale(1.08)',
                zIndex: 0,
                display: 'block',
                pointerEvents: 'none',
              }}
              decoding="async"
              // @ts-ignore -- fetchPriority is a valid img attribute not in React DOM typings yet
              fetchPriority="low"
            />
          ) : null}
          {Platform.OS === 'web' && !isJest && !blurOnly && webMainSrc ? (
            <WebMainImage
              key={`main-${webMediaInstanceKey}${hasRetriedWebLoad ? '-retry' : ''}`}
              src={webMainSrc}
              srcSet={webSrcSet}
              sizes={webSizes}
              alt={alt || ''}
              width={typeof width === 'number' ? width : 400}
              height={typeof height === 'number' ? height : 300}
              fit={fit}
              borderRadius={resolvedBorderRadius}
              loading={resolvedLoading}
              priority={priority}
              loaded={effectiveWebLoaded}
              onLoad={handleWebLoad}
              onError={handleWebError}
              showImmediately={shouldShowWebImageImmediately}
            />
          ) : !blurOnly && (
          <OptimizedImage
            source={
              Platform.OS === 'web' && webOptimizedSource
                ? { uri: webOptimizedSource }
                : nativeSharpSource ?? resolvedSource
            }
            recyclingKey={recyclingKey}
            height={typeof height === 'number' ? height : undefined}
            contentFit={contentFit}
            blurBackground={
              Platform.OS === 'web' || hasDataPlaceholder ? false : blurBackground
            }
            // A backend blurhash/color is already a local background layer. Do
            // not mount the sharp URL again as a native blur sibling.
            synchronizeBlurReveal={hasDataPlaceholder ? false : synchronizeNativeBlurReveal}
            blurBackgroundRadius={blurRadius}
            blurOnly={blurOnly}
            borderRadius={borderRadius}
            placeholder={
              hasDataPlaceholder
                ? undefined
                : DESIGN_TOKENS.defaultBlurhash
            }
            priority={priority}
            loading={resolvedLoading}
            alt={alt}
            transition={transition}
            cachePolicy={cachePolicy}
            imageProps={{ ...(imageProps || {}), ...(webImageProps || {}) }}
            showLoadingIndicator={hasDataPlaceholder ? false : showLoadingIndicator}
            style={
              hasDataPlaceholder
                ? ({ backgroundColor: 'transparent', position: 'relative', zIndex: 1 } as any)
                : undefined
            }
            onLoad={onLoad}
            // Не заводить сюда `handleWebError` (#1212): `OptimizedImage` зовёт
            // `onError` на КАЖДОЙ попытке, включая те, которые сам собирается
            // ретраить (`MAX_RETRY_ATTEMPTS`), и рисует свой нейтральный
            // `errorContainer`. Собственное состояние ошибки сняло бы его с
            // экрана раньше ретрая — ровно тот исход, который закрывал #802.
            onError={onError}
          />
          )}
          {!!overlayColor && (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: overlayColor, borderRadius, pointerEvents: 'none' },
              ]}
            />
          )}
          {shouldRenderWebSkeleton ? (
            <ShimmerOverlay style={StyleSheet.absoluteFill} />
          ) : null}
        </>
      ) : (
        // Нейтральный плейсхолдер (AGENTS.md 4.2): без текста, иконок и
        // акцентных цветов. Сюда же падает web-сбой загрузки (#1212) — бокс
        // держит ту же геометрию и радиус, что и медиа, поэтому layout не
        // прыгает, а alt-текста в кадре не остаётся.
        <View
          style={[styles.placeholder, { borderRadius: resolvedBorderRadius }]}
          accessibilityElementsHidden={true}
          aria-hidden={true}
        />
      )}
    </View>
  );
}

type ImageDataPlaceholderProps = {
  blurhash?: string | null;
  color?: string | null;
  borderRadius?: number;
  style?: any;
  testID?: string;
};

/**
 * Поля letterbox под `contain`-фото заливает `dominant_color` из манифеста
 * (размытой подложки на web больше нет, см. решение владельца 2026-08-02).
 * Сплошной цвет читается как второй фон и спорит с поверхностью карточки,
 * поэтому кладём его полупрозрачным: под ним остаётся сама карточка.
 */
export const LETTERBOX_FILL_ALPHA = 0.75;

const withLetterboxAlpha = (hexColor: string): string => {
  const value = hexColor.replace('#', '');
  // Источник уже задал собственную альфу (#rrggbbaa) — не переопределяем.
  if (value.length === 8) return hexColor;
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return hexColor;
  return `rgba(${r}, ${g}, ${b}, ${LETTERBOX_FILL_ALPHA})`;
};

/** Local-only preview layer: blurhash is decoded by expo-image, color by RN/CSS. */
export function ImageDataPlaceholder({
  blurhash,
  color,
  borderRadius = 0,
  style,
  testID,
}: ImageDataPlaceholderProps) {
  const normalizedBlurhash = typeof blurhash === 'string' ? blurhash.trim() : '';
  const normalizedColor =
    typeof color === 'string' &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.trim())
      ? color.trim()
      : '';

  if (!normalizedBlurhash && !normalizedColor) return null;

  return (
    <View
      testID={testID}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: normalizedColor ? withLetterboxAlpha(normalizedColor) : 'transparent',
          borderRadius,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        },
        style,
      ]}
      aria-hidden={Platform.OS === 'web' ? true : undefined}
      accessibilityElementsHidden={Platform.OS !== 'web' ? true : undefined}
      importantForAccessibility={
        Platform.OS !== 'web' ? 'no-hide-descendants' : undefined
      }
      // Стили <img> внутри задаёт expo-image, а не мы, поэтому слой не может
      // сам обойти внешние правила вроде `… img{max-width:…}`. Маркер включает
      // критическое правило `[data-hero-data-placeholder="true"] img`, которое
      // возвращает слою полную ширину контейнера.
      {...(Platform.OS === 'web'
        ? { 'data-hero-data-placeholder': 'true' }
        : null)}
    >
      {normalizedBlurhash ? (
        <ExpoImage
          source={{ blurhash: normalizedBlurhash, width: 32, height: 32 }}
          contentFit="cover"
          transition={0}
          style={StyleSheet.absoluteFill}
          aria-hidden={Platform.OS === 'web' ? true : undefined}
          accessibilityElementsHidden={Platform.OS !== 'web' ? true : undefined}
          importantForAccessibility={
            Platform.OS !== 'web' ? 'no-hide-descendants' : undefined
          }
        />
      ) : null}
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});

export default memo(ImageCardMedia);

export { prefetchImage } from '@/components/ui/OptimizedImage';
export { isIOSSafariUserAgent, isIOSWebKitUserAgent };
