import React from 'react'
import { Platform, View } from 'react-native'
import { render } from '@testing-library/react-native'

import MapBottomSheet from '@/components/MapPage/MapBottomSheet'

const mockBottomSheet = jest.fn(({ children }: any) => (
  <View testID="gorhom-bottom-sheet">{children}</View>
))
const mockBottomSheetView = jest.fn(({ children, ...props }: any) =>
  React.createElement(View, { ...props, testID: 'gorhom-bottom-sheet-view' }, children),
)
const mockBottomSheetScrollView = jest.fn(({ children, ...props }: any) =>
  React.createElement(View, { ...props, testID: 'gorhom-bottom-sheet-scroll-view' }, children),
)

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    __esModule: true,
    default: (props: any) => mockBottomSheet(props),
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetView: (props: any) => mockBottomSheetView(props),
    BottomSheetScrollView: (props: any) => mockBottomSheetScrollView(props),
  }
})

describe('MapBottomSheet', () => {
  beforeEach(() => {
    mockBottomSheet.mockClear()
    mockBottomSheetView.mockClear()
    mockBottomSheetScrollView.mockClear()
  })

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

  it('can render static content without wrapping virtualized lists in a scroll view', () => {
    render(
      <MapBottomSheet scrollableContent={false}>
        <View testID="sheet-content" />
      </MapBottomSheet>,
    )

    expect(mockBottomSheetView).toHaveBeenCalled()
    expect(mockBottomSheetScrollView).not.toHaveBeenCalled()
  })
})
