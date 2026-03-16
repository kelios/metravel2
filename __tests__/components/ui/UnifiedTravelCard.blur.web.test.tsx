/**
 * @jest-environment jsdom
 */

import React from 'react'
import renderer from 'react-test-renderer'
import { Platform } from 'react-native'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'

const mockImageCardMedia: jest.Mock<any, any> = jest.fn((props: any) =>
  React.createElement('mock-image-card-media', props)
)
const mockPrefetchImage = jest.fn(() => Promise.resolve())
const mockShimmerOverlay: jest.Mock<any, any> = jest.fn((props: any) =>
  React.createElement('mock-shimmer-overlay', props)
)

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
  prefetchImage: (...args: any[]) => mockPrefetchImage(...args),
}))

jest.mock('@/components/ui/ShimmerOverlay', () => ({
  __esModule: true,
  default: (props: any) => mockShimmerOverlay(props),
  ShimmerOverlay: (props: any) => mockShimmerOverlay(props),
}))

describe('UnifiedTravelCard blur background (web)', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    mockImageCardMedia.mockClear()
    mockPrefetchImage.mockClear()
    mockShimmerOverlay.mockClear()
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('passes blur background and contain fit to ImageCardMedia', () => {
    renderer.act(() => {
      renderer.create(
        <UnifiedTravelCard
          title="Test travel"
          imageUrl="https://example.com/photo.jpg"
          onPress={() => {}}
        />
      )
    })

    expect(mockImageCardMedia.mock.calls.length).toBeGreaterThan(0)
    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props).toBeTruthy()
    expect(props.blurBackground).toBe(true)
    expect(props.fit).toBe('contain')
  })

  it('passes allowCriticalWebBlur through mediaProps', () => {
    renderer.act(() => {
      renderer.create(
        <UnifiedTravelCard
          title="Test travel"
          imageUrl="https://example.com/photo.jpg"
          onPress={() => {}}
          mediaProps={{ allowCriticalWebBlur: true, priority: 'high', loading: 'eager' }}
        />
      )
    })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(props).toBeTruthy()
    expect(props.allowCriticalWebBlur).toBe(true)
  })

  it('does not prefetch cross-origin card images on web', () => {
    renderer.act(() => {
      renderer.create(
        <UnifiedTravelCard
          title="Test travel"
          imageUrl="https://example.com/photo.jpg"
          onPress={() => {}}
        />
      )
    })

    expect(mockPrefetchImage).not.toHaveBeenCalled()
  })

  it('renders shimmer after media so loading placeholder stays above blur background', () => {
    let tree: renderer.ReactTestRenderer

    renderer.act(() => {
      tree = renderer.create(
        <UnifiedTravelCard
          title="Test travel"
          imageUrl="/travel-image/test.jpg"
          onPress={() => {}}
        />
      )
    })

    expect(mockShimmerOverlay).toHaveBeenCalled()

    const renderedNodes = tree!.root.findAll((node: any) => {
      return node?.type === 'mock-image-card-media' || node?.type === 'mock-shimmer-overlay'
    })

    expect(renderedNodes.map((node: any) => node.type)).toEqual([
      'mock-image-card-media',
      'mock-shimmer-overlay',
    ])
  })
})
