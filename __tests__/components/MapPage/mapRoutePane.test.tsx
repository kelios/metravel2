/**
 * #1813 — оба слоя маршрута получают свой pane через общий `ensureMapPane`.
 * Тест держит то же, что `mapUserLocationPane.test.tsx` держит для маркера «вы
 * здесь»: pane получает z-index даже на пропатченном get-or-create `getPane`, а
 * detached-заглушка мёртвой карты не превращается в pane для линии.
 */
import React from 'react'
import { render, act } from '@testing-library/react-native'

import MapRoute from '@/components/MapPage/Map/MapRoute'
import RouteLineLayer from '@/components/MapPage/Map/RouteLineLayer'
import { ROUTE_PANE_NAME } from '@/components/MapPage/Map/travelMapGeometry'

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ danger: '#f00', surface: '#fff', info: '#00f', primary: '#0f0' }),
}))

type FakePane = { style: Record<string, string>; isConnected: boolean }

const makeMap = ({ connected = true }: { connected?: boolean } = {}) => {
  const panes: Record<string, FakePane> = {}
  const makePane = (name: string) => {
    const el: FakePane = { style: {}, isConnected: connected }
    panes[name] = el
    return el
  }
  return {
    panes,
    createPane: jest.fn((name: string) => makePane(name)),
    // Пропатченный `utils/leafletFix` getPane: сам создаёт pane, но без стилей.
    getPane: jest.fn((name: string) => panes[name] ?? makePane(name)),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    invalidateSize: jest.fn(),
  }
}

const polylineOpts: Array<Record<string, any>> = []

const makeLeaflet = () => ({
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  svg: jest.fn((opts?: any) => ({ svg: true, opts })),
  polyline: jest.fn((_latlngs: any, opts: any) => {
    polylineOpts.push(opts)
    return { addTo: jest.fn(), bringToFront: jest.fn(), redraw: jest.fn(), getBounds: () => null }
  }),
  featureGroup: undefined,
  layerGroup: jest.fn(() => ({ addTo: jest.fn() })),
})

const coords = [
  { lat: 53.9, lng: 27.56 },
  { lat: 53.91, lng: 27.57 },
]

beforeEach(() => {
  polylineOpts.length = 0
})

// Оба слоя вешают polyline отложенно (MapRoute — setTimeout 0, RouteLineLayer —
// 10мс). Fake timers здесь не годятся: авто-cleanup RTL после них зависает.
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
}

describe('#1813 — pane маршрута на карте раздела «Карта» (MapRoute)', () => {
  it('получает z-index на пропатченном get-or-create getPane', async () => {
    const map = makeMap()
    render(<MapRoute map={map} leaflet={makeLeaflet()} routeCoordinates={coords} isOptimal />)
    await flush()

    expect(map.panes[ROUTE_PANE_NAME].style.zIndex).toBe('590')
    expect(map.panes[ROUTE_PANE_NAME].style.pointerEvents).toBe('none')
    expect(polylineOpts).toHaveLength(2)
    expect(polylineOpts.every((opts) => opts.pane === ROUTE_PANE_NAME)).toBe(true)
  })

  it('на detached-заглушке мёртвой карты оставляет линию в штатном pane', async () => {
    const map = makeMap({ connected: false })
    render(<MapRoute map={map} leaflet={makeLeaflet()} routeCoordinates={coords} isOptimal />)
    await flush()

    expect(map.panes[ROUTE_PANE_NAME].style.zIndex).toBeUndefined()
    expect(polylineOpts).toHaveLength(2)
    expect(polylineOpts.every((opts) => opts.pane === undefined)).toBe(true)
  })
})

describe('#1813 — pane маршрута на карте статьи (RouteLineLayer)', () => {
  const colors = { surface: '#fff', info: '#00f', primary: '#0f0' } as any
  const lineCoords: [number, number][] = [
    [53.9, 27.56],
    [53.91, 27.57],
  ]

  it('получает z-index на пропатченном get-or-create getPane', async () => {
    const map = makeMap()
    render(
      <RouteLineLayer
        routeLineCoords={lineCoords}
        colors={colors}
        useMap={() => map}
        L={makeLeaflet()}
      />,
    )
    await flush()

    expect(map.panes[ROUTE_PANE_NAME].style.zIndex).toBe('450')
    expect(map.panes[ROUTE_PANE_NAME].style.pointerEvents).toBe('none')
    expect(polylineOpts).toHaveLength(2)
    expect(polylineOpts.every((opts) => opts.pane === ROUTE_PANE_NAME)).toBe(true)
  })

  it('на detached-заглушке мёртвой карты откатывается в overlayPane', async () => {
    const map = makeMap({ connected: false })
    render(
      <RouteLineLayer
        routeLineCoords={lineCoords}
        colors={colors}
        useMap={() => map}
        L={makeLeaflet()}
      />,
    )
    await flush()

    expect(map.panes[ROUTE_PANE_NAME].style.zIndex).toBeUndefined()
    expect(polylineOpts).toHaveLength(2)
    expect(polylineOpts.every((opts) => opts.pane === 'overlayPane')).toBe(true)
  })
})
