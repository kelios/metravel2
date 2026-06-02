// components/export/BookSettingsModal.types.ts
// Типы настроек фотоальбома (вынесено из BookSettingsModal.tsx, поведение не меняется)

import type { PdfThemeName } from './ThemePreview'
import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery'

export type ChecklistSection =
  | 'clothing'
  | 'food'
  | 'electronics'
  | 'documents'
  | 'medicine'

// ✅ Экспортируем интерфейс для использования в других компонентах
export interface BookSettings {
  title: string
  subtitle?: string
  coverType: 'auto' | 'first-photo' | 'gradient' | 'custom'
  coverImage?: string
  template: PdfThemeName
  sortOrder: 'manual' | 'date-desc' | 'date-asc' | 'country' | 'alphabetical'
  includeToc: boolean
  includeGallery: boolean
  includeMap: boolean
  showCoordinatesOnMapPage?: boolean
  includeChecklists: boolean
  checklistSections: ChecklistSection[]
  // Настройки галереи
  galleryLayout?: GalleryLayout
  galleryColumns?: number
  galleryPhotosPerPage?: number
  galleryTwoPerPageLayout?: 'vertical' | 'horizontal'
  showCaptions?: boolean
  captionPosition?: CaptionPosition
  gallerySpacing?: 'compact' | 'normal' | 'spacious'
  // Стиль фото-страницы путешествия
  photoPageLayout?: 'full-bleed' | 'framed' | 'split'
}
