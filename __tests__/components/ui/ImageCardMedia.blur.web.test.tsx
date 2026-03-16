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

  it('renders blur background hidden initially, main image on web', () => {
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
      if (node?.type !== 'img') return false
      return node?.props?.['data-blur-backdrop'] === 'true'
    })

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(typeof blurLayers[0].props.style?.opacity).toBe('number')
    expect(blurLayers[0].props.style?.objectFit).toBe('cover')
    expect(blurLayers[0].props.style?.minWidth).toBe('100%')
    expect(blurLayers[0].props.style?.maxWidth).toBe('none')
    expect(String(blurLayers[0].props.src || '')).toContain('photo.jpg')

    const mainLayers = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })

    expect(mainLayers.length).toBeGreaterThan(0)
    expect(mainLayers[0].props.style?.maxWidth).toBe('none')
    expect(mainLayers[0].props.style?.maxHeight).toBe('none')
  })

  it('keeps blur background for eager high-priority image when explicitly allowed', () => {
    let tree: renderer.ReactTestRenderer
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo.jpg"
          height={200}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
        />
      )
    })

    const blurLayers = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop'] === 'true'
    })
    const mainLayers = tree!.root.findAll((node: any) => node?.type === 'img')

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(mainLayers.length).toBeGreaterThan(0)
    expect(String(blurLayers[0].props.style?.filter || '')).toContain('saturate')
    expect(blurLayers[0].type).toBe('div')
    expect(String(blurLayers[0].props.style?.backgroundImage || '')).toContain('photo.jpg')
    expect(mainLayers[0].props.src).toContain('photo.jpg')
  })

  it('does not apply extra css blur when backdrop source is already server-blurred', () => {
    let tree: renderer.ReactTestRenderer
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/travel-image/photo.jpg"
          height={200}
          width={320}
          blurBackground
          fit="contain"
        />
      )
    })

    const blurLayers = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      return node?.props?.['data-blur-backdrop'] === 'true'
    })

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(String(blurLayers[0].props.src || '')).toContain('blur=')
    expect(blurLayers[0].props.style?.filter).toBe('saturate(1.08)')
  })

  it('keeps a previously loaded web image visible after remount', () => {
    const src = 'https://example.com/photo-remount.jpg'

    let firstTree: renderer.ReactTestRenderer
    renderer.act(() => {
      firstTree = renderer.create(
        <ImageCardMedia
          src={src}
          height={200}
          blurBackground
          fit="contain"
        />
      )
    })

    const firstMainImage = firstTree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    renderer.act(() => {
      firstMainImage.props.onLoad()
    })

    renderer.act(() => {
      firstTree!.unmount()
    })

    let secondTree: renderer.ReactTestRenderer
    renderer.act(() => {
      secondTree = renderer.create(
        <ImageCardMedia
          src={`${src}?w=480&q=60`}
          height={200}
          blurBackground
          fit="contain"
        />
      )
    })

    const secondMainImage = secondTree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(secondMainImage.props.style?.opacity).toBe(1)
  })
})
