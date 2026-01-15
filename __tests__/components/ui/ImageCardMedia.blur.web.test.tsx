/**
 * @jest-environment jsdom
 */

import React from 'react'
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

    const blurImgs = tree.root.findAll(
      (node) => node.type === 'img' && node.props['aria-hidden'] === true,
    )

    expect(blurImgs.length).toBeGreaterThan(0)
    expect(String(blurImgs[0].props.style?.filter || '')).toContain('blur')
  })
})
