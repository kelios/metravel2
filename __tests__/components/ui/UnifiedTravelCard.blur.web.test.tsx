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
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
  prefetchImage: (...args: any[]) => (mockPrefetchImage as any)(...args),
}))

describe('UnifiedTravelCard blur background (web)', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    mockImageCardMedia.mockClear()
    mockPrefetchImage.mockClear()
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

  it('delegates loading UI to ImageCardMedia instead of rendering a card-level shimmer overlay', () => {
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

    const renderedNodes = tree!.root.findAll((node: any) => {
      return node?.type === 'mock-image-card-media'
    })

    expect(renderedNodes.map((node: any) => node.type)).toEqual(['mock-image-card-media'])
  })

  it('delegates showImmediately to ImageCardMedia (no card-level image cache)', () => {
    const imageUrl = '/travel-image/already-loaded-card.jpg'

    renderer.act(() => {
      renderer.create(
        <UnifiedTravelCard
          title="Loaded travel"
          imageUrl={imageUrl}
          onPress={() => {}}
        />
      )
    })

    const firstProps = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(firstProps?.showImmediately).toBe(false)

    renderer.act(() => {
      firstProps?.onLoad?.()
    })

    renderer.act(() => {
      renderer.create(
        <UnifiedTravelCard
          title="Loaded travel"
          imageUrl={imageUrl}
          onPress={() => {}}
        />
      )
    })

    // UnifiedTravelCard no longer maintains its own image cache;
    // ImageCardMedia handles cached-image detection internally.
    const secondProps = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(secondProps?.showImmediately).toBe(false)
  })
})
