// utils/imageProxy.ts
// J4: Image URL proxy/optimization (extracted from imageOptimization.ts)

import { Platform } from 'react-native';
import { normalizeAbsoluteMediaUrl, isPrivateOrLocalHost } from '@/utils/mediaUrl';

// #1171: здесь были ещё `height`, `dpr` и `blur`. Прокси не принимает ни один из
// них (ресайз идёт только по `w`), поэтому их значения никогда не доезжали до
// запроса — но 13 мест в приложении их вычисляли и передавали, создавая ложное
// впечатление, что высота влияет на вес картинки. Не возвращать: retina-вариант
// получается умножением самой `width` на DPR, см. комментарий у `resolveProxyWidth`.
export interface ImageOptimizationOptions {
  width?: number;
  quality?: number;
  format?: 'avif' | 'webp' | 'jpg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill';
}

const optimizedUrlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 400;
// Список того, что вычищается из входящего URL. Он ШИРЕ, чем набор отправляемых
// параметров: в базе и в легаси-разметке лежат URL с `h`/`dpr`/`blur`, и их нужно
// снять, даже если сами мы такие параметры больше не строим.
const OPTIMIZATION_QUERY_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'dpr', 'blur'];
const MEDIA_FILE_PATH = /^\/(gallery|travel-image|travel-description-image|address-image)\/(?:[^?#]*\/conversions\/|\d+\/(gallery|travel-image|travel-description-image|address-image)\/|[^/?#]+$)/i;

// #1113: `/quest-cover/**` и `/avatar/**` тоже обслуживает image-proxy (проверено на
// проде 2026-07-28: `/quest-cover/...png?w=320&q=70&fit=cover` → 7 884 B при оригинале
// 209 КБ; `/avatar/...webp?w=160` → 1 362 B при оригинале 86 КБ), но их структура пути
// (`quests/16/main/file.png`, `profile/82/avatar/file.webp`) не подходит под
// MEDIA_FILE_PATH. Из-за этого они уходили в ветку «свой домен», где оптимизация
// зависит от совпадения origin с EXPO_PUBLIC_API_URL — и в любой конфигурации с
// проксированным API (dev/preprod) параметры молча не добавлялись: `srcSet` собирался
// из одинаковых URL без `w`, а браузер грузил оригинал на плитку 132×132.
const PROXY_MEDIA_PREFIX = /^\/(quest-cover|avatar)\//i;

const getPublicApiOrigin = (): string | null => {
  try {
    const raw = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (!raw) return null;
    const base = raw.replace(/\/api\/?$/i, '');
    const parsed = new URL(base);
    if (!parsed.origin) return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

const isTestEnv = () =>
  typeof process !== 'undefined' &&
  (process.env as Record<string, unknown>)?.NODE_ENV === 'test';

// #1161: статический гейт (`scripts/check-image-architecture.js`) ловит вызов без
// ширины в исходниках, но ширина может обнулиться и в рантайме — например слот ещё
// не измерен и приходит 0. Такой запрос уходит без `w`, и прокси отдаёт мастер
// целиком (132 344 B против 2 582 B на плитке 132×132, замер прода 2026-07-30).
// В DEV показываем виновника один раз на URL, чтобы не залить консоль на списке.
const warnedWidthlessUrls = new Set<string>();

const warnMissingProxyWidth = (url: string): void => {
  if (!__DEV__ || isTestEnv()) return;
  if (warnedWidthlessUrls.has(url)) return;
  warnedWidthlessUrls.add(url);

  // Первый кадр стека вне этого модуля — вызывающий компонент.
  const caller = String(new Error().stack || '')
    .split('\n')
    .slice(1)
    .find((frame) => !frame.includes('imageProxy'))
    ?.trim();

  console.warn(
    `[images] медиа-URL строится без ширины — прокси отдаст мастер целиком: ${url}` +
      (caller ? `\n  вызов: ${caller}` : '') +
      '\n  ширину надо считать от измеренного слота, см. docs/features/images.md (#1161)'
  );
};

// Квантование запрашиваемого варианта в фиксированный набор, чтобы бэкенд-прокси
// отдавал небольшое кэш-дружелюбное число конверсий, а не уникальный файл на
// каждую попиксельную ширину / дробный DPR. Каждая уникальная комбинация
// (w,h,q,dpr,f,fit) = отдельная СИНХРОННАЯ конвертация на проде (1 vCPU / 1.8 ГБ):
// схлопывание почти одинаковых вариантов поднимает попадание кэша и режет
// CPU/память/диск на конвертациях (см. тикет #628 — своп-штормы от переподписки).
//
// Лестница обязана совпадать с `ALLOWED_IMAGE_WIDTHS` бэкенда — источник правды
// `GET /api/media/proxy-contract`, соответствие закреплено тестом
// `__tests__/utils/imageProxy.ladder.test.ts`. Полное описание пайплайна и
// контракта — `docs/features/images.md`.
//
// ИСТОРИЯ, чтобы не откатили обратно. До #1112 прокси неподдержанную ширину не
// снэпил и молча отдавал исходный файл целиком, поэтому здесь держали урезанное
// подмножество «проверенно рабочих» ступеней. Прокси починили: он округляет вверх
// (`bisect_left` по whitelist) и никогда не апскейлит. Замеры прода 2026-07-30 на
// `travel-image/682/conversions/10f0a8f2….webp` (исходник 1024×576):
//   w=47  → 2 582 B  — идентично w=96,  округление вверх работает
//   w=240 → 17 738 B — идентично w=320, округление вверх работает
//   w=720 → 69 494 B · w=960 → 112 368 B — ступени обслуживаются
//   w≥1024 → 132 344 B — это не поломка: источник шириной 1024, апскейла нет
//
// Пока здесь не хватало 720/960/1024/1200, кандидат srcSet ×1.5 от 640 (=960)
// схлопывался вверх в 1280, и браузер на слоте 368 CSS @DPR2 (нужно 780) выбирал
// 1280 вместо 800: 132 344 B вместо 53 104 B, ~2.5× перерасхода на карточку (#1170).
const DIMENSION_LADDER = [
  32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500,
];

const MAX_LADDER_WIDTH = DIMENSION_LADDER[DIMENSION_LADDER.length - 1];

const snapDimensionUp = (value: number): number => {
  const v = Math.round(value);
  if (!Number.isFinite(v) || v <= 0) return v;
  for (const rung of DIMENSION_LADDER) {
    if (v <= rung) return rung;
  }
  return MAX_LADDER_WIDTH;
};

/**
 * Ступень лестницы для произвольной ширины. Экспортируется для кода, который строит
 * медиа-URL сам, а не через `optimizeImageUrl` — например печать
 * (`utils/printImageUrl.ts`): лестница обязана остаться в одном месте, иначе она
 * разъедется, как уже было с копией в `scripts/generate-seo-pages.js` (#1170).
 */
export const snapProxyWidth = (value: number): number => snapDimensionUp(value);

/** Список параметров прокси — снимается с входящего URL перед пересборкой. */
export const PROXY_QUERY_PARAMS = OPTIMIZATION_QUERY_PARAMS;

// #1113/#1116: `dpr` и `h` больше не отправляются — прокси игнорирует оба, но каждое
// уникальное значение создаёт отдельный URL, отдельную запись в nginx-кэше и отдельную
// СИНХРОННУЮ конверсию. Замеры прода 2026-07-28:
//   `?w=640&q=70&fit=contain`             → 36 094 B
//   `?w=640&q=70&fit=contain&dpr=2` / `dpr=3` → 36 094 B (байт-в-байт то же)
//   `?w=320&h=240&q=70&fit=cover`         → 11 562 B (ресайз по одному лишь `w`)
//   `?h=240&q=60&fit=contain`             → 132 344 B — ОРИГИНАЛ: запрос без `w`
//                                            прокси не отвергает, а молча отдаёт исходник
//
// Побочный (и важный) эффект отказа от `h`: URL перестаёт зависеть от высоты
// контейнера, поэтому изменение измеренных пропорций больше не порождает второй
// запрос того же фото. Клиентам, которым нужен retina-вариант, следует умножать саму
// `width` на DPR (так делают слайдер и buildNativeSharpImageSource).
//
// Если `width` не задана, размерных параметров не будет вовсе: лучше честно получить
// оригинал, чем отправить `h`, который гарантированно даёт оригинал плюс лишний
// cache-key. Вызывающий код обязан передавать ширину — см. #1113.
const resolveProxyWidth = (options: ImageOptimizationOptions): number | null => {
  if (!options.width || options.width <= 0) return null;
  return snapDimensionUp(options.width);
};

// Quality к шагу 10 (72/78/82 → 70/80/80) — меньше вариантов при незаметной разнице.
const snapQuality = (value: number): number => {
  const q = Math.min(100, Math.max(1, Math.round(value)));
  return Math.min(100, Math.max(10, Math.round(q / 10) * 10));
};

/** См. `snapProxyWidth`: та же причина — квантование quality живёт в одном месте. */
export const snapProxyQuality = (value: number): number => snapQuality(value);

// #1171: здесь жили `clearImageOptimizationCache` и `getImageCacheStats` — ни одна
// из них не вызывалась в приложении, только в собственных тестах. Кэш живёт весь
// сеанс и очищается вытеснением; изоляция тестов держится на том, что публичный
// origin входит в ключ (см. `cacheKey` ниже), а не на внешнем сбросе.
export function optimizeImageUrl(
  originalUrl: string | null | undefined,
  options: ImageOptimizationOptions = {}
): string | undefined {
  if (originalUrl == null || originalUrl === '') return undefined;

  const trimmedUrl = normalizeAbsoluteMediaUrl(originalUrl.trim());
  if (!trimmedUrl) return undefined;

  if (/^data:/i.test(trimmedUrl) || /^blob:/i.test(trimmedUrl)) return originalUrl;

  // Metro dev-server assets (`/assets?unstable_path=...`) обслуживаются только локальным
  // бандлером — префикс публичного origin ломает их в dev/preview.
  if (trimmedUrl.includes('unstable_path=')) return originalUrl;

  // Публичный origin входит в ключ, потому что влияет на результат: от него зависит
  // и ветка «свой домен», и префикс абсолютного URL. Без него смена
  // `EXPO_PUBLIC_API_URL` отдавала бы URL, собранный для прежнего хоста.
  const publicOrigin = getPublicApiOrigin();
  const cacheKey = `${publicOrigin ?? ''}|${trimmedUrl}|${options.width ?? ''}|${options.quality ?? ''}|${options.format ?? ''}|${options.fit ?? ''}`;
  const cached = optimizedUrlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const parsedUrl = new URL(trimmedUrl, publicOrigin || 'https://placeholder.invalid');

    if (isPrivateOrLocalHost(parsedUrl.hostname)) return originalUrl;

    if (MEDIA_FILE_PATH.test(parsedUrl.pathname) || PROXY_MEDIA_PREFIX.test(parsedUrl.pathname)) {
      // Media file paths are served by the backend image proxy which understands
      // the same w/h/q/f/fit/blur query params.  Strip stale optimization params
      // and append fresh ones so that the browser fetches a properly-sized variant
      // instead of always downloading the full-resolution original.
      OPTIMIZATION_QUERY_PARAMS.forEach((key) => {
        try { parsedUrl.searchParams.delete(key); } catch { /* noop */ }
      });

      const proxyParams = new URLSearchParams();
      const mediaWidth = resolveProxyWidth(options);
      // Без `w` прокси всё равно отдаст оригинал, поэтому одни только q/fit —
      // это лишний cache-key на тот же байтовый результат. Оставляем голый URL:
      // он самый «горячий» в кэше и не запускает новую конверсию.
      if (mediaWidth) {
        proxyParams.set('w', String(mediaWidth));
        if (options.quality != null) proxyParams.set('q', String(snapQuality(options.quality)));
        if (options.format && options.format !== 'auto') proxyParams.set('f', options.format);
        if (options.fit) proxyParams.set('fit', options.fit);
      } else {
        warnMissingProxyWidth(parsedUrl.toString());
      }

      const paramStr = proxyParams.toString();
      const base = parsedUrl.toString();
      const result = paramStr ? `${base}${base.includes('?') ? '&' : '?'}${paramStr}` : base;

      if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 50);
        keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
      }
      optimizedUrlCache.set(cacheKey, result);
      return result;
    }

    const isOwnDomain = publicOrigin
      ? parsedUrl.origin === new URL(publicOrigin).origin
      : false;

    if (!isOwnDomain) {
      if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 50);
        keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
      }
      optimizedUrlCache.set(cacheKey, trimmedUrl);
      return trimmedUrl;
    }

    OPTIMIZATION_QUERY_PARAMS.forEach((key) => {
      try {
        parsedUrl.searchParams.delete(key);
      } catch {
        // noop
      }
    });

    const format = options.format || 'auto';
    const rawQuality = options.quality != null ? options.quality : (Platform.OS === 'web' ? 80 : 75);
    const quality = snapQuality(rawQuality);
    const fit = options.fit || 'cover';

    const proxyParams = new URLSearchParams();
    const ownDomainWidth = resolveProxyWidth(options);
    // Как и в media-ветке выше: без `w` параметры не дают другого файла,
    // только лишнюю запись в кэше прокси.
    if (ownDomainWidth) {
      proxyParams.set('w', String(ownDomainWidth));
      proxyParams.set('q', String(quality));
      if (format !== 'auto') proxyParams.set('f', format);
      proxyParams.set('fit', fit);
    } else {
      warnMissingProxyWidth(`${publicOrigin}${parsedUrl.pathname}`);
    }

    const imagePath = parsedUrl.pathname + parsedUrl.search;
    const paramStr = proxyParams.toString();
    const optimizedUrl = paramStr
      ? `${publicOrigin}${imagePath}${imagePath.includes('?') ? '&' : '?'}${paramStr}`
      : `${publicOrigin}${imagePath}`;

    if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 50);
      keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
    }
    optimizedUrlCache.set(cacheKey, optimizedUrl);

    return optimizedUrl;
  } catch (error) {
    if (!isTestEnv()) {
      console.warn('Error optimizing image URL:', error);
    }
    return originalUrl;
  }
}

