import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import { NativeRoutePickerMap } from '@/components/travel/stepRoute/NativeRoutePickerMap'

describe('NativeRoutePickerMap', () => {
  it('stacks the hint above a full-width geolocation action on narrow native screens', () => {
    const screen = render(
      <NativeRoutePickerMap
        markers={[]}
        onAddPoint={jest.fn()}
        onMovePoint={jest.fn()}
        onSelectPoint={jest.fn()}
      />,
    )

    expect(StyleSheet.flatten(screen.getByTestId('travel-wizard.step-route.native-map-footer').props.style))
      .toEqual(expect.objectContaining({
        flexDirection: 'column',
        alignItems: 'stretch',
      }))

    const locationButton = screen.getByTestId('travel-wizard.step-route.my-location')
    const resolvedButtonStyle = typeof locationButton.props.style === 'function'
      ? locationButton.props.style({ pressed: false })
      : locationButton.props.style

    expect(StyleSheet.flatten(resolvedButtonStyle)).toEqual(expect.objectContaining({
      alignSelf: 'stretch',
      justifyContent: 'center',
    }))
  })
})
