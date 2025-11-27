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

  it('mounts and unmounts focus trap on web without errors', () => {
    const { unmount } = render(<FocusTrapTest />)

    act(() => {})

    act(() => {
      unmount()
    })
  })
})
