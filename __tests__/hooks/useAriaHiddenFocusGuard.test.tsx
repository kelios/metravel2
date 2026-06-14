import React from 'react'
import { render } from '@testing-library/react'
import { Platform } from 'react-native'
import { useAriaHiddenFocusGuard } from '@/hooks/useAriaHiddenFocusGuard'

const originalPlatform = Platform.OS

function Harness() {
  useAriaHiddenFocusGuard()
  return (
    <div>
      <div data-testid="wrapper">
        <button data-testid="inner-btn">Inner</button>
      </div>
      <button data-testid="outside-btn">Outside</button>
    </div>
  )
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('useAriaHiddenFocusGuard', () => {
  beforeAll(() => {
    ;(Platform as any).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('blurs the focused element when an ancestor gains aria-hidden (the race)', async () => {
    const { getByTestId } = render(<Harness />)
    const wrapper = getByTestId('wrapper')
    const innerBtn = getByTestId('inner-btn') as HTMLButtonElement

    innerBtn.focus()
    expect(document.activeElement).toBe(innerBtn)

    // Ancestor becomes hidden while the button still holds focus.
    wrapper.setAttribute('aria-hidden', 'true')
    await flush() // MutationObserver fires asynchronously

    expect(document.activeElement).not.toBe(innerBtn)
  })

  it('blurs focus moving into an already-hidden subtree', async () => {
    const { getByTestId } = render(<Harness />)
    const wrapper = getByTestId('wrapper')
    const innerBtn = getByTestId('inner-btn') as HTMLButtonElement

    wrapper.setAttribute('aria-hidden', 'true')
    innerBtn.focus() // focusin handler defers the blur to a microtask
    await flush()

    expect(document.activeElement).not.toBe(innerBtn)
  })

  it('does not touch focus on elements that are not hidden', () => {
    const { getByTestId } = render(<Harness />)
    const outsideBtn = getByTestId('outside-btn') as HTMLButtonElement

    outsideBtn.focus()
    expect(document.activeElement).toBe(outsideBtn)
  })

  it('is a no-op on native', () => {
    ;(Platform as any).OS = 'ios'
    const { getByTestId } = render(<Harness />)
    const wrapper = getByTestId('wrapper')
    const innerBtn = getByTestId('inner-btn') as HTMLButtonElement

    innerBtn.focus()
    wrapper.setAttribute('aria-hidden', 'true')

    expect(document.activeElement).toBe(innerBtn)
    ;(Platform as any).OS = 'web'
  })
})
