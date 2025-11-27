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

  // Избегаем JSX в .ts файле, чтобы не ломать парсер Babel
  return React.createElement(Text, null, 'test')
}

let lastKeydownHandler: ((e: any) => void) | null = null

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Гарантируем web-платформу
    const RN = require('react-native')
    RN.Platform.OS = 'web'

    // Перехватываем обработчик keydown, который вешает хук
    lastKeydownHandler = null
    // @ts-expect-error - тестовая заглушка
    document.addEventListener = jest.fn((type: string, handler: any) => {
      if (type === 'keydown') {
        lastKeydownHandler = handler
      }
    })
    // @ts-expect-error - тестовая заглушка
    document.removeEventListener = jest.fn()
  })

  it('invokes shortcut action and prevents default when combo matches', () => {
    const onSearch = jest.fn()
    const preventDefault = jest.fn()
    render(React.createElement(TestComponent, { onSearch }))

    const event = new Event('keydown') as any
    event.key = 'k'
    event.ctrlKey = true
    Object.defineProperty(event, 'preventDefault', {
      value: preventDefault,
    })

    act(() => {
      lastKeydownHandler?.(event)
    })

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('does not call action when modifiers do not match', () => {
    const onSearch = jest.fn()
    render(React.createElement(TestComponent, { onSearch }))

    const event = new Event('keydown') as any
    event.key = 'k'
    event.ctrlKey = false

    act(() => {
      lastKeydownHandler?.(event)
    })

    expect(onSearch).not.toHaveBeenCalled()
  })
})
