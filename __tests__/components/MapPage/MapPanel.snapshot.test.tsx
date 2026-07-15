import { render, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/__tests__/helpers/testQueryClient'
import MapPanel from '@/components/MapPage/MapPanel'

const simplify = (node: any): any => {
  if (!node) return null
  if (typeof node === 'string' || typeof node === 'number') return node
  const { type, children } = node
  return {
    type,
    children: Array.isArray(children) ? children.map(simplify) : simplify(children),
  }
}

const renderWithQueryClient = (ui: React.ReactElement) => {
  const { Wrapper } = createQueryWrapper()
  return render(ui, { wrapper: Wrapper })
}

describe('MapPanel native map rendering', () => {
  it('renders the native map container instead of the browser-only placeholder', () => {
    const tree = renderWithQueryClient(
      <MapPanel
        travelsData={[]}
        coordinates={{ latitude: 0, longitude: 0 }}
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
      />
    ).toJSON()

    expect(JSON.stringify(tree)).not.toContain('Карта доступна только в браузере')
    expect(simplify(tree)).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "children": [
                  {
                    "children": null,
                    "type": "ActivityIndicator",
                  },
                ],
                "type": "View",
              },
              {
                "children": null,
                "type": "View",
              },
              {
                "children": [
                  {
                    "children": [
                      "download-cloud",
                    ],
                    "type": "Text",
                  },
                ],
                "type": "View",
              },
            ],
            "type": "View",
          },
        ],
        "type": "View",
      }
    `)
  })

  it('wires native map UI API to the WebView map implementation', () => {
    const onMapUiApiReady = jest.fn()

    renderWithQueryClient(
      <MapPanel
        travelsData={[]}
        coordinates={{ latitude: 0, longitude: 0 }}
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
        onMapUiApiReady={onMapUiApiReady}
      />,
    )

    expect(onMapUiApiReady).toHaveBeenCalledWith(
      expect.objectContaining({
        zoomIn: expect.any(Function),
        zoomOut: expect.any(Function),
        centerOnUser: expect.any(Function),
      }),
    )
  })

  it('reports trusted native coordinates as the current user location', async () => {
    const onUserLocationChange = jest.fn()

    renderWithQueryClient(
      <MapPanel
        travelsData={[]}
        coordinates={{ latitude: 52.2, longitude: 20.98 }}
        coordinatesAreFallback={false}
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
        onUserLocationChange={onUserLocationChange}
      />,
    )

    await waitFor(() => {
      expect(onUserLocationChange).toHaveBeenCalledWith({
        latitude: 52.2,
        longitude: 20.98,
      })
    })
  })

  it('does not report fallback native coordinates as the current user location', async () => {
    const onUserLocationChange = jest.fn()

    renderWithQueryClient(
      <MapPanel
        travelsData={[]}
        coordinates={{ latitude: 53.9006, longitude: 27.559 }}
        coordinatesAreFallback
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
        onUserLocationChange={onUserLocationChange}
      />,
    )

    await waitFor(() => {
      expect(onUserLocationChange).toHaveBeenCalledWith(null)
    })
  })

  it('keeps a trusted user fix separate from a URL or search viewport center', async () => {
    const onUserLocationChange = jest.fn()

    renderWithQueryClient(
      <MapPanel
        travelsData={[]}
        coordinates={{ latitude: 48.8566, longitude: 2.3522 }}
        coordinatesAreFallback
        userLocation={{ latitude: 52.2, longitude: 20.98 }}
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
        onUserLocationChange={onUserLocationChange}
      />,
    )

    await waitFor(() => {
      expect(onUserLocationChange).toHaveBeenCalledWith({
        latitude: 52.2,
        longitude: 20.98,
      })
    })
  })
})
