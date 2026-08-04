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
//
// Это верно только для legacy-формата `variants`. В готовых `srcset*` (#1202)
// URL идут w-only, `fit=` там нет вовсе — см. `resolveManifestSources`.
const VARIANT_FIT_PARAM = /[?&]fit=([a-z]+)/i

function readVariantFit(url: string): string | null {
  const match = VARIANT_FIT_PARAM.exec(url)
  return match ? match[1].toLowerCase() : null
}

/** Дескриптор ширины в srcset: `<url> 640w`. */
const SRCSET_WIDTH_DESCRIPTOR = /^(\S+)\s+(\d+)w$/

/**
 * Готовые источники манифеста (#1202/#1203) — канонический источник кандидатов.
 *
 * Берём ОБЪЕДИНЕНИЕ всех `srcset*`, а не набор одного слота. Причина в том, что
 * `fit` перестал влиять на адрес: проба прода 2026-08-03 на одной ширине даёт
 * байт-в-байт один ответ для `?w=640`, `?w=640&fit=cover`, `?w=640&fit=contain`
 * и `?w=640&q=70` (46 212 B во всех четырёх). Сервер хранит один файл на ширину,
 * кадрирует CSS, поэтому `srcset_cover` и `srcset_contain` — это подсказка о том,
 * какие ступени уместны слоту, а не разные картинки.
 *
 * Брать только набор своего `fit` нельзя: у обложки `srcset_contain` начинается
 * с 720, и мобильный hero (слот 390 CSS, DPR 2 → 780) выбрал бы 960 вместо
 * нынешних 720 — то есть переход «на готовые URL» сам по себе утяжелил бы
 * страницу. Какие ступени предлагать слоту, по-прежнему решает `widths`.
 *
 * Объединение даёт ровно лестницу производных БЕЗ мастера: у точки маршрута в
 * `variants` лежит ещё и мастер 1200, которого в `srcset*` нет, и попадать в
 * кандидаты он не должен (#1112 — «тихая отдача оригинала»).
 *
 * #1256: тело статьи читает те же ступени через эту функцию, поэтому она
 * публичная. Своего разбора `srcset*` заводить нельзя — расхождение двух копий
 * разбора стоило бы ровно того же, что расхождение двух копий лестницы.
 */
export type ManifestImageRung = { width: number; url: string }

export function resolveManifestImageRungs(
  entry: TravelMediaImage | null | undefined,
): ManifestImageRung[] {
  if (!entry) return []

  const byWidth = new Map<number, string>()
  const sources = [entry.srcset, entry.srcset_cover, entry.srcset_contain, entry.srcset_print]
  for (const srcset of sources) {
    if (typeof srcset !== 'string' || !srcset.trim()) continue
    for (const rawCandidate of srcset.split(',')) {
      const candidate = rawCandidate.trim()
      if (!candidate) continue
      const match = SRCSET_WIDTH_DESCRIPTOR.exec(candidate)
      if (!match) continue
      const width = Number(match[2])
      if (!Number.isFinite(width) || width <= 0) continue
      if (byWidth.has(width)) continue
      const url = resolveMediaVariantUrl(match[1])
      if (!url) continue
      byWidth.set(width, url)
    }
  }

  return Array.from(byWidth.entries())
    .map(([width, url]) => ({ width, url }))
    .sort((a, b) => a.width - b.width)
}

function resolveManifestSources(entry: TravelMediaImage | null | undefined): ResolvedVariant[] {
  return resolveManifestImageRungs(entry).map((rung) => ({ ...rung, fit: null }))
}

/**
 * Legacy-разбор `variants` — единственный фолбэк, когда готовых `srcset*` нет.
 *
 * Держится ровно до тех пор, пока манифест не покроет оставшиеся семейства
 * (тело статьи, аватары — остаток #1202). Расширять его нельзя: это ровно тот
 * путь, ради устранения которого заведена #1203.
 */
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
  // Оба поля отдаются вместе, а выбор делает потребитель. Раньше здесь стояло
  // «либо-либо» с приоритетом blurhash, и web-слой из-за этого оставался без
  // `dominantColor`: у карточки с blurhash поля letterbox нечем было залить,
  // приходилось поднимать сетевую blur-подложку. На web blurhash дорог —
  // expo-image декодирует его в canvas 32×32, апскейлит ×10 и делает PNG-blob
  // (320×320, ~48 КБ на карточку), поэтому там нужен именно цвет.
  const blurhash = typeof entry?.blurhash === 'string' ? entry.blurhash.trim() : ''
  const rawColor =
    typeof entry?.dominant_color === 'string' ? entry.dominant_color.trim() : ''
  const dominantColor = DOMINANT_COLOR_PATTERN.test(rawColor) ? rawColor : null
  return { blurhash: blurhash || null, dominantColor }
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

/**
 * `sizes` слота: значение вызывающего кода → подсказка манифеста для этого же
 * режима кадрирования → общая подсказка → `100vw`.
 *
 * Подсказка слота берётся только вместе с его набором ступеней. Манифест может
 * их рассогласовать: у точки маршрута `sizes_hint_contain` обещает `1280px`,
 * хотя `srcset_contain` пуст, а самая широкая производная точки — 960. Такая
 * подсказка заставила бы браузер всегда брать верхнюю ступень вместо нужной,
 * поэтому при пустом наборе слота остаётся общая подсказка.
 */
function resolveSizesHint(
  entry: TravelMediaImage | null | undefined,
  fit: MediaResponsiveOptions['fit'],
): string | null {
  if (!entry) return null
  const hasSlotSources = (srcset: string | null | undefined): boolean =>
    typeof srcset === 'string' && srcset.trim().length > 0
  const bySlot =
    fit === 'contain' && hasSlotSources(entry.srcset_contain)
      ? entry.sizes_hint_contain
      : fit === 'cover' && hasSlotSources(entry.srcset_cover)
        ? entry.sizes_hint_cover
        : null
  const hint = bySlot ?? entry.sizes_hint
  return typeof hint === 'string' && hint.trim() ? hint : null
}

// Собирает { src, srcSet, sizes } из backend-вариантов; null = манифест непригоден,
// вызывающий код обязан использовать клиентскую сборку URL.
export function buildResponsiveImagePropsFromMedia(
  entry: TravelMediaImage | null | undefined,
  options: MediaResponsiveOptions = {},
): { src: string; srcSet?: string; sizes?: string } | null {
  // Готовые источники бэкенда — канонический путь; разбор `variants` остаётся
  // единственным фолбэком для семейств, которые манифест ещё не покрывает.
  const fromManifest = resolveManifestSources(entry)
  const allVariants = fromManifest.length ? fromManifest : resolveVariants(entry)
  if (!allVariants.length) return null

  // Вариант без `fit` в URL считаем нейтральным — он подходит любому слоту.
  // У готовых источников `fit` всегда null (адреса w-only), так что фильтр
  // работает только на legacy-`variants`, где режим закодирован в самом URL.
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
    sizes: options.sizes ?? resolveSizesHint(entry, options.fit) ?? '100vw',
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
