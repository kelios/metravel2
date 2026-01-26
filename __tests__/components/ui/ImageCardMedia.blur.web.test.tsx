/**
 * @jest-environment jsdom
 */

import renderer from 'react-test-renderer'
import { Platform } from 'react-native'
import ImageCardMedia from '@/components/ui/ImageCardMedia'

describe('ImageCardMedia blur background (web)', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('renders a blurred background layer on web when enabled', () => {
    const tree = renderer.create(
      <ImageCardMedia
        src="https://example.com/photo.jpg"
        height={200}
        blurBackground
        fit="contain"
      />,
    )

    const blurLayers = tree.root.findAll((node: any) => {
      if (node?.props?.['aria-hidden'] !== true) return false
      const filter = String(node?.props?.style?.filter || '')
      return filter.includes('blur')
    })

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(String(blurLayers[0].props.style?.filter || '')).toContain('blur')
  })
})
