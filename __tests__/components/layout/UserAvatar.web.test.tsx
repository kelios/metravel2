/**
 * @jest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'test-renderer'
const { Platform } = require('react-native')
const { default: UserAvatar } = require('@/components/layout/UserAvatar')

describe('UserAvatar (web)', () => {
  const originalPlatform = Platform.OS
  let root: Root | undefined

  beforeEach(() => {
    Platform.OS = 'web'
  })

  afterEach(async () => {
    await act(() => root?.unmount())
    root = undefined
    Platform.OS = originalPlatform
  })

  it('renders a native img element for remote avatar URLs on web', async () => {
    root = createRoot()

    await act(() => {
      root!.render(
        <UserAvatar uri="https://lh3.googleusercontent.com/a/example=s96-c" />
      )
    })

    const images = root.container.queryAll((node) => node.type === 'img')

    expect(images).toHaveLength(1)
    expect(images[0].props.src).toBe('https://lh3.googleusercontent.com/a/example=s96-c')
    expect(images[0].props.referrerPolicy).toBe('no-referrer')
  })
})
