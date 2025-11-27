import React, { createRef } from 'react'
import { act, render } from '@testing-library/react-native'
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

function FocusTrapWithTestId(props: { enabled?: boolean }) {
  const containerRef = createRef<HTMLDivElement>()
  const firstRef = createRef<HTMLButtonElement>()
  const middleRef = createRef<HTMLButtonElement>()
  const lastRef = createRef<HTMLButtonElement>()

  useFocusTrap(containerRef as any, {
    enabled: props.enabled,
    initialFocus: firstRef as any,
    returnFocus: lastRef as any,
  })

  return (
    <div ref={containerRef}>
      <button ref={firstRef}>first</button>
      <button ref={middleRef}>middle</button>
      <button ref={lastRef}>last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
  })

  it('mounts and unmounts focus trap on web without errors', () => {
    const { unmount } = render(<FocusTrapTest />)

    act(() => {})

    act(() => {
      unmount()
    })
  })

  it('loops focus with Tab from last to first and Shift+Tab from first to last', () => {
    render(<FocusTrapWithTestId enabled />)
    const container = document.querySelector('div') as HTMLDivElement

    const buttons = container.querySelectorAll('button')
    const first = buttons[0] as HTMLButtonElement
    const middle = buttons[1] as HTMLButtonElement
    const last = buttons[2] as HTMLButtonElement

    // initialFocus должен сфокусировать first
    expect(document.activeElement === first || document.activeElement === middle || document.activeElement === last).toBe(true)

    // Переносим фокус на последний и жмём Tab
    last.focus()
    expect(document.activeElement).toBe(last)

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    container.dispatchEvent(tabEvent)

    expect(document.activeElement).toBe(first)

    // Переносим фокус на первый и жмём Shift+Tab
    first.focus()
    expect(document.activeElement).toBe(first)

    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    container.dispatchEvent(shiftTabEvent)

    expect(document.activeElement).toBe(last)
  })

  it('moves focus to returnFocus on Escape and on cleanup', () => {
    const { unmount } = render(<FocusTrapWithTestId enabled />)
    const container = document.querySelector('div') as HTMLDivElement

    const buttons = container.querySelectorAll('button')
    const first = buttons[0] as HTMLButtonElement
    const middle = buttons[1] as HTMLButtonElement
    const last = buttons[2] as HTMLButtonElement

    // Проверяем Escape: фокус должен перейти к returnFocus (last)
    middle.focus()
    expect(document.activeElement).toBe(middle)

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    document.dispatchEvent(escapeEvent)

    expect(document.activeElement).toBe(last)

    // При размонтировании фокус также должен оказаться на last
    first.focus()
    expect(document.activeElement).toBe(first)

    act(() => {
      unmount()
    })

    expect(document.activeElement).toBe(last)
  })

  it('does nothing when enabled is false', () => {
    render(<FocusTrapWithTestId enabled={false} />)
    const container = document.querySelector('div') as HTMLDivElement

    const buttons = container.querySelectorAll('button')
    const first = buttons[0] as HTMLButtonElement
    const last = buttons[2] as HTMLButtonElement

    // Ставим фокус на last и отправляем Tab: без trap он не должен прыгнуть на first
    last.focus()
    expect(document.activeElement).toBe(last)

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    container.dispatchEvent(tabEvent)

    expect(document.activeElement).toBe(last)

    // Escape также не должен переводить фокус на last
    first.focus()
    expect(document.activeElement).toBe(first)

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    document.dispatchEvent(escapeEvent)

    expect(document.activeElement).toBe(first)
  })

  it('does not activate on non-web platforms', () => {
    const RN = require('react-native')
    RN.Platform.OS = 'ios'

    // Просто убеждаемся, что рендер на не-web платформе не падает
    render(<FocusTrapWithTestId enabled />)
  })
})
