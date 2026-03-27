/**
 * @jest-environment jsdom
 */

const renderer = require('react-test-renderer')
const { Platform } = require('react-native')
const { default: UserAvatar } = require('@/components/layout/UserAvatar')

describe('UserAvatar (web)', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('renders a native img element for remote avatar URLs on web', () => {
    let tree: any

    renderer.act(() => {
      tree = renderer.create(
        <UserAvatar uri="https://lh3.googleusercontent.com/a/example=s96-c" />
      )
    })

    const images = tree.root.findAll((node: any) => node?.type === 'img')

    expect(images).toHaveLength(1)
    expect(images[0].props.src).toBe('https://lh3.googleusercontent.com/a/example=s96-c')
    expect(images[0].props.referrerPolicy).toBe('no-referrer')
  })
})
