/** @jest-environment node */
import { parseDocument, DomUtils } from 'htmlparser2'
import { buildPdfLocationCards } from '@/services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/locationCards'
import { buildRouteSvg } from '@/services/pdf-export/generators/v2/runtime/bookData'
import { appendMetadataLabel } from '@/workers/book-renderer/snapshot'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
import { escapeHtml } from '@/services/pdf-export/utils/htmlUtils'
import { assertBookSegmentSourceSchema, type BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'

const theme = getThemeConfig('minimal')
const args = { locations: [{ id: '16277', address: 'Автовокзал Luxexpo на Кирхберге: автобусы 201 и 211 в Эхтернах, A, B, C · D 😀界',
  categoryName: 'Category <script> & longword'.repeat(40), coord: '53.9;27.56', thumbnailUrl: 'https://example.com/point.png' }],
  theme, escapeHtml, showCoordinates: true, getImageFilterStyle: () => '' }

describe('complete worker map source text', () => {
  it('keeps the legacy default and renders full field identity only with an explicit worker context', () => {
    const legacy = buildPdfLocationCards(args)[0]
    expect(buildPdfLocationCards({ ...args, portionContext: undefined })[0]).toBe(legacy)
    expect(legacy).toContain('-webkit-line-clamp: 2;')
    expect(legacy).not.toContain('data-point-id')
    const html = buildPdfLocationCards({ ...args, portionContext: { startIndex: 38, textPolicy: 'inline' } })[0]
    const document = parseDocument(html)
    const fields = DomUtils.findAll(node => node.attribs?.class === 'book-map-source-text', document.children)
    expect(fields.map(node => [node.attribs['data-point-field'], DomUtils.textContent(node)])).toEqual([
      ['address', args.locations[0].address], ['category', args.locations[0].categoryName], ['coord', args.locations[0].coord],
    ])
    expect(fields.every(node => node.attribs['data-point-id'] === '16277' && node.attribs['data-point-ordinal'] === '39')).toBe(true)
    expect(html).not.toMatch(/ellipsis|line-clamp|white-space: nowrap/)
    expect(html).toContain('height: 72px;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt; &amp;')
  })

  it('does not print detached or disabled fields beside the source thumbnail', () => {
    const html = buildPdfLocationCards({ ...args, portionContext: { startIndex: 38, textPolicy: 'detached' } })[0]
    expect(html).toContain('<img')
    expect(html).not.toContain('book-map-source-text')
    expect(html).not.toContain(escapeHtml(args.locations[0].address))
    const hiddenCoordinates = buildPdfLocationCards({ ...args, showCoordinates: false, portionContext: { startIndex: 0, textPolicy: 'inline' } })[0]
    expect(hiddenCoordinates).not.toContain('data-point-field="coord"')
  })

  it('keeps SVG marker numbers aligned with global source ordinals even when a point lacks coordinates', () => {
    const locations = [{ id: 'missing', address: 'Missing' }, { id: 'point', address: 'Complete', lat: 53.9, lng: 27.56 }]
    const legacy = buildRouteSvg(locations, theme, { showLabels: false })
    const bounded = buildRouteSvg(locations, theme, { showLabels: false, pointStart: 38 })
    expect(legacy).toMatch(/>\s+1\s+<\/text>/)
    expect(bounded).toMatch(/>\s+40\s+<\/text>/)
  })

  it('rejects unsupported and underspecified private map schemas before render', () => {
    const source: BookSegmentSource = { source_schema_version: 2, page: { type: 'map', travel: { id: 1, name: 'Map' },
      point_start: 0, show_coordinates: false, locations: [] }, blocks: [], occurrences: [] }
    expect(() => assertBookSegmentSourceSchema(source)).not.toThrow()
    const legacy: BookSegmentSource = { page: { type: 'photo', travel: { id: 1, name: 'Legacy' } }, blocks: [], occurrences: [] }
    expect(() => assertBookSegmentSourceSchema(legacy)).not.toThrow()
    expect(() => assertBookSegmentSourceSchema({ ...legacy, source_schema_version: 1 })).not.toThrow()
    const continuation: BookSegmentSource = { page: { type: 'map-text', travel: { id: 1, name: 'Map' }, point_id: '1', point_ordinal: 1, field: 'address', html: '<p>Source</p>' }, blocks: [], occurrences: [] }
    expect(() => assertBookSegmentSourceSchema(continuation)).toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
    expect(() => assertBookSegmentSourceSchema({ ...continuation, source_schema_version: 1 })).toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
    expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 6 } as unknown as BookSegmentSource)).toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
    expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 4 })).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
    expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 3 })).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
    expect(() => assertBookSegmentSourceSchema({ ...source, page: { ...source.page, point_start: undefined } } as BookSegmentSource)).toThrow('SEGMENT_MAP_POSITION_INVALID')
    expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 1 })).toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
  })
  it('accepts the full single-label metadata budget and rejects growth beyond it before joining', () => {
    const label = 'a'.repeat(32768)
    expect(appendMetadataLabel(undefined, label)).toBe(label)
    expect(() => appendMetadataLabel(label, 'b')).toThrow('WORKER_METADATA_BUDGET_EXCEEDED')
  })

})
