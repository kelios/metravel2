import React, { useContext, useLayoutEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { act, render } from '@testing-library/react-native'

import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import MapBottomSheet from '@/components/MapPage/MapBottomSheet'
import { NativeMapSheetFooterContext } from '@/components/MapPage/MapMobile/nativeFiltersPanelAdapter.native'

const mockBottomSheet = jest.fn(({ children, footerComponent: Footer }: any) => (
  <View testID="gorhom-bottom-sheet">{children}{Footer ? <Footer animatedFooterPosition={mockFooterPosition} /> : null}</View>
))
const mockBottomSheetView = jest.fn(({ children, ...props }: any) =>
  React.createElement(View, { ...props, testID: 'gorhom-bottom-sheet-view' }, children),
)
const mockBottomSheetScrollView = jest.fn(({ children, ...props }: any) =>
  React.createElement(View, { ...props, testID: 'gorhom-bottom-sheet-scroll-view' }, children),
)
const mockSheetLayout = { value: { containerHeight: 701, handleHeight: 44, footerHeight: 60 } }
const mockSheetPosition = { value: 210.3 }
const mockFooterPosition = { value: 386.7 }
const mockReactions: Array<{ prepare: () => any; react: (next: any, previous: any) => void }> = []

let mockPrepare: (() => { height: number; position: number }) | undefined
let mockReactToPosition: ((current: any, previous: any) => void) | undefined
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  __esModule: true,
  default: { View: require('react-native').View },
  useAnimatedStyle: (callback: () => unknown) => callback(),
  useSharedValue: (value: unknown) => require('react').useRef({ value }).current,
  useAnimatedReaction: (prepare: any, react: any) => {
    mockReactions.push({ prepare, react })
    const value = prepare()
    if (typeof value === 'object' && 'height' in value) {
      mockPrepare = prepare
      mockReactToPosition = react
    }
  },
  runOnJS: jest.fn((callback: any) => callback),
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
    BottomSheetFooter: ({ children }: any) => React.createElement(View, { testID: 'gorhom-footer' }, children),
    useBottomSheetInternal: () => ({ animatedLayoutState: mockSheetLayout, animatedPosition: mockSheetPosition }),
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
    mockReactions.length = 0
    mockFooterPosition.value = 386.7
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

  it('bounds static content by the active detent and reserves dock/safe-area only in the host', () => {
    const { getByTestId } = render(<MapBottomSheet bottomInset={111} scrollableContent={false}><View /></MapBottomSheet>)
    const props = mockBottomSheet.mock.calls.at(-1)![0]
    expect(props.bottomInset).toBe(111)
    expect(StyleSheet.flatten(getByTestId('map-sheet-active-viewport').props.style).height).toBeCloseTo(446.7)
    // Internal breathing is 40; the hosting 111 and safe-area 34 are not repeated.
    const content = getByTestId('map-sheet-active-viewport').children[0] as any
    expect(content.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingBottom: 40 })]))
  })

  it('keeps animated footer frames on the UI values and updates React only when chrome fit changes', () => {
    const slots: { current: React.ContextType<typeof NativeMapSheetFooterContext> } = { current: null }
    function Publisher() {
      const context = useContext(NativeMapSheetFooterContext)
      slots.current = context
      useLayoutEffect(() => { context?.publishFooter(<View testID="footer-action" />) }, [context])
      return <View />
    }
    render(<MapBottomSheet scrollableContent={false}><Publisher /></MapBottomSheet>)
    slots.current?.measureHeader(52)
    slots.current?.measureFooter(60)
    const footerReaction = mockReactions.findLast(({ prepare }) => {
      const value = prepare()
      return typeof value === 'object' && 'footer' in value
    })!
    const flowReaction = mockReactions.findLast(({ prepare }) => typeof prepare() === 'boolean')!
    const bridge = jest.requireMock('react-native-reanimated').runOnJS as jest.Mock
    bridge.mockClear()
    const renders = mockBottomSheet.mock.calls.length
    act(() => {
      for (const position of [386.7, 350, 300, 200]) {
        mockFooterPosition.value = position
        footerReaction.react(footerReaction.prepare(), null)
        flowReaction.react(flowReaction.prepare(), false)
      }
    })
    expect(bridge).not.toHaveBeenCalled()
    expect(mockBottomSheet.mock.calls.length).toBe(renders)
    act(() => {
      mockFooterPosition.value = 50
      footerReaction.react(footerReaction.prepare(), null)
      flowReaction.react(flowReaction.prepare(), false)
    })
    expect(bridge).toHaveBeenCalledTimes(1)
    expect(mockBottomSheet.mock.calls.length).toBe(renders + 1)
  })
})
