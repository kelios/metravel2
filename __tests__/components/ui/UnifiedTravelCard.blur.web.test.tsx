/**
 * @jest-environment jsdom
 */

import React from 'react'
import renderer from 'react-test-renderer'
import { Platform } from 'react-native'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'

const mockImageCardMedia: jest.Mock<any, any> = jest.fn(() => null)

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
  prefetchImage: jest.fn(),
}))

describe('UnifiedTravelCard blur background (web)', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    mockImageCardMedia.mockClear()
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('passes blur background and contain fit to ImageCardMedia', () => {
    renderer.create(
      <UnifiedTravelCard
        title="Test travel"
        imageUrl="https://example.com/photo.jpg"
        onPress={() => {}}
      />,
    )

    expect(mockImageCardMedia.mock.calls.length).toBeGreaterThan(0)
    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props).toBeTruthy()
    expect(props.blurBackground).toBe(true)
    expect(props.fit).toBe('contain')
  })
})
