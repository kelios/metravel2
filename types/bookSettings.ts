import type { PdfThemeName } from '@/services/pdf-export/themes/types'
import type { CaptionPosition, GalleryLayout } from '@/types/pdf-gallery'

export type ChecklistSection =
  | 'clothing'
  | 'food'
  | 'electronics'
  | 'documents'
  | 'medicine'

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
  galleryLayout?: GalleryLayout
  galleryColumns?: number
  galleryPhotosPerPage?: number
  galleryTwoPerPageLayout?: 'vertical' | 'horizontal'
  showCaptions?: boolean
  captionPosition?: CaptionPosition
  gallerySpacing?: 'compact' | 'normal' | 'spacious'
  photoPageLayout?: 'full-bleed' | 'framed' | 'split'
}

export const BOOK_SETTINGS_SCHEMA_VERSION = 1 as const
export const BOOK_SETTINGS_LOCALES = ['RU', 'BE', 'UK', 'PL', 'EN'] as const
export type BookSettingsLocale = (typeof BOOK_SETTINGS_LOCALES)[number]

export interface BookSettingsDto extends Required<BookSettings> {
  locale: BookSettingsLocale
}

export const DEFAULT_CHECKLIST_SELECTION: ChecklistSection[] = [
  'clothing',
  'food',
  'electronics',
]

export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  title: '',
  subtitle: '',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'manual',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  showCoordinatesOnMapPage: true,
  includeChecklists: false,
  checklistSections: DEFAULT_CHECKLIST_SELECTION,
  galleryLayout: 'grid',
  galleryColumns: 3,
  galleryPhotosPerPage: 2,
  galleryTwoPerPageLayout: 'vertical',
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

export function toBookSettingsDto(
  settings: BookSettings,
  locale: BookSettingsLocale,
): BookSettingsDto {
  return {
    title: settings.title,
    subtitle: settings.subtitle ?? '',
    coverType: settings.coverType,
    coverImage: settings.coverImage ?? '',
    template: settings.template,
    sortOrder: settings.sortOrder,
    includeToc: settings.includeToc,
    includeGallery: settings.includeGallery,
    includeMap: settings.includeMap,
    showCoordinatesOnMapPage: settings.showCoordinatesOnMapPage ?? true,
    includeChecklists: settings.includeChecklists,
    checklistSections: [...settings.checklistSections],
    galleryLayout: settings.galleryLayout ?? 'grid',
    galleryColumns: settings.galleryColumns ?? 3,
    galleryPhotosPerPage: settings.galleryPhotosPerPage ?? 2,
    galleryTwoPerPageLayout: settings.galleryTwoPerPageLayout ?? 'vertical',
    showCaptions: settings.showCaptions ?? true,
    captionPosition: settings.captionPosition ?? 'bottom',
    gallerySpacing: settings.gallerySpacing ?? 'normal',
    photoPageLayout: settings.photoPageLayout ?? 'full-bleed',
    locale,
  }
}
