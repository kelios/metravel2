/**
 * Как показывать личную точку: заголовок, подзаголовок, фото, страна, категория,
 * связанные ссылки. Один источник для маркера/попапа карты и карточки списка
 * (вынесено из `UserPointsMapPointMarker.web.tsx` в #3131; `PointCard.tsx`
 * переводится на этот модуль в #3135).
 */
import type { ImportedPoint } from '@/types/userPoints'
import { normalizeRelatedTravelId } from '@/utils/relatedTravel'
import { translate as i18nT } from '@/i18n'

export const looksLikeFullAddress = (value: string): boolean => {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length >= 3
}

export const firstMeaningfulSegment = (value: string): string => {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return value.trim()
  if (/^\d+[A-Za-zА-Яа-я]?$/.test(parts[0]) && parts[1]) return `${parts[0]}, ${parts[1]}`
  return parts[0]
}

export const getPointTitle = (point: ImportedPoint): string => {
  const name = String(point?.name ?? '').trim()
  if (name) return looksLikeFullAddress(name) ? firstMeaningfulSegment(name) : name
  const address = String(point?.address ?? '').trim()
  if (address) return looksLikeFullAddress(address) ? firstMeaningfulSegment(address) : address
  return i18nT('map:components.UserPoints.UserPointsMapPointMarker.tochka_99c57a1a')
}

export const getPointSubtitle = (point: ImportedPoint, title: string): string => {
  const name = String(point?.name ?? '').trim()
  const address = String(point?.address ?? '').trim()
  const fullFromName = name && looksLikeFullAddress(name) && name !== title ? name : ''
  const source = fullFromName || address
  if (!source || source.toLowerCase() === title.toLowerCase()) return ''
  return source
}

export const getPointPhotoUrl = (point: ImportedPoint): string | null => {
  const pointRecord = point as unknown as Record<string, unknown>
  const direct = typeof point?.photo === 'string' ? point.photo.trim() : ''
  if (direct) return direct

  const legacy = pointRecord?.photos
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim()
  if (!legacy || typeof legacy !== 'object') return null

  const knownKeys = ['url', 'src', 'photo', 'image', 'thumb', 'thumbnail', 'travelImageThumbUrl']
  for (const key of knownKeys) {
    const value = (legacy as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  for (const value of Object.values(legacy as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export const getCountryLabel = (point: ImportedPoint): string => {
  const direct = String((point as unknown as Record<string, unknown>)?.country ?? '').trim()
  if (direct) return direct
  const address = String(point?.address ?? '').trim()
  if (!address) return ''
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 1] ?? '' : ''
}

export const getCategoryLabel = (point: ImportedPoint, countryLabel: string): string => {
  const clean = (values: unknown[]) =>
    values
      .map((value) => String(value).trim())
      .filter(Boolean)
      .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0)
      .join(', ')

  const names = (point as unknown as Record<string, unknown>)?.categoryNames
  if (Array.isArray(names) && names.length > 0) return clean(names)

  const ids = point?.categoryIds ?? point?.category_ids
  if (Array.isArray(ids) && ids.length > 0) return clean(ids)

  const legacy = String(point?.category ?? '').trim()
  if (!legacy) return ''
  if (countryLabel && legacy.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) === 0) return ''
  return legacy
}

export const getRelatedUrls = (point: ImportedPoint) => {
  const tags = (point?.tags ?? {}) as Record<string, unknown>
  const articleUrl = String(tags.articleUrl ?? '').trim()
  const travelUrl = String(tags.travelUrl ?? '').trim()
  // `tags.travelId` пишется вместе с `travelUrl` с #1960. У точек, сохранённых
  // раньше, его нет — тогда стек берёт id из самого url (legacy `?id=`).
  const travelId = travelUrl ? normalizeRelatedTravelId(tags.travelId) : null
  return { articleUrl, travelUrl, travelId }
}

/** Точка, сохранённая со страницы сайта (статья/маршрут): маркер крупнее и с цветом сайта. */
export const isSitePoint = (point: ImportedPoint): boolean => {
  const { articleUrl, travelUrl } = getRelatedUrls(point)
  return Boolean(articleUrl || travelUrl)
}
