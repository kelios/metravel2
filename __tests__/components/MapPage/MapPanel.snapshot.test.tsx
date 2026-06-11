import React from 'react'
import { render } from '@testing-library/react-native'

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

describe('MapPanel native map rendering', () => {
  it('renders the native map container instead of the browser-only placeholder', () => {
    const tree = render(
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
            ],
            "type": "View",
          },
        ],
        "type": "View",
      }
    `)
  })
})
