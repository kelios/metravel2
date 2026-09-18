import fs from 'node:fs'
import path from 'node:path'

import {
  buildRelatedTravelTags,
  normalizeRelatedTravelId,
  resolveMapPointRelatedTravelId,
  toCanonicalTravelPath,
} from '@/utils/relatedTravel'

jest.mock('@/utils/seo', () => ({
  getSiteBaseUrl: () => 'https://metravel.by',
}))

const source = (travelId: number | null) => ({
  sourceId: 'travel-address:14029',
  pointId: 14029,
  travelId,
  articleTitle: 'Из Мозыря в Микашевичи',
  articleUrl: '/travels/iz-mozyrya-v-mikashevichi',
  thumbnailUrl: null,
  thumbnailWidth: null,
  thumbnailHeight: null,
})

describe('normalizeRelatedTravelId (#1960)', () => {
  it.each([
    [129, 129],
    ['129', 129],
    [' 646 ', 646],
  ])('accepts %p as a positive safe integer id', (value, expected) => {
    expect(normalizeRelatedTravelId(value)).toBe(expected)
  })

  it.each([
    0,
    -5,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    '',
    '12a',
    '1e3',
    '-7',
    '12.0',
    null,
    undefined,
    true,
    { id: 1 },
  ])('rejects %p', (value) => {
    expect(normalizeRelatedTravelId(value)).toBeNull()
  })
})

describe('buildRelatedTravelTags (#1963)', () => {
  it('writes the normalized id next to the travel url', () => {
    expect(
      buildRelatedTravelTags({
        travelUrl: '/travels/minsk-za-vykhodnye',
        travelId: '646',
        articleUrl: '/travels/minsk-za-vykhodnye',
        travelName: 'Минск за выходные',
      }),
    ).toEqual({
      travelUrl: '/travels/minsk-za-vykhodnye',
      travelId: 646,
      articleUrl: '/travels/minsk-za-vykhodnye',
      travelName: 'Минск за выходные',
    })
  })

  it('omits travelId when the article has no valid id', () => {
    expect(
      buildRelatedTravelTags({
        travelUrl: '/travels/draft',
        travelId: 0,
        travelName: 'Черновик',
      }),
    ).toEqual({
      travelUrl: '/travels/draft',
      travelName: 'Черновик',
    })
  })

  it('does not store a dangling id without a travel url', () => {
    expect(buildRelatedTravelTags({ travelId: 435, articleUrl: '/travels/x' })).toEqual({
      articleUrl: '/travels/x',
    })
  })

  it('is the only production writer of tags.travelUrl', () => {
    const assignment = /tags\.travelUrl\s*=/
    const skipDir = new Set(['node_modules', '__tests__'])
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || skipDir.has(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue
        if (assignment.test(fs.readFileSync(full, 'utf8'))) {
          hits.push(path.relative(process.cwd(), full))
        }
      }
    }
    for (const root of ['api', 'app', 'components', 'hooks', 'screens', 'utils']) {
      walk(path.join(process.cwd(), root))
    }
    expect(hits).toEqual(['utils/relatedTravel.ts'])
    expect(
      fs.readFileSync(path.join(process.cwd(), 'hooks/useAddressListItemActions.ts'), 'utf8'),
    ).toContain('buildRelatedTravelTags')
    expect(
      fs.readFileSync(
        path.join(process.cwd(), 'components/travel/hooks/usePointListAddPointModel.ts'),
        'utf8',
      ),
    ).toContain('buildRelatedTravelTags')
  })
})

describe('resolveMapPointRelatedTravelId (#1960)', () => {
  it('reads the primary source id — the same row as the flat urlTravel', () => {
    expect(
      resolveMapPointRelatedTravelId({ primarySource: source(389), travelId: 646 }),
    ).toBe(389)
  })

  it('falls back to the flat travelId for points without a primary source id', () => {
    // Deep-link, карта «Рядом» и сгруппированная legacy-запись (derived source
    // без travelId) несут id только плоским полем.
    expect(resolveMapPointRelatedTravelId({ travelId: 646 })).toBe(646)
    expect(resolveMapPointRelatedTravelId({ primarySource: source(null), travelId: 646 })).toBe(646)
  })

  it('returns null when no valid explicit id is available', () => {
    expect(resolveMapPointRelatedTravelId({ primarySource: source(null) })).toBeNull()
    expect(resolveMapPointRelatedTravelId({ travelId: 0 })).toBeNull()
    expect(resolveMapPointRelatedTravelId(null)).toBeNull()
    expect(resolveMapPointRelatedTravelId(undefined)).toBeNull()
  })
})

describe('toCanonicalTravelPath (#1960)', () => {
  it.each([
    ['https://metravel.by/travels/ourvietnam?id=129', '/travels/ourvietnam'],
    ['https://metravel.by/travels/ourvietnam', '/travels/ourvietnam'],
    ['http://192.168.50.36/travels/krakow?id=435#map', '/travels/krakow'],
    ['http://localhost:8000/travels/krakow/?id=435', '/travels/krakow/'],
    ['/travels/polish camino?id=7', '/travels/polish%20camino'],
    ['/travel/42?utm_source=map', '/travel/42'],
  ])('strips host, query and hash from %p', (raw, expected) => {
    expect(toCanonicalTravelPath(raw)).toBe(expected)
  })

  it.each([
    'https://example.com/place/123',
    '/travels/',
    '/places?id=1',
    'javascript:alert(1)',
    '',
    '   ',
    null,
    undefined,
  ])('returns null for a non-travel url %p', (raw) => {
    expect(toCanonicalTravelPath(raw)).toBeNull()
  })
})
