import {
  applyWebTooltipAttributes,
  buildWebAccessibilityAttributes,
  default as CardActionPressable,
  stopWebPointerEvent,
} from '@/components/ui/CardActionPressable'
import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'
import { Platform } from 'react-native'

describe('applyWebTooltipAttributes', () => {
  it('writes tooltip attributes to the web node', () => {
    const node = {
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
    }

    applyWebTooltipAttributes(node, 'Открыть в Google Maps')

    expect(node.setAttribute).toHaveBeenCalledWith('title', 'Открыть в Google Maps')
    expect(node.setAttribute).toHaveBeenCalledWith('data-tooltip', 'Открыть в Google Maps')
    expect(node.removeAttribute).not.toHaveBeenCalled()
  })

  it('removes tooltip attributes when tooltip text is empty', () => {
    const node = {
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
    }

    applyWebTooltipAttributes(node, '')

    expect(node.removeAttribute).toHaveBeenCalledWith('title')
    expect(node.removeAttribute).toHaveBeenCalledWith('data-tooltip')
  })
})

describe('buildWebAccessibilityAttributes', () => {
  it('maps checked and disabled state to explicit ARIA attributes', () => {
    expect(
      buildWebAccessibilityAttributes({ checked: true, disabled: false }),
    ).toEqual({
      'aria-checked': 'true',
      'aria-disabled': 'false',
    })
  })

  it('maps selected, expanded and busy state to explicit ARIA attributes', () => {
    expect(
      buildWebAccessibilityAttributes({
        selected: true,
        expanded: false,
        busy: true,
      }),
    ).toEqual({
      'aria-selected': 'true',
      'aria-expanded': 'false',
      'aria-busy': 'true',
    })
  })
})

describe('CardActionPressable', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('stops early web pointer events before activating the action', () => {
    ;(Platform as any).OS = 'web'
    const stopPropagation = jest.fn()
    const nativeStopPropagation = jest.fn()
    const nativeStopImmediatePropagation = jest.fn()

    stopWebPointerEvent({
      stopPropagation,
      nativeEvent: {
        stopPropagation: nativeStopPropagation,
        stopImmediatePropagation: nativeStopImmediatePropagation,
      },
    })

    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(nativeStopPropagation).toHaveBeenCalledTimes(1)
    expect(nativeStopImmediatePropagation).toHaveBeenCalledTimes(1)
  })

  it('supports an explicit web click fallback for Leaflet popup actions', () => {
    ;(Platform as any).OS = 'web'
    const onPress = jest.fn()

    const { getByLabelText } = render(
      <CardActionPressable
        accessibilityLabel="Google Maps"
        enableWebClickFallback
        onPress={onPress}
      >
        <Text>Google</Text>
      </CardActionPressable>
    )

    fireEvent(getByLabelText('Google Maps'), 'click', {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      timeStamp: 42,
    })

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
