// components/export/BookSettingsModal.premium.ts
// Премиум-гейт для опций книги (#298): кастом-обложка и журнальные раскладки галереи.

import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery'
import type { BookSettings } from './BookSettingsModal.types'

type CoverType = BookSettings['coverType']
type PhotoPageLayout = NonNullable<BookSettings['photoPageLayout']>

// Кастом-обложка (загрузка своего изображения) — премиум.
export const PREMIUM_COVER_TYPES = ['custom'] as const satisfies readonly CoverType[]

// Журнальные раскладки галереи — премиум.
export const PREMIUM_GALLERY_LAYOUTS = [
  'collage',
  'slideshow',
] as const satisfies readonly GalleryLayout[]

// Подписи поверх фото — премиум.
export const PREMIUM_CAPTION_POSITIONS = ['overlay'] as const satisfies readonly CaptionPosition[]

// Фото-страница «в край» — премиум.
export const PREMIUM_PHOTO_PAGE_LAYOUTS = [
  'full-bleed',
] as const satisfies readonly PhotoPageLayout[]

export function isPremiumCoverType(value: CoverType): boolean {
  return (PREMIUM_COVER_TYPES as readonly CoverType[]).includes(value)
}

export function isPremiumGalleryLayout(value: GalleryLayout): boolean {
  return (PREMIUM_GALLERY_LAYOUTS as readonly GalleryLayout[]).includes(value)
}

export function isPremiumCaptionPosition(value: CaptionPosition): boolean {
  return (PREMIUM_CAPTION_POSITIONS as readonly CaptionPosition[]).includes(value)
}

export function isPremiumPhotoPageLayout(value: PhotoPageLayout): boolean {
  return (PREMIUM_PHOTO_PAGE_LAYOUTS as readonly PhotoPageLayout[]).includes(value)
}

// Возвращает true, если правки настроек содержат премиум-значение, недоступное
// бесплатному пользователю. Используется для гейта в BookSettingsModal.
export function gallerySettingNeedsPremium(updates: Partial<BookSettings>): boolean {
  if (updates.galleryLayout && isPremiumGalleryLayout(updates.galleryLayout)) return true
  if (updates.captionPosition && isPremiumCaptionPosition(updates.captionPosition)) return true
  if (updates.photoPageLayout && isPremiumPhotoPageLayout(updates.photoPageLayout)) return true
  return false
}
