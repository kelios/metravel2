/** @jest-environment node */
import { subdivideSource } from '@/services/pdf-export/segments/subdivideSource'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'

async function collect(source: BookSegmentSource, budget = 1024): Promise<BookSegmentSource[]> {
  const pages: BookSegmentSource[] = []
  for await (const page of subdivideSource(source, budget)) pages.push(page)
  return pages
}

describe('measured source subdivision', () => {
  it('splits a single large paragraph without losing links or source text', async () => {
    const text = 'ADAPTIVE_SOURCE '.repeat(250)
    const pages = await collect({ page: { type: 'content', travel: { id: 1, name: 'Chapter' },
      field: 'description', html: `<p><a href="https://example.com">${text}</a></p>`, first: true, last: false, qr: '' },
    blocks: ['1:description:fragment:0'], occurrences: [] }, 512)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.map(page => page.page.type === 'content' ? page.page.html.replace(/<[^>]*>/g, '') : '').join('')).toBe(text)
    expect(pages.every(page => page.page.type === 'content' && /href="https:\/\/example\.com\/?"/.test(page.page.html))).toBe(true)
    expect(new Set(pages.flatMap(page => page.blocks)).size).toBe(pages.length)
    expect(pages.filter(page => page.page.type === 'content' && page.page.first)).toHaveLength(1)
  })

  it('preserves gallery occurrences and map thumbnail ordering after adaptive split', async () => {
    const gallery: BookSegmentSource = { page: { type: 'gallery', travel: { id: 1, name: 'Gallery',
      gallery: [1, 2, 3].map(id => ({ id, url: `https://example.com/${id}.png` })) }, aspects: {} },
    blocks: ['g1', 'g2', 'g3'], occurrences: ['m1', 'm2', 'm3'] }
    expect((await collect(gallery)).flatMap(page => page.occurrences)).toEqual(gallery.occurrences)
    expect((await collect(gallery)).map(source => source.page.type === 'gallery' && source.page.total_photos)).toEqual([3, 3])
    const map: BookSegmentSource = { source_schema_version: 2, page: { type: 'map', point_start: 20, show_coordinates: false, travel: { id: 1, name: 'Map' },
      locations: [{ id: '1', address: 'First' }, { id: '2', address: 'Second', thumbnailUrl: 'frozen' }, { id: '3', address: 'Third' }] },
    blocks: ['p1', 'p2', 'p3'], occurrences: ['point-image'] }
    const pages = await collect(map)
    expect(pages.flatMap(page => page.blocks)).toEqual(map.blocks)
    expect(pages.flatMap(page => page.occurrences)).toEqual(map.occurrences)
  })

  it('continues a rejected single-photo caption without duplicating its image occurrence', async () => {
    const caption = 'Full caption & <literal>'.repeat(20)
    const source: BookSegmentSource = { page: { type: 'gallery', travel: { id: 1, name: 'Chapter',
      gallery: [{ id: 101, url: 'https://example.com/photo.png', caption }] }, aspects: {}, start_index: 8, total_photos: 20,
      caption_policy: 'inline' }, blocks: ['1:gallery:101'], occurrences: ['1:gallery:source'] }
    const pages = await collect(source)
    expect(pages).toHaveLength(2)
    expect(pages[0].page.type === 'gallery' && pages[0].page.caption_policy).toBe('detached')
    expect(pages[1].page.type === 'gallery-caption' && pages[1].page.photo_ordinal).toBe(9)
    expect(pages[1].page.type === 'gallery-caption' && pages[1].page.photo_id).toBe(101)
    expect(pages[1].page.type === 'gallery-caption' && pages[1].page.html).toContain('&amp; &lt;literal&gt;')
    expect(pages.flatMap(page => page.occurrences)).toEqual(source.occurrences)
    const continued = await collect(pages[1], 512)
    expect(continued.length).toBeGreaterThan(1)
    expect(continued.every(page => page.page.type === 'gallery-caption' && page.page.photo_ordinal === 9 && page.occurrences.length === 0)).toBe(true)
  })

  it('never introduces a caption when the gallery source has captions disabled', async () => {
    const source: BookSegmentSource = { page: { type: 'gallery', travel: { id: 1, name: 'Disabled',
      gallery: [{ url: 'https://example.com/photo.png', caption: 'Hidden' }] }, aspects: {}, caption_policy: 'detached' },
    blocks: ['photo'], occurrences: ['placement'] }
    await expect(collect(source)).rejects.toThrow('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
  })

  it('continues a long inline figure caption without duplicating its source image', async () => {
    const caption = '😀界'.repeat(250)
    const source: BookSegmentSource = { page: { type: 'content', travel: { id: 1, name: 'Inline caption' },
      field: 'description', html: `<figure><img src="https://example.com/photo.png"><figcaption>${caption}</figcaption></figure>`,
      first: true, last: false, qr: '' }, blocks: ['inline-figure'], occurrences: ['inline-image'] }
    const pages = await collect(source, 256)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.map(source => source.page.type === 'content' ? source.page.html.replace(/<[^>]*>/g, '') : '').join('')).toBe(caption)
    expect(pages.flatMap(source => source.occurrences)).toEqual(['inline-image'])
    expect(pages.map(source => source.page.type === 'content' ? source.page.html : '').join('').match(/<img\b/g)).toHaveLength(1)
  })

  it('retains derived ordered-list numbers through repeated physical subdivision', async () => {
    const html = '<ol start="7"><li>' + 'seventh '.repeat(90) + '</li><li>' + 'eighth '.repeat(90) + '</li></ol>'
    const source: BookSegmentSource = { page: { type: 'content', travel: { id: 1, name: 'List' },
      field: 'description', html, first: false, last: false, qr: '' }, blocks: ['list'], occurrences: [] }
    const pages = await collect(source, 512)
    const numbers = pages.map(page => page.page.type === 'content' ? /<ol[^>]* start="(\d+)"/.exec(page.page.html)?.[1] : '')
    expect(numbers[0]).toBe('7')
    expect(numbers).toContain('8')
    expect(numbers.every(number => number === '7' || number === '8')).toBe(true)
    const recursive = await collect(pages[1], 256)
    expect(recursive.length).toBeGreaterThan(1)
    expect(recursive.every(page => page.page.type === 'content' && /<ol[^>]* start="7"/.test(page.page.html))).toBe(true)
    const text = pages.map(page => page.page.type === 'content' ? page.page.html.replace(/<[^>]*>/g, '') : '').join('')
    expect(text).toBe('seventh '.repeat(90) + 'eighth '.repeat(90))
  })
  it('preserves complete Unicode point fields and one image through bounded detached continuations', async () => {
    const address = '😀界, fourth, fifth · & <literal> '.repeat(1400)
    const category = 'LongWord'.repeat(4000)
    const source: BookSegmentSource = { source_schema_version: 2, page: { type: 'map', travel: { id: 761, name: 'Map' },
      point_start: 38, show_coordinates: true, locations: [{ id: '16277', address, categoryName: category, coord: '53.9;27.56', thumbnailUrl: 'frozen' }] },
      blocks: ['761:route:16277'], occurrences: ['761:route-image:1'] }
    const pages = await collect(source, 512)
    expect(pages[0].page.type === 'map' && pages[0].page.text_policy).toBe('detached')
    expect(pages.flatMap(page => page.occurrences)).toEqual(source.occurrences)
    const { parseDocument, DomUtils } = await import('htmlparser2')
    for (const [field, expected] of [['address', address], ['category', category], ['coord', '53.9;27.56']]) {
      const fragments = pages.filter(page => page.page.type === 'map-text' && page.page.field === field)
      expect(fragments.length).toBeGreaterThan(0)
      expect(fragments.map(page => page.page.type === 'map-text' ? DomUtils.textContent(parseDocument(page.page.html)) : '').join('')).toBe(expected)
      expect(fragments.every(page => page.page.type === 'map-text' && page.page.point_id === '16277' && page.page.point_ordinal === 39 && page.page.html.length < 1024)).toBe(true)
    }
    expect(new Set(pages.flatMap(page => page.blocks)).size).toBe(pages.flatMap(page => page.blocks).length)
    const firstText = pages.find(page => page.page.type === 'map-text')!
    const retry = await collect(firstText, 256)
    expect(retry.every(page => page.page.type === 'map-text' && page.page.point_ordinal === 39 && page.page.field === 'address')).toBe(true)
  })

  it('requires an explicit private map schema and never derives hidden coordinates', async () => {
    const source: BookSegmentSource = { source_schema_version: 2, page: { type: 'map', travel: { id: 1, name: 'Map' }, point_start: 0, show_coordinates: false,
      locations: [{ id: '1', address: 'Address', coord: '53.9;27.56' }] }, blocks: ['point'], occurrences: [] }
    expect((await collect(source)).some(page => page.page.type === 'map-text' && page.page.field === 'coord')).toBe(false)
    await expect(collect({ ...source, source_schema_version: 1 })).rejects.toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
    await expect(collect({ ...source, source_schema_version: 6 } as unknown as BookSegmentSource)).rejects.toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
    await expect(collect({ ...source, source_schema_version: 4 })).rejects.toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
    await expect(collect({ ...source, source_schema_version: 3 })).rejects.toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
  })

  it.each([4, 5] as const)('expands nested FAQ before clearing prepared schema%s bindings, preserving text/media/anchors', async source_schema_version => {
    const answer = 'Complete nested answer '.repeat(80)
    const source: BookSegmentSource = { source_schema_version, resource_bindings: [], resource_bindings_hash: 'a'.repeat(64),
      resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64), page: { type: 'content', travel: { id: 1, name: 'FAQ' }, field: 'description', first: true, last: true, qr: '',
        html: `<details id="faq"><summary>Outer question</summary><details id="inner"><summary>Inner question</summary><p>${answer}</p><img src="https://example.com/original.png"></details></details>` }, blocks: ['faq'], occurrences: ['source-image'] }
    const children = await collect(source, 512)
    const html = children.map(child => child.page.type === 'content' ? child.page.html : '').join('')
    expect(children.length).toBeGreaterThan(1)
    expect(html).not.toMatch(/<(?:details|summary)\b/)
    expect(html.replace(/<[^>]+>/g, '')).toBe(`Outer questionInner question${answer}`)
    expect(html).toContain('id="faq"'); expect(html).toContain('id="inner"')
    expect(children.flatMap(child => child.occurrences)).toEqual(['source-image'])
    expect(children.every(child => child.source_schema_version === 2 && child.resource_bindings === undefined)).toBe(true)
  })

})
