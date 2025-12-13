import React, { useRef } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { Platform } from 'react-native'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const originalPlatform = Platform.OS

function FocusTrapHarness({ enabled = true }: { enabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialRef = useRef<HTMLButtonElement>(null)
  const returnRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(containerRef, { enabled, initialFocus: initialRef, returnFocus: returnRef })

  return (
    <div ref={containerRef} data-testid="trap-container">
      <button ref={returnRef} data-testid="return-btn">Return</button>
      <button ref={initialRef} data-testid="initial-btn">Initial</button>
      <button data-testid="last-btn">Last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  beforeAll(() => {
    ;(Platform as any).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('cycles focus with Tab and Shift+Tab and restores focus on cleanup', () => {
    const { getByTestId, unmount } = render(<FocusTrapHarness />)

    const container = getByTestId('trap-container')
    const initialButton = getByTestId('initial-btn') as HTMLButtonElement
    const returnButton = getByTestId('return-btn') as HTMLButtonElement
    const lastButton = getByTestId('last-btn') as HTMLButtonElement

    expect(document.activeElement).toBe(initialButton)

    lastButton.focus()
    fireEvent.keyDown(container, { key: 'Tab' })
    expect(document.activeElement).toBe(initialButton)

    fireEvent.keyDown(container, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    unmount()
    expect(document.activeElement).toBe(returnButton)
  })

  it('does nothing when disabled', () => {
    const { getByTestId } = render(<FocusTrapHarness enabled={false} />)
    const initialButton = getByTestId('initial-btn') as HTMLButtonElement

    expect(document.activeElement).not.toBe(initialButton)
  })
})
