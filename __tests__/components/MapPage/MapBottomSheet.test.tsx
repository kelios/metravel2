import React from 'react'
import { Platform, View } from 'react-native'
import { act, render } from '@testing-library/react-native'

import { useBottomSheetStore } from '@/stores/bottomSheetStore'
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

let mockPrepare: (() => { height: number; position: number }) | undefined
let mockReactToPosition: ((current: any, previous: any) => void) | undefined
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useSharedValue: (value: unknown) => require('react').useRef({ value }).current,
  useAnimatedReaction: (prepare: any, react: any) => { mockPrepare = prepare; mockReactToPosition = react },
  runOnJS: (callback: any) => callback,
}))

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
  it('publishes actual container-minus-position, ignores unknown geometry, and clears on close/unmount', () => {
    const view = render(<MapBottomSheet bottomInset={34}><View /></MapBottomSheet>)
    const props = mockBottomSheet.mock.calls.at(-1)![0]
    act(() => mockReactToPosition!(mockPrepare!(), null))
    expect(useBottomSheetStore.getState().heightPx).toBe(117)
    props.containerLayoutState.value = { height: 810, offset: { top: 0, bottom: 34, left: 0, right: 0 } }
    props.animatedPosition.value = 220
    act(() => mockReactToPosition!(mockPrepare!(), null))
    expect(useBottomSheetStore.getState().heightPx).toBe(590)
    props.animatedPosition.value = 530
    act(() => mockReactToPosition!(mockPrepare!(), { height: 810, position: 220 }))
    expect(useBottomSheetStore.getState().heightPx).toBe(280)
    act(() => props.onChange(-1))
    expect(useBottomSheetStore.getState().heightPx).toBe(0)
    useBottomSheetStore.getState().setHeightPx(590)
    view.unmount()
    expect(useBottomSheetStore.getState().heightPx).toBe(0)
  })
  beforeEach(() => {
    useBottomSheetStore.setState({ heightPx: 117 })
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

  it('keeps content scrolling from changing the sheet height', () => {
    render(
      <MapBottomSheet>
        <View testID="sheet-content" />
      </MapBottomSheet>,
    )

    expect(mockBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        enableContentPanningGesture: false,
        enableOverDrag: false,
      }),
    )
  })

  it('exposes nested controls to iOS accessibility instead of grouping the sheet', () => {
    render(
      <MapBottomSheet>
        <View testID="sheet-content" />
      </MapBottomSheet>,
    )

    expect(mockBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({ accessible: false }),
    )
  })

  it('can render static content without wrapping virtualized lists in a scroll view', () => {
    const { getByTestId } = render(
      <MapBottomSheet scrollableContent={false}>
        <View testID="sheet-content" />
      </MapBottomSheet>,
    )

    expect(getByTestId('sheet-content')).toBeTruthy()
    expect(mockBottomSheetScrollView).not.toHaveBeenCalled()
    // Регрессия Android: BottomSheetView меряет детей и растёт под контент
    // (layout h == content h) — вложенный BottomSheetFlatList не скроллится.
    // Статичная ветка должна рендерить плоский View с flex:1.
    expect(mockBottomSheetView).not.toHaveBeenCalled()
  })
})
