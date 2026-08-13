import { attachWeatherTempLabelsOverlay } from '@/utils/mapWebOverlays/weatherTempLabelsOverlay'

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
})
