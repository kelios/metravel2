/**
 * @jest-environment jsdom
 */

import renderer from 'react-test-renderer'
import { Platform } from 'react-native'
import ImageCardMedia from '@/components/ui/ImageCardMedia'

describe('ImageCardMedia blur background (web)', () => {
  const originalPlatform = Platform.OS
  const originalJestWorkerId = process.env.JEST_WORKER_ID

  beforeEach(() => {
    Platform.OS = 'web'
    // ImageCardMedia disables web <img> rendering in Jest by default.
    // For this regression test we need to exercise the real web <img> branch.
    delete process.env.JEST_WORKER_ID
  })

  afterEach(() => {
    Platform.OS = originalPlatform
    if (originalJestWorkerId) {
      process.env.JEST_WORKER_ID = originalJestWorkerId
    } else {
      delete process.env.JEST_WORKER_ID
    }
  })

  it('renders a blurred background layer on web when enabled', () => {
    let tree: renderer.ReactTestRenderer
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo.jpg"
          height={200}
          blurBackground
          fit="contain"
        />
      )
    })

    const blurLayers = tree!.root.findAll((node: any) => {
      if (node?.props?.['aria-hidden'] !== true) return false
      const filter = String(node?.props?.style?.filter || '')
      return filter.includes('blur')
    })

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(String(blurLayers[0].props.style?.filter || '')).toContain('blur')

    const mainLayers = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })

    expect(mainLayers.length).toBeGreaterThan(0)

    expect(blurLayers[0].props.style?.maxWidth).toBe('none')
    expect(blurLayers[0].props.style?.maxHeight).toBe('none')
    expect(mainLayers[0].props.style?.maxWidth).toBe('none')
    expect(mainLayers[0].props.style?.maxHeight).toBe('none')
  })
})
