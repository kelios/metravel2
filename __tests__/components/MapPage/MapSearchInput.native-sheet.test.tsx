import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import { useState } from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
import MapBottomSheet from '@/components/MapPage/MapBottomSheet'
import MapSearchInput from '@/components/MapPage/MapSearchInput'

const mockKeyboardState = {
  value: { target: undefined as number | undefined },
  get() { return this.value },
  set(update: (state: typeof this.value) => typeof this.value) { this.value = update(this.value) },
}
const mockInputNodes = { current: new Set<number>() }

// Only the animated host is substituted. The input, its internal-context hook,
// ref forwarding and focus/blur handlers are the installed Gorhom implementation.
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = require('react-native')
  const { BottomSheetInternalProvider } = jest.requireActual('@gorhom/bottom-sheet/src/contexts/internal')
  const { useBottomSheetInternal } = jest.requireActual('@gorhom/bottom-sheet/src/hooks/useBottomSheetInternal')
  const BottomSheetTextInput = jest.requireActual('@gorhom/bottom-sheet/src/components/bottomSheetTextInput').default
  return {
    __esModule: true,
    default: ({ children }: any) => <BottomSheetInternalProvider value={{
      animatedKeyboardState: mockKeyboardState,
      textInputNodesRef: mockInputNodes,
      animatedLayoutState: { value: { containerHeight: 701, handleHeight: 44, footerHeight: 60 } },
      animatedPosition: { value: 210 },
    }}>{children}</BottomSheetInternalProvider>,
    BottomSheetTextInput,
    useBottomSheetInternal,
    BottomSheetScrollView: View,
    BottomSheetFooter: View,
    BottomSheetBackdrop: View,
  }
})

function Search() {
  const [value, onChange] = useState('')
  return <MapSearchInput value={value} onChange={onChange} accessibilityLabel="Place search" accessibilityHint="Enter a place" />
}

describe('map search keyboard integration', () => {
  const originalPlatform = Platform.OS
  beforeEach(() => {
    mockKeyboardState.value = { target: undefined }
    mockInputNodes.current.clear()
  })
  afterEach(() => { Platform.OS = originalPlatform })

  it.each(['ios', 'android'] as const)('registers real input focus and blur with its %s sheet while retaining search text', async (platform) => {
    Platform.OS = platform
    const screen = await render(<MapBottomSheet><Search /></MapBottomSheet>)
    const input = screen.getByTestId('map-search-input')
    const wrapper = getOnlyHost(screen.container, node =>
      typeof node.props.onPressIn === 'function' && node.queryAll(child => child === input).length === 1,
    )
    const idleBorder = StyleSheet.flatten(wrapper.props.style).borderColor
    expect(idleBorder).toEqual(expect.any(String))
    expect(input.props.accessibilityLabel).toBe('Place search')
    expect(input.props.accessibilityHint).toBe('Enter a place')

    await fireEvent(input, 'focus', { nativeEvent: { target: 2312 } })
    expect(mockKeyboardState.value.target).toBe(2312)
    await fireEvent.changeText(input, 'Minsk')
    expect(screen.getByTestId('map-search-input')).toBe(input)
    expect(input.props.value).toBe('Minsk')
    // The app focus callback must still run after Gorhom records the target.
    expect(StyleSheet.flatten(wrapper.props.style).borderColor).not.toBe(idleBorder)

    await fireEvent(input, 'blur', { nativeEvent: { target: 2312 } })
    expect(mockKeyboardState.value.target).toBeUndefined()
    expect(StyleSheet.flatten(wrapper.props.style).borderColor).toBe(idleBorder)
    expect(input.props.value).toBe('Minsk')
    await fireEvent(input, 'focus', { nativeEvent: { target: 2312 } })
    expect(mockKeyboardState.value.target).toBe(2312)
    expect(input.props.value).toBe('Minsk')
  })

  it.each(['web', 'ios', 'android'] as const)('uses ordinary RN input outside a sheet on %s without a Gorhom provider', async (platform) => {
    Platform.OS = platform
    const screen = await render(<Search />)
    const input = screen.getByTestId('map-search-input')
    await fireEvent(input, 'focus', { nativeEvent: { target: 2312 } })
    await fireEvent.changeText(input, 'Minsk')
    expect(input.props.value).toBe('Minsk')
    expect(mockKeyboardState.value.target).toBeUndefined()
  })
})
