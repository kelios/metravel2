import type { SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import { continueContentOnPage } from './contentContinuation'
import { assertBookSegmentSourceSchema, type BookSegmentSource } from './renderSegment'
import type { BookMapTextField } from './types'
import { escapeHtml } from '@/services/pdf-export/utils/htmlUtils'

/** Shared mapping; parsing and physical measurement remain owned by their callers. */
export type SubdivisionItem = { kind: 'source'; source: BookSegmentSource } | {
  kind: 'text'; source: BookSegmentSource; html: string; preserveListStarts: boolean; expandDisclosures: boolean
}

export function unbindSubdivisionSource(source: BookSegmentSource): BookSegmentSource {
  assertBookSegmentSourceSchema(source)
  if ((source.source_schema_version ?? 1) < 3) return source
  const unbound = { ...source }
  delete unbound.resource_bindings; delete unbound.resource_bindings_hash
  delete unbound.resource_policy_hash; delete unbound.encoder_identity_hash
  return { ...unbound, source_schema_version: 2 }
}

/** At most four descriptors, never an array proportional to authored text. */
export function subdivisionItems(original: BookSegmentSource): SubdivisionItem[] {
  const expandDisclosures = original.source_schema_version === 4 || original.source_schema_version === 5
  const source = unbindSubdivisionSource(original)
  const page = source.page
  if (page.type === 'map' && source.source_schema_version !== 2) throw new Error('SEGMENT_SOURCE_SCHEMA_UPGRADE_REQUIRED')
  if ((page.type === 'content' || page.type === 'gallery-caption' || page.type === 'map-text') && page.html) {
    return [{ kind: 'text', source, html: page.html, preserveListStarts: true, expandDisclosures }]
  }
  if (page.type === 'gallery' && page.travel.gallery?.length === 1 && page.caption_policy !== 'detached') {
    const photo = page.travel.gallery[0]
    if (photo.caption?.trim()) return [
      { kind: 'source', source: { ...source, source_schema_version: 2, page: { ...page, caption_policy: 'detached' } } },
      { kind: 'source', source: { source_schema_version: 2, page: { type: 'gallery-caption', travel: { ...page.travel, gallery: undefined },
        photo_ordinal: (page.start_index ?? 0) + 1, photo_id: photo.id, html: `<p>${escapeHtml(photo.caption)}</p>` },
      blocks: source.blocks.map(key => `${key}:caption`), occurrences: [] } },
    ]
  }
  if (page.type === 'map' && page.locations.length === 1 && page.text_policy !== 'detached') {
    const location = page.locations[0]
    const items: SubdivisionItem[] = [{ kind: 'source', source: { ...source, source_schema_version: 2, page: { ...page, text_policy: 'detached' } } }]
    const fields: Array<[BookMapTextField, string | undefined]> = [['address', location.address], ['category', location.categoryName], ['coord', page.show_coordinates ? location.coord : undefined]]
    for (const [field, text] of fields) if (text) {
      const html = `<p>${escapeHtml(text)}</p>`
      items.push({ kind: 'text', html, preserveListStarts: false, expandDisclosures: false,
        source: { source_schema_version: 2, page: { type: 'map-text', travel: page.travel, point_id: location.id,
          point_ordinal: (page.point_start ?? 0) + 1, field, html },
        blocks: source.blocks.map(key => `${key}:text:${field}`), occurrences: [] } })
    }
    return items
  }
  const rows = page.type === 'gallery' ? page.travel.gallery : page.type === 'map' ? page.locations : page.type === 'toc' ? page.entries : undefined
  if (!rows || rows.length < 2) throw new Error('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
  const middle = Math.ceil(rows.length / 2)
  return [[0, middle], [middle, rows.length]].map(([start, end]): SubdivisionItem => {
    const blocks = source.blocks.slice(start, end)
    if (page.type === 'gallery') return { kind: 'source', source: { source_schema_version: 2, page: { ...page, start_index: (page.start_index ?? 0) + start,
      total_photos: page.total_photos ?? page.travel.sourceCounts?.photos ?? (page.start_index ?? 0) + page.travel.gallery!.length,
      travel: { ...page.travel, gallery: page.travel.gallery!.slice(start, end) } }, blocks,
    occurrences: source.occurrences.slice(start, end) } }
    if (page.type === 'map') {
      const locations = page.locations.slice(start, end)
      const mediaStart = page.locations.slice(0, start).filter(row => row.thumbnailUrl).length
      const count = locations.filter(row => row.thumbnailUrl).length
      return { kind: 'source', source: { source_schema_version: 2, page: { ...page, point_start: (page.point_start ?? 0) + start, locations }, blocks,
        occurrences: source.occurrences.slice(mediaStart, mediaStart + count) } }
    }
    if (page.type === 'toc') {
      const entries = page.entries.slice(start, end)
      const mediaStart = page.entries.slice(0, start).filter(entry => entry.travel.travel_image_url).length
      const count = entries.filter(entry => entry.travel.travel_image_url).length
      return { kind: 'source', source: { source_schema_version: 2, page: { ...page, entries, start: page.start + start }, blocks,
        occurrences: source.occurrences.slice(mediaStart, mediaStart + count) } }
    }
    throw new Error('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
  })
}

export function subdivisionFragment(item: Extract<SubdivisionItem, { kind: 'text' }>, fragment: SafeContentFragment, ordinal: number, mediaAt: number): BookSegmentSource {
  const source = item.source
  const page = source.page
  if (page.type !== 'content' && page.type !== 'gallery-caption' && page.type !== 'map-text') throw new Error('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
  return { source_schema_version: 2, page: page.type === 'content'
    ? { ...page, html: continueContentOnPage(fragment).html, first: page.first && ordinal === 0, last: false, qr: '' }
    : { ...page, html: fragment.html },
  blocks: source.blocks.map(key => `${key}:part:${ordinal}`),
  occurrences: source.occurrences.slice(mediaAt, mediaAt + fragment.imageOccurrences.length) }
}
