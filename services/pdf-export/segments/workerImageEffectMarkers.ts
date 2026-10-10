import { Parser } from 'htmlparser2'

/** Book-renderer only: authored HTML must not carry private print-effect markers. */
export function assertNoAuthoredImageEffectMarkers(html: string): void {
  new Parser({ onopentag(_name, attributes) {
    if (/--metravel-print-/i.test(attributes.style || '') || Object.keys(attributes).some(name => /^data-(?:metravel|book)-print-(?:color|effect|theme)/i.test(name))) throw new Error('PRINT_IMAGE_EFFECT_AUTHORED_MARKER')
  } }, { decodeEntities: true }).end(html)
}
