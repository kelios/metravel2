import { incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
import type { BookSegmentSource } from './renderSegment'
import { subdivisionFragment, subdivisionItems } from './subdivisionChildren'

/** Subdivision changes only working pages, never drops a source placement. */
export async function* subdivideSource(source: BookSegmentSource, contentBudget = 1024): AsyncGenerator<BookSegmentSource> {
  for (const item of subdivisionItems(source)) {
    if (item.kind === 'source') { yield item.source; continue }
    let ordinal = 0
    let mediaAt = 0
    for await (const fragment of incrementalContent((async function* () { yield item.html })(), {
      maxFragmentChars: contentBudget,
      preserveListStarts: item.preserveListStarts,
      expandDisclosures: item.expandDisclosures,
    })) {
      yield subdivisionFragment(item, fragment, ordinal++, mediaAt)
      mediaAt += fragment.imageOccurrences.length
    }
    if (mediaAt !== item.source.occurrences.length) throw new Error('SEGMENT_MEDIA_SUBDIVISION_MISMATCH')
  }
}
