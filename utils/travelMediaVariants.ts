// utils/travelMediaVariants.ts
// #716/#715: backend media variants manifest (payload travel: media.cover/gallery/address_images).
// Когда манифест присутствует — предпочитаем готовые backend-варианты/lqip вместо
// клиентской сборки proxy-URL; при отсутствии — прозрачный fallback на текущую сборку.

import { Platform } from 'react-native'

import type { TravelMedia, TravelMediaImage } from '@/types/types'
import { buildResponsiveImageProps } from '@/utils/imageSrcSet'
import { resolveLegacyResizeOrigin, toLegacyResizePath } from '@/utils/mediaUrl'

// Ширина варианта зашита в его имя (thumb_160, card_640, hero_1920, print_2500);
// original без ширины в srcset не попадает.
const VARIANT_NAME_WIDTH = /_(\d{2,4})$/

const getPublicApiOrigin = (): string | null => {
  try {
    const raw = String(process.env.EXPO_PUBLIC_API_URL || '').trim()
    if (!raw) return null
    const origin = new URL(raw.replace(/\/api\/?$/i, '')).origin
    return origin || null
  } catch {
    return null
  }
}

// Манифест отдаёт относительные пути (`/travel-image/...?w=640&q=75&fit=cover`) —
// резолвим против API-origin (fallback: origin страницы → прод), абсолютные оставляем.
//
// URL манифеста уходят прямо в `src`/`srcSet` мимо `optimizeImageUrl`, поэтому
// переписывание legacy-конверсии на её собственный роут нужно и здесь. Без него
// карточка каталога адресует model-owned роут, который в proxy-contract v4 объявлен
// `source_passthrough`: ширина игнорируется, приезжает мастер, ответ помечен
// `no-store` — то есть заново качается на каждый показ. См. `toLegacyResizePath`.
export function resolveMediaVariantUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed

  const origin =
    getPublicApiOrigin() ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://metravel.by')

  const legacyResizePath = toLegacyResizePath(trimmed)
  if (legacyResizePath) {
    try {
      return new URL(legacyResizePath, resolveLegacyResizeOrigin(trimmed) || origin).toString()
    } catch {
      return null
    }
  }

  if (/^https?:/i.test(trimmed)) return trimmed

  try {
    return new URL(trimmed, origin).toString()
  } catch {
    return null
  }
}

type ResolvedVariant = { width: number; url: string; fit: string | null }

// В именах вариантов режим кадрирования не закодирован (`thumb_320`, `hero_1280`),
// зато он есть в самом URL: `?w=320&q=72&fit=cover` против `?w=1280&q=78&fit=contain`.
const VARIANT_FIT_PARAM = /[?&]fit=([a-z]+)/i

function readVariantFit(url: string): string | null {
  const match = VARIANT_FIT_PARAM.exec(url)
  return match ? match[1].toLowerCase() : null
}

function resolveVariants(entry: TravelMediaImage | null | undefined): ResolvedVariant[] {
  const variants = entry?.variants
  if (!variants) return []

  const resolved: ResolvedVariant[] = []
  for (const [name, rawUrl] of Object.entries(variants)) {
    const widthMatch = VARIANT_NAME_WIDTH.exec(name)
    if (!widthMatch) continue
    const width = Number(widthMatch[1])
    if (!Number.isFinite(width) || width <= 0) continue
    const url = resolveMediaVariantUrl(rawUrl)
    if (!url) continue
    resolved.push({ width, url, fit: readVariantFit(url) })
  }
  return resolved.sort((a, b) => a.width - b.width)
}

// Вариант шире запрошенного максимума больше чем на четверть — это уже не
// «ближайший подходящий», а лишние байты. Замер прода 2026-07-30 на обложке
// 1080×1080: `w=720&q=72&fit=contain` = 104 946 B против `w=1280&q=78&fit=contain`
// = 210 858 B. Манифест этой обложки не содержит contain-варианта уже 1280, поэтому
// слот 720 схлопывался в 1280 и мобильный hero весил вдвое больше нужного.
const MAX_VARIANT_OVERSIZE_RATIO = 1.25

function pickVariantForWidth(
  variants: ResolvedVariant[],
  targetWidth: number,
): ResolvedVariant | null {
  if (!variants.length) return null
  for (const variant of variants) {
    if (variant.width >= targetWidth) return variant
  }
  return variants[variants.length - 1]
}

/**
 * #1167: фронт больше НЕ запрашивает `lqip_url`.
 *
 * Смысл LQIP — показать что-то до прихода основной картинки. С #1127 в манифесте
 * есть `blurhash` и `dominant_color`: подложка рисуется из данных, без сетевого
 * запроса вообще. `lqip_url` при этом оставался фолбэком и был реальным файлом,
 * который реально качался — то есть на слот приходилось ДВА запроса вместо одного,
 * и на каждую картинку в библиотеке приходился лишний вариант (`?w=32&q=35`).
 *
 * Хелпер оставлен только для чтения поля из манифеста в тестах/скриптах; в
 * рендер-путь он не входит. Прекращение выдачи `lqip_url` на бэкенде — отдельная
 * задача, до неё поле просто игнорируется.
 */
