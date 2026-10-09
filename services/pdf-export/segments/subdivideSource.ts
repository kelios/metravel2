import { incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
import { continueContentOnPage } from '@/services/pdf-export/segments/contentContinuation'
import { assertBookSegmentSourceSchema, type BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import type { BookMapTextField } from '@/services/pdf-export/segments/types'
import { escapeHtml } from '@/services/pdf-export/utils/htmlUtils'

/** Subdivision changes only working pages, never drops a source placement. */
export async function* subdivideSource(source: BookSegmentSource, contentBudget = 1024): AsyncGenerator<BookSegmentSource> {
  assertBookSegmentSourceSchema(source)
  if (source.source_schema_version === 3) {
    const unbound = { ...source }
    delete unbound.resource_bindings; delete unbound.resource_bindings_hash
    delete unbound.resource_policy_hash; delete unbound.encoder_identity_hash
    source = { ...unbound, source_schema_version: 2 }
  }
  const page = source.page
  if (page.type === 'map' && source.source_schema_version !== 2) throw new Error('SEGMENT_SOURCE_SCHEMA_UPGRADE_REQUIRED')
  if ((page.type === 'content' || page.type === 'gallery-caption' || page.type === 'map-text') && page.html) {
    let ordinal = 0
    let mediaAt = 0
    for await (const fragment of incrementalContent((async function* () { yield page.html })(), {
      maxFragmentChars: contentBudget,
      preserveListStarts: true,
    })) {
      const count = fragment.imageOccurrences.length
      yield { source_schema_version: 2, page: page.type === 'content'
        ? { ...page, html: continueContentOnPage(fragment).html, first: page.first && ordinal === 0, last: false, qr: '' }
        : { ...page, html: fragment.html },
        blocks: source.blocks.map(key => `${key}:part:${ordinal}`),
        occurrences: source.occurrences.slice(mediaAt, mediaAt + count) }
      ordinal++
      mediaAt += count
    }
    if (mediaAt !== source.occurrences.length) throw new Error('SEGMENT_MEDIA_SUBDIVISION_MISMATCH')
    return
  }
  if (page.type === 'gallery' && page.travel.gallery?.length === 1 && page.caption_policy !== 'detached') {
    const photo = page.travel.gallery[0]
    if (photo.caption?.trim()) {
      yield { ...source, source_schema_version: 2, page: { ...page, caption_policy: 'detached' } }
      yield { source_schema_version: 2, page: { type: 'gallery-caption', travel: { ...page.travel, gallery: undefined },
        photo_ordinal: (page.start_index ?? 0) + 1, photo_id: photo.id, html: `<p>${escapeHtml(photo.caption)}</p>` },
        blocks: source.blocks.map(key => `${key}:caption`), occurrences: [] }
      return
    }
  }
  if (page.type === 'map' && page.locations.length === 1 && page.text_policy !== 'detached') {
    const location = page.locations[0]
    yield { ...source, source_schema_version: 2, page: { ...page, text_policy: 'detached' } }
    const fields: Array<[BookMapTextField, string | undefined]> = [['address', location.address], ['category', location.categoryName], ['coord', page.show_coordinates ? location.coord : undefined]]
    for (const [field, text] of fields) if (text) {
      let ordinal = 0
      for await (const fragment of incrementalContent((async function* () { yield `<p>${escapeHtml(text)}</p>` })(), { maxFragmentChars: contentBudget })) {
        yield { source_schema_version: 2, page: { type: 'map-text', travel: page.travel, point_id: location.id, point_ordinal: (page.point_start ?? 0) + 1, field, html: fragment.html },
          blocks: source.blocks.map(key => `${key}:text:${field}:part:${ordinal++}`), occurrences: [] }
      }
    }
    return
  }
  const rows = page.type === 'gallery' ? page.travel.gallery : page.type === 'map' ? page.locations : page.type === 'toc' ? page.entries : undefined
  if (!rows || rows.length < 2) throw new Error('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
  const middle = Math.ceil(rows.length / 2)
  for (const [start, end] of [[0, middle], [middle, rows.length]]) {
    const blocks = source.blocks.slice(start, end)
    if (page.type === 'gallery') {
      yield { source_schema_version: 2, page: { ...page, start_index: (page.start_index ?? 0) + start,
        total_photos: page.total_photos ?? page.travel.sourceCounts?.photos ?? (page.start_index ?? 0) + page.travel.gallery!.length,
        travel: { ...page.travel, gallery: page.travel.gallery!.slice(start, end) } }, blocks,
        occurrences: source.occurrences.slice(start, end) }
    } else if (page.type === 'map') {
      const locations = page.locations.slice(start, end)
      const mediaStart = page.locations.slice(0, start).filter(row => row.thumbnailUrl).length
      const count = locations.filter(row => row.thumbnailUrl).length
      yield { source_schema_version: 2, page: { ...page, point_start: (page.point_start ?? 0) + start, locations }, blocks, occurrences: source.occurrences.slice(mediaStart, mediaStart + count) }
    } else if (page.type === 'toc') {
      const entries = page.entries.slice(start, end)
      const mediaStart = page.entries.slice(0, start).filter(entry => entry.travel.travel_image_url).length
      const count = entries.filter(entry => entry.travel.travel_image_url).length
      yield { source_schema_version: 2, page: { ...page, entries, start: page.start + start }, blocks, occurrences: source.occurrences.slice(mediaStart, mediaStart + count) }
    }
  }
}
