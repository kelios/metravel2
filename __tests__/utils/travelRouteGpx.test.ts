import { buildTravelRouteGpx } from '@/utils/travelRouteGpx'

const GPX_NS = 'http://www.topografix.com/GPX/1/1'

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  return doc
}

describe('buildTravelRouteGpx (#2902)', () => {
  const travel = {
    id: 42,
    slug: 'minsk-logoysk',
    name: 'Минск → Логойск & <назад>',
    userName: 'Юля "Q"',
    travelAddress: [
      { id: 1, name: 'Старт <A&B>', coords: '53.9,27.56' },
      { id: 2, name: 'Без координат', coords: 'n/a' },
      { id: 3, name: "Озеро 'Мястро'\u0001", coord: '53.95,27.6' },
      { id: 4, name: 'Финиш', coord: '54.0,27.7' },
    ],
  } as any

  it('produces well-formed GPX 1.1 with one wpt per valid point and an ordered rte', () => {
    const file = buildTravelRouteGpx(travel, { time: '2026-11-02T00:00:00.000Z' })
    const doc = parse(file.content)

    const root = doc.documentElement
    expect(root.localName).toBe('gpx')
    expect(root.namespaceURI).toBe(GPX_NS)
    expect(root.getAttribute('version')).toBe('1.1')

    const wpts = Array.from(doc.getElementsByTagNameNS(GPX_NS, 'wpt'))
    expect(wpts).toHaveLength(3)
    expect(wpts.map((w) => [w.getAttribute('lat'), w.getAttribute('lon')])).toEqual([
      ['53.9', '27.56'],
      ['53.95', '27.6'],
      ['54', '27.7'],
    ])

    const rtepts = Array.from(doc.getElementsByTagNameNS(GPX_NS, 'rtept'))
    expect(rtepts).toHaveLength(wpts.length)
    expect(rtepts.map((p) => p.getElementsByTagNameNS(GPX_NS, 'name')[0]?.textContent)).toEqual([
      'Старт <A&B>',
      "Озеро 'Мястро'",
      'Финиш',
    ])

    // GPX 1.1 order: metadata, wpt*, rte*.
    const childNames = Array.from(root.children).map((el) => el.localName)
    expect(childNames).toEqual(['metadata', 'wpt', 'wpt', 'wpt', 'rte'])
  })

  it('fills metadata with route name, author and the page link (escaped)', () => {
    const file = buildTravelRouteGpx(travel)
    expect(file.content).toContain('&lt;назад&gt;')
    expect(file.content).toContain('&quot;Q&quot;')
    expect(file.content).not.toContain('\u0001')

    const doc = parse(file.content)
    const metadata = doc.getElementsByTagNameNS(GPX_NS, 'metadata')[0]
    expect(metadata.getElementsByTagNameNS(GPX_NS, 'name')[0].textContent).toBe('Минск → Логойск & <назад>')
    const author = metadata.getElementsByTagNameNS(GPX_NS, 'author')[0]
    expect(author.getElementsByTagNameNS(GPX_NS, 'name')[0].textContent).toBe('Юля "Q"')
    const link = metadata.getElementsByTagNameNS(GPX_NS, 'link')[0]
    expect(link.getAttribute('href')).toMatch(/^https?:\/\/[^/]+\/travels\/minsk-logoysk$/)
  })

  it('names the file after the travel slug', () => {
    const file = buildTravelRouteGpx(travel)
    expect(file.filename).toBe('minsk-logoysk.gpx')
    expect(file.mimeType).toBe('application/gpx+xml')
  })

  it('falls back to a transliterated name when the slug is empty', () => {
    const file = buildTravelRouteGpx({ ...travel, slug: '' })
    expect(file.filename).toMatch(/^Minsk-.*\.gpx$/)
  })
})
