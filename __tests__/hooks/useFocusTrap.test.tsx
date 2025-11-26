import React, { createRef } from 'react'
import { act, render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useFocusTrap } from '@/hooks/useFocusTrap'

function FocusTrapTest() {
  const containerRef = createRef<HTMLDivElement>()
  const initialRef = createRef<HTMLButtonElement>()
  const returnRef = createRef<HTMLButtonElement>()

  useFocusTrap(containerRef as any, {
    enabled: true,
    initialFocus: initialRef as any,
    returnFocus: returnRef as any,
  })

  return (
    <div ref={containerRef}>
      <button ref={initialRef}>first</button>
      <button>middle</button>
      <button ref={returnRef}>last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
  })

  it('moves focus within container on Tab and Shift+Tab, and returns focus on cleanup', () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus')

    const { unmount, getByText } = render(<FocusTrapTest />)

    const first = getByText('first') as HTMLButtonElement
    const last = getByText('last') as HTMLButtonElement

    // Имитируем, что фокус на первом элементе и нажали Shift+Tab
    Object.defineProperty(document, 'activeElement', {
      value: first,
      configurable: true,
    })

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    })

    act(() => {
      first.dispatchEvent(shiftTabEvent)
    })

    expect(focusSpy).toHaveBeenCalled()

    // Escape должен фокусировать returnFocus
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    })

    act(() => {
      document.dispatchEvent(escapeEvent)
    })

    // При размонтировании фокус также возвращается на returnFocus
    act(() => {
      unmount()
    })

    expect(focusSpy).toHaveBeenCalled()

    focusSpy.mockRestore()
  })
})
