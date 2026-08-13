const {
  ALLOWED_FILES,
  evaluateGuard,
  findViolationsInSource,
} = require('@/scripts/guard-no-direct-osm-tiles')

describe('guard-no-direct-osm-tiles', () => {
  it('keeps no runtime allowlist for direct OSM or CARTO tiles', () => {
    expect(Array.from(ALLOWED_FILES)).toEqual([])
  })

  it.each([
    ['direct OSM', "const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'"],
    ['unlicensed CARTO', "const url = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'"],
    [
      'legacy unlicensed CARTO',
      "const url = 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'",
    ],
  ])('rejects %s basemap URLs', (_label, content) => {
    const violations = findViolationsInSource({
      filePath: 'components/map/example.ts',
      content,
    })

    expect(violations).toHaveLength(1)
  })

  it('accepts the canonical MeTravel OSM proxy contract', () => {
    const result = evaluateGuard({
      sources: [
        {
          filePath: 'utils/mapSnapshot/example.ts',
          content: 'const url = getOsmTileUrl()',
        },
      ],
    })

    expect(result.ok).toBe(true)
  })
})
