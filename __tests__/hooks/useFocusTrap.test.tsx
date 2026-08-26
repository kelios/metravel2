import React, { useRef } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Platform } from 'react-native'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const originalPlatform = Platform.OS

function FocusTrapHarness({
  enabled = true,
  externalReturnRef,
  includeFocusableElements = true,
}: {
  enabled?: boolean
  externalReturnRef?: React.RefObject<HTMLElement>
  includeFocusableElements?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialRef = useRef<HTMLButtonElement>(null)
  const internalReturnRef = useRef<HTMLElement>(null)
  const returnRef = externalReturnRef ?? internalReturnRef

  useFocusTrap(containerRef, { enabled, initialFocus: initialRef, returnFocus: returnRef })

  return (
    <div ref={containerRef} data-testid="trap-container">
      {includeFocusableElements ? (
        <>
          <button ref={initialRef} data-testid="initial-btn">Initial</button>
          {!externalReturnRef && <button ref={returnRef as any} data-testid="return-btn">Return</button>}
          <button data-testid="last-btn">Last</button>
        </>
      ) : null}
    </div>
  )
}

function StackedFocusTrapsHarness({
  topEnabled = true,
  topHasFocusable = true,
}: {
  topEnabled?: boolean
  topHasFocusable?: boolean
}) {
  const lowerRef = useRef<HTMLDivElement>(null)
  const lowerInitialRef = useRef<HTMLButtonElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const topInitialRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(lowerRef, { initialFocus: lowerInitialRef })
  useFocusTrap(topRef, {
    enabled: topEnabled,
    initialFocus: topHasFocusable ? topInitialRef : undefined,
  })

  return (
    <>
      <div ref={lowerRef} data-testid="lower-trap">
        <button ref={lowerInitialRef} data-testid="lower-initial">Lower initial</button>
      </div>
      {topEnabled ? (
        <div ref={topRef} data-testid="top-trap">
          {topHasFocusable ? (
            <button ref={topInitialRef} data-testid="top-initial">Top initial</button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

describe('useFocusTrap', () => {
  beforeAll(() => {
    ;(Platform as any).OS = 'web'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('cycles focus with Tab and Shift+Tab and restores focus on cleanup', async () => {
    const returnFocus = { current: { focus: jest.fn() } } as any
    const { getByTestId, unmount } = render(<FocusTrapHarness externalReturnRef={returnFocus} />)

    const container = getByTestId('trap-container')
    const initialButton = getByTestId('initial-btn') as HTMLButtonElement
    const lastButton = getByTestId('last-btn') as HTMLButtonElement

    await waitFor(() => expect(document.activeElement).toBe(initialButton))

    lastButton.focus()
    fireEvent.keyDown(container, { key: 'Tab' })
    expect(document.activeElement).toBe(initialButton)

    fireEvent.keyDown(container, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    unmount()
    await waitFor(() => expect(returnFocus.current.focus).toHaveBeenCalled())
  })

  it('does nothing when disabled', () => {
    const { getByTestId } = render(<FocusTrapHarness enabled={false} />)
    const initialButton = getByTestId('initial-btn') as HTMLButtonElement

    expect(document.activeElement).not.toBe(initialButton)
  })

  it('recovers focus into the trap when another modal moved it outside', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    const { getByTestId, unmount } = render(<FocusTrapHarness />)

    const initialButton = getByTestId('initial-btn') as HTMLButtonElement
    const lastButton = getByTestId('last-btn') as HTMLButtonElement
    await waitFor(() => expect(document.activeElement).toBe(initialButton))

    outsideButton.focus()
    fireEvent.keyDown(outsideButton, { key: 'Tab' })
    expect(document.activeElement).toBe(initialButton)

    outsideButton.focus()
    fireEvent.keyDown(outsideButton, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    unmount()
    outsideButton.remove()
  })

  it('reasserts initial focus on the next frame after a parent modal steals it', () => {
    const queuedFrames: FrameRequestCallback[] = []
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })

    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    const view = render(<FocusTrapHarness />)
    const initialButton = view.getByTestId('initial-btn') as HTMLButtonElement

    expect(document.activeElement).toBe(initialButton)
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    queuedFrames[0]?.(0)

    expect(document.activeElement).toBe(initialButton)

    view.unmount()
    outsideButton.remove()
  })

  it('cancels the queued initial-focus frame on cleanup', () => {
    const cancelFrame = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 42)

    const view = render(<FocusTrapHarness />)
    view.unmount()

    expect(cancelFrame).toHaveBeenCalledWith(42)
  })

  it('does not let a stale lower frame steal focus from a newer top trap', () => {
    const queuedFrames: FrameRequestCallback[] = []
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })

    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    const view = render(<StackedFocusTrapsHarness topEnabled={false} />)

    view.rerender(<StackedFocusTrapsHarness topHasFocusable={false} />)
    outsideButton.focus()

    // This is the lower trap's frame, queued before the upper trap mounted.
    queuedFrames[0]?.(0)

    expect(document.activeElement).toBe(outsideButton)

    view.unmount()
    outsideButton.remove()
  })

  it('prevents Tab from escaping when the trap has no focusable controls', () => {
    const { getByTestId } = render(<FocusTrapHarness includeFocusableElements={false} />)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })

    getByTestId('trap-container').dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('lets only the topmost trap own Tab and restores the lower trap after cleanup', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    const view = render(<StackedFocusTrapsHarness />)
    const topInitial = view.getByTestId('top-initial') as HTMLButtonElement

    await waitFor(() => expect(document.activeElement).toBe(topInitial))
    outsideButton.focus()
    fireEvent.keyDown(outsideButton, { key: 'Tab' })
    expect(document.activeElement).toBe(topInitial)

    view.rerender(<StackedFocusTrapsHarness topEnabled={false} />)
    const lowerInitial = view.getByTestId('lower-initial') as HTMLButtonElement
    await waitFor(() => expect(document.activeElement).toBe(lowerInitial))
    outsideButton.focus()
    fireEvent.keyDown(outsideButton, { key: 'Tab' })
    expect(document.activeElement).toBe(lowerInitial)

    view.unmount()
    outsideButton.remove()
  })
})
