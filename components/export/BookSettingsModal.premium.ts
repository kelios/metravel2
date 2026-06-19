// components/export/BookSettingsModal.premium.ts
// Премиум-гейт для опций книги (#298): кастом-обложка и журнальные раскладки галереи.
// Предикаты живут в нейтральном services-слое, чтобы генератор переиспользовал их
// без зависимости на components/ (FE-8). Здесь — UI-обёртка над ними.

import type { BookSettings } from './BookSettingsModal.types'
import {
  PREMIUM_COVER_TYPES,
  PREMIUM_GALLERY_LAYOUTS,
  PREMIUM_CAPTION_POSITIONS,
  isPremiumCoverType,
  isPremiumGalleryLayout,
  isPremiumCaptionPosition,
} from '@/services/pdf-export/premiumSettingsGate'

export {
  PREMIUM_COVER_TYPES,
  PREMIUM_GALLERY_LAYOUTS,
  PREMIUM_CAPTION_POSITIONS,
  isPremiumCoverType,
  isPremiumGalleryLayout,
  isPremiumCaptionPosition,
}

// Возвращает true, если правки настроек содержат премиум-значение, недоступное
// бесплатному пользователю. Используется для гейта в BookSettingsModal.
export function gallerySettingNeedsPremium(updates: Partial<BookSettings>): boolean {
  if (updates.galleryLayout && isPremiumGalleryLayout(updates.galleryLayout)) return true
  if (updates.captionPosition && isPremiumCaptionPosition(updates.captionPosition)) return true
  return false
}
