import React from 'react'
import { render } from '@testing-library/react-native'
import MapPanel from '@/components/MapPage/MapPanel'

// Упрощаем зависимости, чтобы получить стабильный снапшот
jest.mock('@/hooks/useLazyMap', () => ({
  useLazyMap: () => ({ shouldLoad: false, setElementRef: jest.fn() }),
}))

// Небольшой помощник для "плоского" снапшота без стилей
const simplify = (node: any): any => {
  if (!node) return null
  if (typeof node === 'string' || typeof node === 'number') return node
  const { type, children } = node
  return {
    type,
    children: Array.isArray(children) ? children.map(simplify) : simplify(children),
  }
}

describe('MapPanel snapshot (fallback on non-web)', () => {
  it('renders placeholder when not on web and matches snapshot', () => {
    const tree = render(
      <MapPanel
        travelsData={[]}
        coordinates={{ latitude: 0, longitude: 0 }}
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
      />
    ).toJSON()

    expect(simplify(tree)).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": null,
            "type": "ActivityIndicator",
          },
          {
            "children": [
              "Карта доступна только в браузере",
            ],
            "type": "Text",
          },
        ],
        "type": "View",
      }
    `)
  })
})
