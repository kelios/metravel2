import React from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { fireEvent, render, within } from '@testing-library/react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import BottomSheet from '@/components/ui/BottomSheet'

const originalOS = Platform.OS

const nativeParent = (node: ReactTestInstance): ReactTestInstance | null => {
  let parent = node.parent
  while (parent && typeof parent.type !== 'string') parent = parent.parent
  return parent
}

afterEach(() => { Platform.OS = originalOS })

describe('BottomSheet: independent accessible content (#2434)', () => {
  it('keeps the labelled backdrop outside the panel, so it cannot group child actions', () => {
    Platform.OS = 'ios'
    const onClose = jest.fn()
    const onAction = jest.fn()
    const result = render(
      <BottomSheet visible title="Actions" onClose={onClose}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose" onPress={onAction}>
          <Text>Choose</Text>
        </Pressable>
      </BottomSheet>,
    )
    const backdrop = result.getByTestId('bottom-sheet-backdrop')
    const panel = result.getByTestId('bottom-sheet-panel')
    expect(nativeParent(backdrop) === nativeParent(panel)).toBe(true)
    expect(within(backdrop).queryByLabelText('Choose')).toBeNull()
    expect(panel.props.accessible).not.toBe(true)
    expect(panel.props.onPress).toBeUndefined()
    expect(panel.props.accessibilityLabel).toBeUndefined()
    fireEvent.press(result.getByLabelText('Choose'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.press(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['ios', 'android', 'web'] as const)('%s: keyboard avoidance is opt in on iOS; Android retains Modal resize', (os) => {
    Platform.OS = os
    const result = render(<BottomSheet visible title="Form" onClose={jest.fn()} />)
    expect(result.UNSAFE_queryByType(KeyboardAvoidingView)).toBeNull()
    result.rerender(<BottomSheet visible title="Form" onClose={jest.fn()} keyboardAware panelStyle={{ maxHeight: '85%' }} />)
    const avoidance = result.UNSAFE_queryByType(KeyboardAvoidingView)
    if (os !== 'ios') {
      expect(avoidance).toBeNull()
      if (os === 'web') {
        expect(result.getByTestId('bottom-sheet-root').props.dataSet).toEqual({ cardAction: 'true' })
      } else {
        expect(result.getByTestId('bottom-sheet-touch-boundary')).toBeTruthy()
      }
    } else {
      expect(avoidance?.props.behavior).toBe('padding')
      expect(avoidance?.props.pointerEvents).toBe('box-none')
      expect(within(avoidance!).getByTestId('bottom-sheet-panel')).toBeTruthy()
      expect(within(avoidance!).queryByTestId('bottom-sheet-backdrop')).toBeNull()
      expect(result.getByTestId('bottom-sheet-touch-boundary')).toBeTruthy()
    }
    expect(StyleSheet.flatten(result.getByTestId('bottom-sheet-panel').props.style).maxHeight).toBe('85%')
  })

  it('places modal feedback outside panel and keyboard layout constraints', () => {
    Platform.OS = 'ios'
    const result = render(
      <BottomSheet visible title="Share" onClose={jest.fn()} keyboardAware
        modalContent={<View testID="modal-feedback"><Text>Feedback</Text></View>}>
        <Text>Share body</Text>
      </BottomSheet>,
    )
    const feedback = result.getByTestId('modal-feedback')
    const root = result.getByTestId('bottom-sheet-root')
    expect(within(root).getByTestId('modal-feedback') === feedback).toBe(true)
    expect(within(result.getByTestId('bottom-sheet-panel')).queryByTestId('modal-feedback')).toBeNull()
    expect(within(result.getByTestId('bottom-sheet-keyboard-container')).queryByTestId('modal-feedback')).toBeNull()
  })

  it.each(['ios', 'android', 'web'] as const)('%s: keeps viewport width compensation on web as the window resizes', (os) => {
    Platform.OS = os
    const dimensions = jest.mocked(useWindowDimensions)
    const original = dimensions.getMockImplementation()!
    try {
      dimensions.mockReturnValue({ width: 1280, height: 900, scale: 1, fontScale: 1 })
      const result = render(<BottomSheet visible title="Share" onClose={jest.fn()} />)
      const width = () => StyleSheet.flatten(result.getByTestId('bottom-sheet-root').props.style).width
      expect(width()).toBe(os === 'web' ? 1280 : undefined)
      dimensions.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 })
      result.rerender(<BottomSheet visible title="Share" onClose={jest.fn()} />)
      expect(width()).toBe(os === 'web' ? 1440 : undefined)
      dimensions.mockReturnValue({ width: 0, height: 0, scale: 1, fontScale: 1 })
      result.rerender(<BottomSheet visible title="Share" onClose={jest.fn()} />)
      expect(width()).toBeUndefined()
    } finally {
      dimensions.mockImplementation(original)
    }
  })
})
