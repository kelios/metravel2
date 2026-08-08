import fs from 'fs'
import path from 'path'

import {
  MAP_SHELL_TILE_OFFSET_X_CSS_VAR,
  MAP_SHELL_TILE_OFFSET_Y_CSS_VAR,
  MAP_TILE_PRECONNECT_ID,
  MAP_TILE_PRELOAD_ID,
  MAP_TILE_PROXY_PATH,
  MAP_TILE_SIZE_PX,
  buildMapHeadBootstrapScript,
  buildMapTileWarmupRequest,
  buildMapWarmupTileHref,
  latLngToSlippyTilePlacement,
  latLngToSlippyTileXY,
  resolveMapTileWarmupOrigin,
} from '@/utils/mapHeadBootstrap'
import { OSM_PROXY_TILE_PATH } from '@/config/mapWebTileContract'

describe('mapHeadBootstrap', () => {
  it('keeps the +html bootstrap on the pure tile contract boundary', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'utils/mapHeadBootstrap.ts'),
      'utf8',
    )

    expect(source).toContain("from '@/config/mapWebTileContract'")
    expect(source).not.toContain("from '@/config/mapWebLayers'")
  })

  it('builds the Minsk default warmup tile deterministically', () => {
    expect(latLngToSlippyTileXY(53.9006, 27.559, 11)).toEqual({ x: 1180, y: 658 })
    expect(buildMapWarmupTileHref()).toBe('/proxy/tiles/osm/11/1180/658.png')
    expect(MAP_TILE_PROXY_PATH).toBe(OSM_PROXY_TILE_PATH)

    const placement = latLngToSlippyTilePlacement(53.9006, 27.559, 11)
    expect(placement.offsetX).toBeGreaterThanOrEqual(-MAP_TILE_SIZE_PX)
    expect(placement.offsetX).toBeLessThanOrEqual(0)
    expect(placement.offsetY).toBeGreaterThanOrEqual(-MAP_TILE_SIZE_PX)
    expect(placement.offsetY).toBeLessThanOrEqual(0)
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
    expect(script).toContain('window.__metravelMountMapShellTile')
    expect(script).toContain('^192\\\\.168\\\\.')
    expect(script).toContain('/vendor/leaflet.css')
    expect(script.indexOf('document.head.appendChild(preload);')).toBeLessThan(
      script.indexOf('addSheet("metravel-leaflet-css", \'/vendor/leaflet.css\''),
    )
  })

  it('mounts exactly one shell tile with the same URL and mode as the one preload', () => {
    window.history.replaceState({}, '', '/map')
    document.head.innerHTML = ''
    document.body.innerHTML =
      '<div id="ssg-skeleton"><div class="ssg-map-canvas">' +
      '<img class="ssg-map-tile" data-ssg-map-tile="true" width="256" height="256">' +
      '</div></div><div id="root"></div>'

    const script = buildMapHeadBootstrapScript('https://preprod.metravel.by/api')
    new Function(script)()
    new Function(script)()

    const preloads = document.querySelectorAll(
      `link#${MAP_TILE_PRELOAD_ID}[data-metravel-map-tile-preload="true"]`,
    )
    const tiles = document.querySelectorAll<HTMLImageElement>('img[data-ssg-map-tile="true"]')

    expect(preloads).toHaveLength(1)
    expect(tiles).toHaveLength(1)
    expect(tiles[0].getAttribute('src')).toBe(preloads[0].getAttribute('href'))
    expect(tiles[0].getAttribute('src')).toBe(
      'https://preprod.metravel.by/proxy/tiles/osm/11/1180/658.png',
    )
    expect(tiles[0].getAttribute('crossorigin')).toBe(
      preloads[0].getAttribute('crossorigin'),
    )
    expect(tiles[0].width).toBe(MAP_TILE_SIZE_PX)
    expect(tiles[0].height).toBe(MAP_TILE_SIZE_PX)
    expect(document.documentElement.style.getPropertyValue(MAP_SHELL_TILE_OFFSET_X_CSS_VAR)).toBe(
      '-199.703px',
    )
    expect(document.documentElement.style.getPropertyValue(MAP_SHELL_TILE_OFFSET_Y_CSS_VAR)).toBe(
      '-137.24px',
    )
    expect(tiles[0].style.left).toBe('')
    expect(tiles[0].style.top).toBe('')
    expect(tiles[0].style.transform).toBe('')

    document.documentElement.style.removeProperty(MAP_SHELL_TILE_OFFSET_X_CSS_VAR)
    document.documentElement.style.removeProperty(MAP_SHELL_TILE_OFFSET_Y_CSS_VAR)
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
  })
})
