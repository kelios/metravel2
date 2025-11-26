import { act, render } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/hooks/useKeyboardShortcuts'

function TestComponent({ onSearch }: { onSearch: () => void }) {
  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.SEARCH,
      action: onSearch,
    },
  ])

  return <Text>test</Text>
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Гарантируем web-платформу
    const RN = require('react-native')
    RN.Platform.OS = 'web'
  })

  it('invokes shortcut action and prevents default when combo matches', () => {
    const onSearch = jest.fn()
    const preventDefault = jest.fn()

    render(<TestComponent onSearch={onSearch} />)

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    })
    Object.defineProperty(event, 'preventDefault', {
      value: preventDefault,
    })

    act(() => {
      document.dispatchEvent(event)
    })

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('does not call action when modifiers do not match', () => {
    const onSearch = jest.fn()

    render(<TestComponent onSearch={onSearch} />)

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: false,
    })

    act(() => {
      document.dispatchEvent(event)
    })

    expect(onSearch).not.toHaveBeenCalled()
  })
})
