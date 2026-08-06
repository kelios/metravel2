import {
  MAP_TILE_PRECONNECT_ID,
  MAP_TILE_PRELOAD_ID,
  buildMapHeadBootstrapScript,
  buildMapTileWarmupRequest,
  buildMapWarmupTileHref,
  latLngToSlippyTileXY,
  resolveMapTileWarmupOrigin,
} from '@/utils/mapHeadBootstrap'

describe('mapHeadBootstrap', () => {
  it('builds the Minsk default warmup tile deterministically', () => {
    expect(latLngToSlippyTileXY(53.9006, 27.559, 11)).toEqual({ x: 1180, y: 658 })
    expect(buildMapWarmupTileHref()).toBe('/proxy/tiles/osm/11/1180/658.png')
  })

  it('uses a public proxy origin on localhost when env api is local or missing', () => {
    expect(
      resolveMapTileWarmupOrigin({
        hostname: 'localhost',
        envApiUrl: 'http://192.168.50.36:8000/api',
      }),
    ).toBe('https://metravel.by')

    expect(
      buildMapTileWarmupRequest({
        hostname: 'localhost',
        envApiUrl: '',
      }),
    ).toEqual({
      href: 'https://metravel.by/proxy/tiles/osm/11/1180/658.png',
    })
  })

  it('keeps same-origin proxy path on production hosts', () => {
    expect(
      buildMapTileWarmupRequest({
        hostname: 'metravel.by',
        envApiUrl: 'https://metravel.by/api',
      }),
    ).toEqual({
      href: '/proxy/tiles/osm/11/1180/658.png',
      crossOrigin: 'anonymous',
    })
  })

  it('embeds preload + preconnect ids into the shared head bootstrap script', () => {
    const script = buildMapHeadBootstrapScript('https://preprod.metravel.by/api')

    expect(script).toContain(MAP_TILE_PRELOAD_ID)
    expect(script).toContain(MAP_TILE_PRECONNECT_ID)
    expect(script).toContain("preload.as = 'image'")
    expect(script).toContain('/proxy/tiles/osm/11/1180/658.png')
    expect(script).toContain('window.__metravelMapTileWarmupHref')
    expect(script).toContain('/vendor/leaflet.css')
  })
})
