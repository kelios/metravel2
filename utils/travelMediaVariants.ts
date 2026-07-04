// utils/travelMediaVariants.ts
// #716/#715: backend media variants manifest (payload travel: media.cover/gallery/address_images).
// Когда манифест присутствует — предпочитаем готовые backend-варианты/lqip вместо
// клиентской сборки proxy-URL; при отсутствии — прозрачный fallback на текущую сборку.

import { Platform } from 'react-native'

import type { TravelMedia, TravelMediaImage } from '@/types/types'
import { buildResponsiveImageProps } from '@/utils/imageSrcSet'

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
export function resolveMediaVariantUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed

  const origin =
    getPublicApiOrigin() ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://metravel.by')
  try {
    return new URL(trimmed, origin).toString()
  } catch {
    return null
  }
}

type ResolvedVariant = { width: number; url: string }

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
    resolved.push({ width, url })
  }
  return resolved.sort((a, b) => a.width - b.width)
}

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

export function getMediaLqipUrl(entry: TravelMediaImage | null | undefined): string | null {
  return resolveMediaVariantUrl(entry?.lqip_url)
}

export interface MediaResponsiveOptions {
  widths?: number[]
  maxWidth?: number
  sizes?: string
}

// Собирает { src, srcSet, sizes } из backend-вариантов; null = манифест непригоден,
// вызывающий код обязан использовать клиентскую сборку URL.
export function buildResponsiveImagePropsFromMedia(
  entry: TravelMediaImage | null | undefined,
  options: MediaResponsiveOptions = {},
): { src: string; srcSet?: string; sizes?: string } | null {
  const variants = resolveVariants(entry)
  if (!variants.length) return null

  const target = pickVariantForWidth(variants, options.maxWidth ?? 1920)
  if (!target) return null

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
