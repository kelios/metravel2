import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { TravelForBook } from '@/types/pdf-export'
import type { CaptionPosition, GalleryLayout } from '@/types/pdf-gallery'
import type { ParsedContentBlock } from '../../../../parsers/ContentParser'
import type { NormalizedLocation } from '../types'
import { getThemeConfig } from '../../../../themes/PdfThemeConfig'

export type RuntimeTheme = ReturnType<typeof getThemeConfig>
export type RuntimeColors = RuntimeTheme['colors']
export type RuntimeTypography = RuntimeTheme['typography']
export type RuntimeSpacing = RuntimeTheme['spacing']

export type BuildHtmlDocumentParams = {
  pages: string[]
  settings: BookSettings
  theme: RuntimeTheme
  /** При false добавляется деликатный водяной знак «Создано на metravel.by» (#297). */
  isPremium?: boolean
  escapeHtml: (value: string | null | undefined) => string
}

export type BuildLocationCardsParams = {
  locations: NormalizedLocation[]
  qrCodes?: string[]
  theme: RuntimeTheme
  showCoordinates: boolean
  escapeHtml: (value: string | null | undefined) => string
  getImageFilterStyle: () => string
}

export type RuntimeIconName =
  | 'camera'
  | 'pen'
  | 'bulb'
  | 'warning'
  | 'sparkle'
  | 'globe'
  | 'calendar'
  | 'clock'
  | 'map-pin'

export type BuildStatsMiniCardParams = {
  travel: TravelForBook
  theme: RuntimeTheme
  colors: RuntimeColors
  typography: RuntimeTypography
  spacing: RuntimeSpacing
  escapeHtml: (value: string | null | undefined) => string
  formatDays: (days?: number | null) => string
  renderPdfIcon: (name: RuntimeIconName, color: string, sizePt: number) => string
}

export type BuildRunningHeaderParams = {
  travelName: string
  pageNumber?: number
  theme: RuntimeTheme
  escapeHtml: (value: string | null | undefined) => string
}

export type BuildSeparatorPageParams = {
  travel: TravelForBook
  travelIndex: number
  totalTravels: number
  theme: RuntimeTheme
  thumbUrl?: string
  formattedDays: string
  escapeHtml: (value: string | null | undefined) => string
  getImageFilterStyle: () => string
}

export type GalleryCaptionMarkup = { wrapperStart: string; wrapperEnd: string }

export type BuildInlineGallerySectionParams = {
  travel: TravelForBook
  theme: RuntimeTheme
  colors: RuntimeColors
  typography: RuntimeTypography
  spacing: RuntimeSpacing
  layout: GalleryLayout
  columns?: number
  showCaptions: boolean
  captionPosition: CaptionPosition
  galleryGapMm: number
  buildSafeImageUrl: (url?: string | null) => string | undefined
  buildContainImage: (
    src: string,
    alt: string,
    height: string,
    opts?: { onerrorBg?: string; extraStyle?: string }
  ) => string
  buildGalleryCaption: (index: number, position: CaptionPosition, typography: RuntimeTypography) => GalleryCaptionMarkup
  renderPdfIcon: (name: RuntimeIconName, color: string, sizePt: number) => string
  getPhotoLabel: (count: number) => string
}

export type BuildTravelContentRuntimeDataParams = {
  travel: TravelForBook
  includeGallery?: BookSettings['includeGallery']
  descriptionHtml: string
  parseBlocks: (content: string) => ParsedContentBlock[]
  buildInlineGallerySection: () => string
  buildSafeImageUrl: (url?: string | null) => string | undefined
}

export type TravelContentRuntimeData = {
  descriptionHtml: string
  recommendationBlocks: ParsedContentBlock[]
  plusBlocks: ParsedContentBlock[]
  minusBlocks: ParsedContentBlock[]
  inlineGalleryHtml: string
  hasGalleryMedia: boolean
}
