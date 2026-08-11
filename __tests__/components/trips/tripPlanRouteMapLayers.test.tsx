/**
 * #1306 — слои главной карты на карте конструктора маршрута.
 *
 * Контракт, который держит этот тест:
 *  1. на карте конструктора есть кнопка «Слои» с тем же набором слоёв, что на /map;
 *  2. перф-инвариант старта: пока слой выключен, его контроллер НЕ стартует —
 *     значит запросов overpass/OWM при открытии конструктора нет;
 *  3. включение слоя стартует ровно его контроллер и пишет выбор в общий store,
 *     из которого тот же слой читает /map;
 *  4. легенда погоды получает общий выбор слоёв.
 */
import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import { getDefaultOverlayState, useMapOverlaysStore } from '@/stores/mapOverlaysStore'

type Controller = { layer: { addTo: jest.Mock }; start: jest.Mock; stop: jest.Mock }

const controllers: Record<string, Controller> = {}

const makeController = (id: string): Controller => {
  const controller: Controller = {
    layer: { addTo: jest.fn() },
    start: jest.fn(),
    stop: jest.fn(),
  }
  controllers[id] = controller
  return controller
}

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))

jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

// Контроллеры оверлеев подменяем спайами: нас интересует не их сеть, а момент
// start/stop — именно он решает, уходит ли запрос overpass/OWM.
jest.mock('@/utils/mapWebOverlays/osmCampingOverlay', () => ({
  attachOsmCampingOverlay: () => makeController('osm-camping'),
}))
jest.mock('@/utils/mapWebOverlays/osmPoiOverlay', () => ({
  attachOsmPoiOverlay: () => makeController('osm-poi'),
}))
jest.mock('@/utils/mapWebOverlays/osmRoutesOverlay', () => ({
  attachOsmRoutesOverlay: () => makeController('osm-routes'),
}))
jest.mock('@/utils/mapWebOverlays/osmFeaturesOverlay', () => ({
  attachOsmFeaturesOverlay: (_L: unknown, _map: unknown, options: { layerId: string }) =>
    makeController(options.layerId),
}))
jest.mock('@/utils/mapWebOverlays/weatherTempLabelsOverlay', () => ({
  attachWeatherTempLabelsOverlay: () => makeController('weather-temp-labels'),
}))
jest.mock('@/utils/mapWebOverlays/lasyZanocujWfsOverlay', () => ({
  attachLasyZanocujWfsOverlay: (_L: unknown, _map: unknown, def: { id: string }) =>
    makeController(def.id),
}))

jest.mock('@/utils/mapWebLayers', () => ({
  attachTileRetry: (layer: unknown) => layer,
  createLeafletLayer: (_L: unknown, def: { id: string }) => makeController(def.id).layer,
}))

jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => positions,
      tileLayer: () => ({ addTo: jest.fn() }),
    },
    RL: {
      Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: () => null,
      useMap: () => ({ setView: jest.fn(), fitBounds: jest.fn(), stop: jest.fn() }),
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => {
  const ReactModule = require('react') as typeof React

  const createLeafletMapMock = () => {
    const attached = new Set<unknown>()
    return {
      addLayer: jest.fn((layer: unknown) => attached.add(layer)),
      removeLayer: jest.fn((layer: unknown) => attached.delete(layer)),
      hasLayer: jest.fn((layer: unknown) => attached.has(layer)),
      getCenter: () => ({ lat: 53.9, lng: 27.5 }),
      getZoom: () => 10,
      getSize: () => ({ x: 800, y: 320 }),
      on: jest.fn(),
      off: jest.fn(),
      whenReady: (callback: () => void) => callback(),
    }
  }

  return {
    MapCanvas: ({
      children,
      onMapRef,
    }: {
      children?: (engine: unknown) => React.ReactNode
      onMapRef?: (map: unknown) => void
    }) => {
      const mapRef = ReactModule.useRef<unknown>(null)
      if (!mapRef.current) mapRef.current = createLeafletMapMock()
      ReactModule.useEffect(() => {
        onMapRef?.(mapRef.current)
      }, [onMapRef])

      return <div data-testid="map-canvas">{children?.({})}</div>
    },
  }
})

