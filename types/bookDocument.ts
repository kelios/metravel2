import type { BookSettingsDto } from '@/types/bookSettings'

export const BOOK_DOCUMENT_SCHEMA_VERSION = 1 as const
export const BOOK_PLAN_SCHEMA_VERSION = 1 as const
export const BOOK_RENDERER_VERSION = 'metravel-book-renderer/1.0.0' as const
export const BOOK_SNAPSHOT_MANIFEST_PAGE_SIZE = 100 as const
export const BOOK_SNAPSHOT_READ_BYTES = 65_536 as const
export const BOOK_SNAPSHOT_TEXT_CHARACTERS = 16_384 as const

/** Pinned job metadata supplied by the backend worker, not a public API response. */
export interface BookDocument {
  schema_version: typeof BOOK_DOCUMENT_SCHEMA_VERSION
  contract_version: 2
  settings_version: 1
  snapshot_id: string
  snapshot_hash: string
  selection_hash: string
  settings_hash: string
  renderer_version: string
  seed: string
  /** Pinned job clock supplied by B2/B3, never Date.now() at render time. */
  generated_at: string
  settings: BookSettingsDto
  entitlement: { premium: boolean; policy_version: number }
}

export type BookTextField = 'description' | 'plus' | 'minus' | 'recommendation'

export interface BookTravelMetadata {
  id: number
  name: string | null
  slug: string
  year: number | null
  image: string | null
  created_at: string | null
  number_days: number | null
  number_peoples: number | null
  budget: number | null
  youtube_link: string | null
  travel_revision: string
}

export interface BookTextMetadata {
  field: BookTextField
  /** B1 Substr windows use one-based character offsets, not UTF-8 byte offsets. */
  offset: number
  canonical_key?: string
  field_end?: boolean
}

export interface BookMediaMetadata {
  role: string
  resource_key: string
  /** Immutable original-byte SHA-256, equal to the chunk checksum. */
  version: string
  linked_travel_id?: number
}

export interface BookGalleryMetadata {
  id: number
  image: string
  caption: string
  file_name: string
  mime_type: string | null
  order: number
}

export interface BookRouteMetadata {
  id: number
  address: string
  country_id: number
  lat: number | string | null
  lng: number | string | null
  coord: string
  image: string | null
  image_detail: string | null
  image_landscape: string | null
}

export interface BookRouteCategoryMetadata {
  id: number
  name: string | null
  route_id: number
}

export interface BookCountryMetadata {
  country_id: number
  title_ru: string | null
  title_en: string | null
  country_code: string | null
}

type NamedRecordMetadata = { id: number; name: string | null }

interface BookSnapshotChunkBase {
  position: number
  travel_id: number | null
  source_key: string
  occurrence_key: string
  /** Private job-id/checksum reference; never an image or browser URL. */
  file_ref: string
  checksum: string
  size_bytes: number
}

type SnapshotChunk<Kind extends string, Metadata> = BookSnapshotChunkBase & {
  kind: Kind
  metadata: Metadata
}

/** Exact B1 source-row discriminants, preserving related records and placement identity. */
export type BookSnapshotChunk =
  | SnapshotChunk<'travel', BookTravelMetadata>
  | SnapshotChunk<'text', BookTextMetadata>
  | SnapshotChunk<'media', BookMediaMetadata>
  | SnapshotChunk<'gallery', BookGalleryMetadata>
  | SnapshotChunk<'route', BookRouteMetadata>
  | SnapshotChunk<'route-category', BookRouteCategoryMetadata>
  | SnapshotChunk<'country', BookCountryMetadata>
  | SnapshotChunk<'month' | 'category' | 'transport' | 'overnight', NamedRecordMetadata>
  | SnapshotChunk<'author', { id: number; name: string }>

export type BookTextChunk = Extract<BookSnapshotChunk, { kind: 'text' }>
export type BookMediaChunk = Extract<BookSnapshotChunk, { kind: 'media' }>

export interface BookSnapshotManifestPage {
  snapshot_id: string
  snapshot_hash: string
  selection_hash: string
  settings_hash: string
  chunks: BookSnapshotChunk[]
  has_more: boolean
  next_position: number
}

/** A consumer walks this source; it never receives a whole-book manifest array. */
export type BookDocumentSource = AsyncIterable<BookSnapshotChunk>

export interface BookPlanEntry {
  block_key: string
  travel_id: number | string
  type: string
  source_ref: string
  resource_key?: string
  occurrence_key?: string
  order: number
}

export interface BookPlan {
  schema_version: typeof BOOK_PLAN_SCHEMA_VERSION
  snapshot_hash: string
  settings_hash: string
  renderer_version: string
  /** Private reference to paged/disk-backed entries, not the entries themselves. */
  entries_ref: string
}
