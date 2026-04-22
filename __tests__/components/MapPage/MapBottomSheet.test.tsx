import React from 'react'
import { Platform, View } from 'react-native'
import { render } from '@testing-library/react-native'

import MapBottomSheet from '@/components/MapPage/MapBottomSheet'

const mockBottomSheet = jest.fn(({ children }: any) => (
  <View testID="gorhom-bottom-sheet">{children}</View>
))

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    __esModule: true,
    default: (props: any) => mockBottomSheet(props),
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  }
})

describe('MapBottomSheet', () => {
  it('disables dynamic sizing when using fixed snap points on mobile web', () => {
    Platform.OS = 'web'

    render(
      <MapBottomSheet>
        <View testID="sheet-content" />
      </MapBottomSheet>,
    )

    expect(mockBottomSheet).toHaveBeenCalled()
    expect(mockBottomSheet.mock.calls[0]?.[0]?.enableDynamicSizing).toBe(false)
  })
})
