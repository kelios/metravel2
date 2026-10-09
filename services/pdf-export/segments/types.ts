import type { BookTextField } from '@/types/bookDocument'
import type { TravelForBook } from '@/types/pdf-export'
import type { TravelSectionMeta, NormalizedLocation } from '../generators/v2/runtime/types'
import type { SharedCoverPageData } from '../generators/v2/runtime/coverPage'
import type { TravelQuote } from '../quotes/travelQuotes'

/** Computed incrementally; distinct countries are counted by the disk index. */
export interface BookSummary {
  travels: number
  countries: number
  days: number
  photos: number
}

export const BOOK_SEGMENT_SOURCE_SCHEMA_VERSION = 2 as const
export type BookMapTextField = 'address' | 'category' | 'coord'

export type BookSegmentPage =
  | { type: 'cover'; data: SharedCoverPageData }
  | { type: 'photo'; travel: TravelForBook }
  | { type: 'legacy-content'; travel: TravelForBook; qr: string }
  | { type: 'content'; travel: TravelForBook; field: BookTextField; html: string; first: boolean; last: boolean; qr: string }
  | { type: 'gallery'; travel: TravelForBook; aspects: Record<string, number>; start_index?: number; total_photos?: number; caption_policy?: 'inline' | 'detached' }
  | { type: 'gallery-caption'; travel: TravelForBook; photo_ordinal: number; photo_id?: number | string; html: string }
  | { type: 'map'; travel: TravelForBook; locations: NormalizedLocation[]; point_start?: number; text_policy?: 'inline' | 'detached'; show_coordinates?: boolean }
  | { type: 'map-text'; travel: TravelForBook; point_id: string; point_ordinal: number; field: BookMapTextField; html: string }
  | { type: 'toc'; entries: TravelSectionMeta[]; total: number; start: number }
  | { type: 'atlas'; entries: TravelSectionMeta[]; part: 'map' | 'index'; total_pages: number; total_points: number; total_travels: number; index: number }
  | { type: 'separator'; travel: TravelForBook; ordinal: number; total: number }
  | { type: 'checklists' }
  | { type: 'final'; summary: BookSummary; quote: TravelQuote }

export interface BookPageContext {
  start_page: number
  /** Reserved height; changing folio digits cannot change pagination. */
  folio_area_mm: number
}

export const BOOK_SEGMENT_LIMITS = {
  content_chars: 32_768,
  gallery_photos: 14,
  map_points: 6,
  toc_entries: 7,
  atlas_points: 24,
  html_bytes: 512 * 1024,
  source_bytes: 512 * 1024,
} as const
