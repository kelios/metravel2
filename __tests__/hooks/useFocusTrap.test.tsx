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

  it('renders helper component with enabled/disabled states without errors', () => {
    render(<FocusTrapWithTestId enabled />)
    render(<FocusTrapWithTestId enabled={false} />)
  })

  it('does not activate on non-web platforms', () => {
    const RN = require('react-native')
    RN.Platform.OS = 'ios'

    // Просто убеждаемся, что рендер на не-web платформе не падает
    render(<FocusTrapWithTestId enabled />)
  })
})
