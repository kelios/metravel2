import { render } from '@testing-library/react'
import { Platform } from 'react-native'

import { MapCanvas, type MapCanvasEngine } from '@/components/MapPage/Map/MapCanvas'
import { getOsmTileUrl } from '@/config/mapWebLayers'

// Engine-only MapCanvas (#992): проверяем контракт движка, общего для
// travel-wizard / trip-planner / quest-web:
//  1. Тайлы берутся из единого провайдера getOsmTileUrl (гейт no-direct-osm-tiles).
//  2. Дети рендерятся ВНУТРИ MapContainer и получают доступ к движку { L, RL }.
//  3. Опции Leaflet прокидываются в MapContainer как есть.

let lastTileProps: Record<string, unknown> | null = null
let lastContainerProps: Record<string, unknown> | null = null

const makeEngine = (): MapCanvasEngine => {
  const MapContainer = ({ children, ...props }: any) => {
    lastContainerProps = props
    return <div data-testid="map-container">{children}</div>
  }
  const TileLayer = (props: any) => {
    lastTileProps = props
    return <div data-testid="tile-layer" />
  }
  const useMap = () => ({
    invalidateSize: jest.fn(),
    getContainer: () => document.createElement('div'),
    scrollWheelZoom: { enable: jest.fn(), disable: jest.fn() },
  })

  return {
    L: {} as any,
    // Только то, что использует движок + дети теста.
    RL: { MapContainer, TileLayer, useMap } as any,
  }
}

describe('MapCanvas engine (#992)', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    lastTileProps = null
    lastContainerProps = null
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('renders the OSM tile provider (never a hardcoded OSM host)', () => {
    render(<MapCanvas engine={makeEngine()} center={[53.9, 27.56]} zoom={10} />)

    expect(lastTileProps?.url).toBe(getOsmTileUrl())
    expect(String(lastTileProps?.url)).not.toMatch(/tile\.openstreetmap\./)
  })

  it('passes the loaded engine to the children render-prop', () => {
    const spy = jest.fn(() => null)
    const engine = makeEngine()

    render(
      <MapCanvas engine={engine}>
        {(e) => spy(e)}
      </MapCanvas>,
    )

    expect(spy).toHaveBeenCalledWith(engine)
  })

  it('forwards explicit Leaflet MapContainer options and omits undefined ones', () => {
    render(
      <MapCanvas
        engine={makeEngine()}
        bounds={[[10, 20], [11, 21]]}
        scrollWheelZoom={false}
        zoomControl
      />,
    )

    expect(lastContainerProps?.bounds).toEqual([[10, 20], [11, 21]])
    expect(lastContainerProps?.scrollWheelZoom).toBe(false)
    expect(lastContainerProps?.zoomControl).toBe(true)
    // center/zoom не заданы → не форвардятся (остаётся дефолт Leaflet / bounds).
    expect(lastContainerProps?.center).toBeUndefined()
  })

  it('renders the fallback instead of a map on native', () => {
    ;(Platform as any).OS = 'android'
    const screen = render(
      <MapCanvas engine={makeEngine()} fallback={<div data-testid="fallback" />} />,
    )

    expect(screen.queryByTestId('map-container')).toBeNull()
    expect(screen.getByTestId('fallback')).toBeTruthy()
  })
})