export function getMediaLqipUrl(entry: TravelMediaImage | null | undefined): string | null {
  return resolveMediaVariantUrl(entry?.lqip_url)
}

const DOMINANT_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export type MediaPlaceholderData = {
  blurhash: string | null
  dominantColor: string | null
}

/**
 * Canonical media-placeholder precedence (#1127, сужено в #1167).
 *
 * Blurhash и dominant color рисуются локально и не добавляют ни одного запроса
 * перед основной картинкой. Ветка `lqip_url` убрана: она была единственной, которая
 * порождала второй сетевой запрос на слот. Если данных нет — подложки просто нет,
 * и слот остаётся нейтральным до прихода основного изображения; это дешевле, чем
 * тянуть ради него отдельный файл.
 */
export function getMediaPlaceholderData(
  entry: TravelMediaImage | null | undefined,
): MediaPlaceholderData {
  const blurhash = typeof entry?.blurhash === 'string' ? entry.blurhash.trim() : ''
  if (blurhash) {
    return { blurhash, dominantColor: null }
  }

  const rawColor =
    typeof entry?.dominant_color === 'string' ? entry.dominant_color.trim() : ''
  const dominantColor = DOMINANT_COLOR_PATTERN.test(rawColor) ? rawColor : null
  return { blurhash: null, dominantColor }
}

export interface MediaResponsiveOptions {
  widths?: readonly number[]
  maxWidth?: number
  sizes?: string
  /**
   * Режим кадрирования, который нужен вызывающему слоту. Если задан — варианты
   * манифеста с другим `fit` в один `srcset` не попадают: `cover` обрезает кадр,
   * `contain` вписывает его, и браузер, выбирая кандидата по DPR, показывал бы
   * на разных телефонах разную композицию одного фото.
   */
  fit?: 'cover' | 'contain' | 'fill'
}

// Собирает { src, srcSet, sizes } из backend-вариантов; null = манифест непригоден,
// вызывающий код обязан использовать клиентскую сборку URL.
export function buildResponsiveImagePropsFromMedia(
  entry: TravelMediaImage | null | undefined,
  options: MediaResponsiveOptions = {},
): { src: string; srcSet?: string; sizes?: string } | null {
  const allVariants = resolveVariants(entry)
  if (!allVariants.length) return null

  // Вариант без `fit` в URL считаем нейтральным — он подходит любому слоту.
  const variants = options.fit
    ? allVariants.filter((variant) => variant.fit === null || variant.fit === options.fit)
    : allVariants
  if (!variants.length) return null

  const maxWidth = options.maxWidth ?? 1920
  const target = pickVariantForWidth(variants, maxWidth)
  if (!target) return null
  // Манифест не покрывает этот слот подходящей шириной — пусть вызывающий код
  // соберёт точные URL через прокси, вместо того чтобы тянуть oversize-вариант.
  if (options.fit && target.width > maxWidth * MAX_VARIANT_OVERSIZE_RATIO) return null

  if (Platform.OS !== 'web') return { src: target.url }

  const requestedWidths = options.widths?.length
    ? options.widths
    : variants.map((variant) => variant.width)
  const candidates = new Map<number, string>()
  for (const width of requestedWidths) {
    const variant = pickVariantForWidth(variants, width)
    if (variant) candidates.set(variant.width, variant.url)
  }
  const srcSet = Array.from(candidates.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ')

  return {
    src: target.url,
    srcSet: srcSet || undefined,
    sizes: options.sizes ?? entry?.sizes_hint ?? '100vw',
  }
}

// Canonical-предпочтение: backend-манифест, иначе текущая клиентская сборка (imageSrcSet).
export function buildResponsiveImagePropsPreferringMedia(
  entry: TravelMediaImage | null | undefined,
  baseUrl: string,
  options: Parameters<typeof buildResponsiveImageProps>[1] = {},
): { src: string; srcSet?: string; sizes?: string } {
  const fromMedia = buildResponsiveImagePropsFromMedia(entry, {
    widths: options.widths,
    maxWidth: options.maxWidth,
    sizes: options.sizes,
    fit: options.fit,
  })
  if (fromMedia) return fromMedia
  return buildResponsiveImageProps(baseUrl, options)
}

export function findGalleryMediaImage(
  media: TravelMedia | null | undefined,
  imageId: number | string | null | undefined,
): TravelMediaImage | null {
  if (!media?.gallery?.length || imageId == null) return null
  const target = String(imageId)
  return media.gallery.find((item) => String(item.id) === target) ?? null
}
