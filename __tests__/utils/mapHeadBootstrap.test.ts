import fs from 'fs'
import path from 'path'

import {
  MAP_TILE_PRECONNECT_ID,
  buildMapHeadBootstrapScript,
  resolveMapTilePreconnectOrigin,
} from '@/utils/mapHeadBootstrap'

describe('mapHeadBootstrap', () => {
  it('keeps the +html bootstrap on the pure tile contract boundary', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'utils/mapHeadBootstrap.ts'),
      'utf8',
    )

    expect(source).toContain("from '@/config/mapWebTileContract'")
    expect(source).not.toContain("from '@/config/mapWebLayers'")
  })

  it('preconnects only when a local page uses an external tile proxy', () => {
    expect(
      resolveMapTilePreconnectOrigin({
        hostname: 'metravel.by',
        envApiUrl: 'https://metravel.by/api',
      }),
    ).toBeNull()

    expect(
      resolveMapTilePreconnectOrigin({
        hostname: 'localhost',
        envApiUrl: 'http://192.168.50.36:8000/api',
      }),
    ).toBe('https://metravel.by')

    expect(
      resolveMapTilePreconnectOrigin({
        hostname: 'localhost',
        envApiUrl: 'https://preprod.metravel.by/api',
      }),
    ).toBe('https://preprod.metravel.by')
  })

  it('loads map CSS without guessing a tile URL before the settled fit', () => {
    const script = buildMapHeadBootstrapScript('https://preprod.metravel.by/api')

    expect(script).toContain(MAP_TILE_PRECONNECT_ID)
    expect(script).toContain('^192\\\\.168\\\\.')
    expect(script).toContain('/vendor/leaflet.css')
    expect(script).toContain('/vendor/MarkerCluster.css')
    expect(script).not.toContain('/proxy/tiles/osm/')
    expect(script).not.toContain("preload.as = 'image'")
    expect(script).not.toContain('__metravelMapTileWarmupHref')
    expect(script).not.toContain('__metravelMountMapShellTile =')
  })

  it('starts zero tile requests before runtime fit and keeps one preconnect', () => {
    window.history.replaceState({}, '', '/map')
    document.head.innerHTML = ''
    document.body.innerHTML =
      '<div id="ssg-skeleton"><div class="ssg-map-canvas">' +
      '<img class="ssg-map-tile" data-ssg-map-tile="true" width="256" height="256">' +
      '</div></div><div id="root"></div>'

    const script = buildMapHeadBootstrapScript('https://preprod.metravel.by/api')
    new Function(script)()
    new Function(script)()

    const preloads = document.querySelectorAll('link[rel="preload"][as="image"]')
    const preconnects = document.querySelectorAll(`link#${MAP_TILE_PRECONNECT_ID}`)
    const tile = document.querySelector<HTMLImageElement>('img[data-ssg-map-tile="true"]')

    expect(preloads).toHaveLength(0)
    expect(
      document.querySelectorAll(
        '[src*="/proxy/tiles/osm/"],[href*="/proxy/tiles/osm/"]',
      ),
    ).toHaveLength(0)
    expect(preconnects).toHaveLength(1)
    expect(preconnects[0].getAttribute('href')).toBe('https://preprod.metravel.by')
    expect(tile?.getAttribute('src')).toBeNull()
    expect(document.querySelectorAll('link#metravel-leaflet-css')).toHaveLength(1)
    expect(document.querySelectorAll('link#metravel-markercluster-css')).toHaveLength(1)

    document.head.innerHTML = ''
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
  })
})
