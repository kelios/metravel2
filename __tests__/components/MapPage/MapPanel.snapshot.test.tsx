import { render } from '@testing-library/react-native'

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
})
