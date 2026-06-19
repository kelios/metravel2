// services/pdf-export/premiumSettingsGate.ts
// Предикаты премиум-раскладок книги и авторитетный даунгрейд не-премиум настроек.
// Нейтральный services-слой: НЕ импортирует из components/, чтобы генератор мог
// переиспользовать предикаты без обратной зависимости на UI (FE-8).

import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery'

type CoverType = 'auto' | 'first-photo' | 'gradient' | 'custom'

// Кастом-обложка (загрузка своего изображения) — премиум.
export const PREMIUM_COVER_TYPES = ['custom'] as const satisfies readonly CoverType[]

// Журнальные раскладки галереи — премиум.
export const PREMIUM_GALLERY_LAYOUTS = [
  'collage',
  'slideshow',
] as const satisfies readonly GalleryLayout[]

// Подписи поверх фото — премиум.
export const PREMIUM_CAPTION_POSITIONS = ['overlay'] as const satisfies readonly CaptionPosition[]

// Free-дефолты для даунгрейда премиум-значений.
const FREE_GALLERY_LAYOUT: GalleryLayout = 'grid'
const FREE_CAPTION_POSITION: CaptionPosition = 'bottom'
const FREE_COVER_TYPE: CoverType = 'auto'

export function isPremiumCoverType(value: CoverType): boolean {
  return (PREMIUM_COVER_TYPES as readonly CoverType[]).includes(value)
}

export function isPremiumGalleryLayout(value: GalleryLayout): boolean {
  return (PREMIUM_GALLERY_LAYOUTS as readonly GalleryLayout[]).includes(value)
}

export function isPremiumCaptionPosition(value: CaptionPosition): boolean {
  return (PREMIUM_CAPTION_POSITIONS as readonly CaptionPosition[]).includes(value)
}

// Поля настроек книги, относящиеся к премиум-гейту. Описаны структурно,
// чтобы модуль не зависел от типа BookSettings из components/.
interface PremiumGatedSettings {
  galleryLayout?: GalleryLayout
  captionPosition?: CaptionPosition
  coverType?: CoverType
}

/**
 * Возвращает копию settings, где премиум-значения приведены к free-дефолтам,
 * если !isPremium. Входной объект НЕ мутируется. При isPremium возвращает
 * settings без изменений.
 */
export function downgradeNonPremiumSettings<T extends PremiumGatedSettings>(
  settings: T,
  isPremium: boolean,
): T {
  if (isPremium) return settings

  const next = { ...settings }

  if (next.galleryLayout && isPremiumGalleryLayout(next.galleryLayout)) {
    next.galleryLayout = FREE_GALLERY_LAYOUT
  }
  if (next.captionPosition && isPremiumCaptionPosition(next.captionPosition)) {
    next.captionPosition = FREE_CAPTION_POSITION
  }
  if (next.coverType && isPremiumCoverType(next.coverType)) {
    next.coverType = FREE_COVER_TYPE
  }

  return next
}
