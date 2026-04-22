import React from 'react'
import { render } from '@testing-library/react-native'

import MarkerClusterGroup from '@/components/MapPage/Map/MarkerClusterGroup'

jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
    unmount: jest.fn(),
  })),
}))

describe('MarkerClusterGroup', () => {
  const originalDocument = global.document

  beforeEach(() => {
    ;(global as any).document = {
      createElement: jest.fn(() => ({
        className: '',
        setAttribute: jest.fn(),
        innerHTML: '',
      })),
    }
  })

  afterEach(() => {
    ;(global as any).document = originalDocument
  })

  it('forwards popup shell props and popupopen handler to imperative Leaflet markers', () => {
    const popupOpen = jest.fn()
    const markerHandlers = new Map<string, (event: any) => void>()
    const marker = {
      bindPopup: jest.fn(),
      bindTooltip: jest.fn(),
      on: jest.fn((eventName: string, handler: (event: any) => void) => {
        markerHandlers.set(eventName, handler)
        return marker
      }),
    }
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      fitBounds: jest.fn(),
      getContainer: jest.fn(() => ({ clientWidth: 1280, clientHeight: 900 })),
    }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => marker),
      divIcon: jest.fn(),
    }

    render(
      <MarkerClusterGroup
        L={L}
        useMap={() => map}
        points={[
          {
            id: 1,
            coord: '53.9,27.56',
            address: 'Минск',
          } as any,
        ]}
        markerIcon={{}}
        PopupContent={() => null}
        Popup={() => null}
        popupProps={{
          className: 'metravel-place-popup',
          keepInView: true,
          autoPanPaddingTopLeft: [24, 140],
          autoPanPaddingBottomRight: [24, 140],
          eventHandlers: {
            popupopen: popupOpen,
          },
        }}
      />
    )

    expect(marker.bindPopup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        className: 'metravel-place-popup',
        keepInView: true,
        autoPanPaddingTopLeft: [24, 140],
        autoPanPaddingBottomRight: [24, 140],
      })
    )

    const popupEvent = { popup: { getElement: jest.fn() } }
    markerHandlers.get('popupopen')?.(popupEvent)

    expect(popupOpen).toHaveBeenCalledWith(popupEvent)
  })
})