// В jest модуль резолвится в native-заглушку (она рендерит null), поэтому
// подменяем её видимым стабом — так проверяем, какой набор слоёв доехал до легенды.
jest.mock('@/components/MapPage/WeatherLegend', () => {
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ enabledOverlays }: { enabledOverlays?: Record<string, boolean> | null }) => (
      <Text testID="trip-plan-weather-legend">
        {Object.keys(enabledOverlays ?? {})
          .filter((id) => enabledOverlays?.[id])
          .join(',')}
      </Text>
    ),
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'

const LAYERS_LABEL = 'Слои карты'

// Карта конструктора — web-поверхность, а jest-expo по умолчанию отдаёт ios.
// Без подмены `useMapInstance` вышел бы по своему web-гарду и тест проверял бы
// пустоту вместо реальной механики слоёв.
const originalOS = Platform.OS

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
}

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

const renderMap = async () => {
  const utils = render(<TripPlanRouteMap route={route} />)
  await waitFor(() => utils.UNSAFE_getByProps({ 'data-testid': 'trip-plan-map-layers' }))
  return utils
}

const openLayers = (utils: Awaited<ReturnType<typeof renderMap>>) => {
  fireEvent(utils.UNSAFE_getByProps({ 'data-testid': 'trip-plan-map-layers' }), 'click')
}

describe('TripPlanRouteMap — слои карты (#1306)', () => {
  beforeEach(() => {
    setPlatformOS('web')
    for (const key of Object.keys(controllers)) delete controllers[key]
    useMapOverlaysStore.setState({ enabledOverlays: getDefaultOverlayState() })
  })

  afterEach(() => {
    setPlatformOS(originalOS)
  })

  it('показывает кнопку «Слои» на карте конструктора', async () => {
    const utils = await renderMap()

    expect(
      utils.UNSAFE_getByProps({ 'data-testid': 'trip-plan-map-layers' }).props['aria-label'],
    ).toBe(LAYERS_LABEL)
    expect(utils.queryByTestId('map-mobile-layers-popover')).toBeNull()
  })

  it('открывает поповер с тем же набором слоёв, что на главной карте', async () => {
    const utils = await renderMap()

    openLayers(utils)

    expect(utils.getByTestId('map-mobile-layers-popover')).toBeTruthy()
    // Ночлег/кемпинги, POI и маршруты — те же id, что на /map.
    expect(utils.getByTestId('map-overlay-osm-camping')).toBeTruthy()
    expect(utils.getByTestId('map-overlay-osm-poi')).toBeTruthy()
    expect(utils.getByTestId('map-overlay-osm-routes')).toBeTruthy()
  })

  // Перф-инвариант старта конструктора: слои создаются «холодными».
  it('не запускает контроллеры оверлеев, пока слой не включён', async () => {
    await renderMap()

    await waitFor(() => expect(controllers['osm-camping']).toBeDefined())

    for (const [id, controller] of Object.entries(controllers)) {
      expect([id, controller.start.mock.calls.length]).toEqual([id, 0])
    }
  })

  it('включение слоя стартует его контроллер и сохраняет выбор в общий store', async () => {
    const utils = await renderMap()

    openLayers(utils)
    fireEvent.press(utils.getByTestId('map-overlay-osm-camping'))

    await waitFor(() => expect(controllers['osm-camping'].start).toHaveBeenCalled())
    expect(controllers['osm-camping'].layer.addTo).toHaveBeenCalled()
    // Тот же store читает /map — выбор слоёв общий.
    expect(useMapOverlaysStore.getState().enabledOverlays['osm-camping']).toBe(true)
    // Соседние слои не поднимаем.
    expect(controllers['osm-poi'].start).not.toHaveBeenCalled()
  })

  it('отдаёт легенде погоды слои, включённые на главной карте', async () => {
    useMapOverlaysStore.getState().setOverlayEnabled('weather-temp', true)

    const utils = await renderMap()

    expect(utils.getByTestId('trip-plan-weather-legend').props.children).toContain('weather-temp')
  })
})