export function buildVersionedImageUrl(
  rawUrl: string,
  updatedAt?: string | null,
  id?: string | number | null
): string {
  if (!rawUrl) return rawUrl;
  const trimmed = normalizeAbsoluteMediaUrl(String(rawUrl).trim());
  if (!trimmed) return rawUrl;
  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed, getPublicApiOrigin() || 'https://placeholder.invalid');
    if (updatedAt) {
      const ts = new Date(updatedAt).getTime();
      if (Number.isFinite(ts)) url.searchParams.set('v', String(ts));
    } else if (id != null) {
      url.searchParams.set('v', String(id));
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getPreferredImageFormat(): 'avif' | 'webp' | 'jpg' {
  if (Platform.OS !== 'web') return 'webp';

  if (typeof document === 'undefined') return 'webp';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) {
      return 'avif';
    }
    if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
      return 'webp';
    }
  } catch {
    // noop
  }
  return 'jpg';
}

// #1171: раньше это был `getOptimalImageSize`, возвращавший `{ width, height }` и
// умевший считать высоту тремя способами (по контейнеру, по aspect ratio, 16/9).
// Ни одна из трёх веток ни на что не влияла: высота уходила в `optimizeImageUrl`,
// который её не отправляет. Осталась единственная реальная задача — перевести
// CSS-ширину в device-пиксели с потолком DPR 2 на web (выше него прирост резкости
// не виден, а байты растут квадратично).
export function getOptimalImageWidth(containerWidth: number): number {
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const dpr = Platform.OS === 'web' ? Math.min(rawDpr, 2) : rawDpr;
  return Math.round(containerWidth * dpr);
}
