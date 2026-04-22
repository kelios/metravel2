/**
 * @jest-environment jsdom
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import {
  OverlaysPopover,
  normalizeOverlayCopy,
} from '@/components/MapPage/popovers/OverlaysPopover'

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#5d8c7c',
    primarySoft: '#e8f5e9',
    primaryText: '#214438',
    text: '#1a1a1a',
    textMuted: '#666666',
    textOnPrimary: '#ffffff',
    surface: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderLight: '#ececec',
    borderAccent: '#c9ddd4',
  }),
}))

describe('OverlaysPopover', () => {
  it('normalizes technical overlay labels into readable copy', () => {
    expect(
      normalizeOverlayCopy({
        id: 'waymarked-hiking',
        title: 'Маршруты (Waymarked Trails: hiking)',
      }),
    ).toEqual({
      title: 'Пешие маршруты',
      subtitle: 'Waymarked Trails',
      badge: 'Треки',
    })
  })

  it('renders readable overlay text and toggles/reset actions', () => {
    const onToggle = jest.fn()
    const onReset = jest.fn()
    const onClose = jest.fn()

    const { getByText, getByTestId } = render(
      <OverlaysPopover
        options={[
          { id: 'waymarked-hiking', title: 'Маршруты (Waymarked Trails: hiking)' },
          { id: 'osm-poi', title: 'Достопримечательности (OSM)' },
        ]}
        enabledOverlays={{ 'waymarked-hiking': true, 'osm-poi': false }}
        onToggle={onToggle}
        onReset={onReset}
        onClose={onClose}
      />,
    )

    expect(getByText('Включено 1 из 2')).toBeTruthy()
    expect(getByText('Пешие маршруты')).toBeTruthy()
    expect(getByText('Waymarked Trails')).toBeTruthy()
    expect(getByText('Достопримечательности')).toBeTruthy()
    expect(getByText('Интересные места из OSM')).toBeTruthy()

    fireEvent.press(getByTestId('overlays-popover-row-osm-poi'))
    expect(onToggle).toHaveBeenCalledWith('osm-poi', true)

    fireEvent.press(getByTestId('overlays-popover-reset-button'))
    expect(onReset).toHaveBeenCalled()

    fireEvent.press(getByTestId('overlays-popover-close-button'))
    expect(onClose).toHaveBeenCalled()
  })

  it('disables reset when all overlays are already off', () => {
    const onReset = jest.fn()

    const { getByTestId } = render(
      <OverlaysPopover
        options={[{ id: 'osm-poi', title: 'Достопримечательности (OSM)' }]}
        enabledOverlays={{ 'osm-poi': false }}
        onToggle={jest.fn()}
        onReset={onReset}
        onClose={jest.fn()}
      />,
    )

    fireEvent.press(getByTestId('overlays-popover-reset-button'))
    expect(onReset).not.toHaveBeenCalled()
  })
})
