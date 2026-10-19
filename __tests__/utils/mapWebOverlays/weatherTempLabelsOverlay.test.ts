import { attachWeatherTempLabelsOverlay } from '@/utils/mapWebOverlays/weatherTempLabelsOverlay'

jest.mock('@/config/mapWebLayers', () => ({ getOwmApiKey: () => 'test-key' }))

const flush = () => new Promise((resolve) => setTimeout(resolve, 80))

describe('attachWeatherTempLabelsOverlay', () => {
  it('attaches provider attribution to the custom Leaflet layer group', () => {
    const layer = {
      clearLayers: jest.fn(),
    }
    const L = {
      layerGroup: jest.fn(() => layer),
    }
    const map = {}

    const controller = attachWeatherTempLabelsOverlay(L, map, {
      attribution: '<a href="https://openweathermap.org/">Weather data provided by OpenWeather</a>',
    })

    expect(L.layerGroup).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        attribution: expect.stringContaining('Weather data provided by OpenWeather'),
      }),
    )
    expect(controller.layer).toBe(layer)
  })

  it('moveend inside the same view keeps labels and sends no new OWM requests (#2661)', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ main: { temp: 9 } }) }))
    const originalFetch = global.fetch
    global.fetch = fetchMock as unknown as typeof fetch
    try {
      const items: unknown[] = []
      const layer = {
        clearLayers: jest.fn(() => items.splice(0)),
        removeLayer: jest.fn(),
      }
      const panes: Record<string, { style: Record<string, string> }> = {}
      const handlers: Record<string, () => void> = {}
      const L = {
        layerGroup: jest.fn(() => layer),
        divIcon: (options: unknown) => options,
        marker: jest.fn(() => ({ addTo: () => items.push(1) })),
      }
      const map = {
        getPane: (name: string) => panes[name],
        createPane: (name: string) => {
          panes[name] = { style: {} }
          return panes[name]
        },
        getBounds: () => ({
          getSouthWest: () => ({ lat: 53.6, lng: 27.2 }),
          getNorthEast: () => ({ lat: 54.2, lng: 27.9 }),
        }),
        getSize: () => ({ x: 390, y: 844 }),
        getZoom: () => 10,
        on: (event: string, handler: () => void) => {
          handlers[event] = handler
        },
        off: jest.fn(),
      }

      const overlay = attachWeatherTempLabelsOverlay(L, map, { minZoom: 6 })
      overlay.start()
      await flush()
      const calls = fetchMock.mock.calls.length
      const created = L.marker.mock.calls.length
      expect(calls).toBeGreaterThan(0)
      expect(created).toBe(calls)

      handlers.moveend()
      await flush()
      expect(fetchMock).toHaveBeenCalledTimes(calls)
      expect(L.marker).toHaveBeenCalledTimes(created)
      expect(layer.clearLayers).not.toHaveBeenCalled()

      overlay.stop()
      expect(layer.clearLayers).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
    }
  })
})
