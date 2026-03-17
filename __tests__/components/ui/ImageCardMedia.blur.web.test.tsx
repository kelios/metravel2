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

  it('shows blur background immediately for lazy web media (before image load)', () => {
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

    // Blur backdrop should be visible immediately to provide a stable visual base
    const blurLayers = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      return node?.props?.['data-blur-backdrop'] === 'true'
    })

    expect(blurLayers.length).toBeGreaterThan(0)

    const mainLayers = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })

    expect(mainLayers.length).toBeGreaterThan(0)
    expect(mainLayers[0].props.style?.maxWidth).toBe('none')
    expect(mainLayers[0].props.style?.maxHeight).toBe('none')
    // Main image starts hidden; blur provides visual base until image loads
    expect(mainLayers[0].props.style?.opacity).toBe(0)
  })

  it('keeps the main image visible on first frame for eager critical web media', () => {
    let tree: renderer.ReactTestRenderer
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo-visible-with-blur.jpg"
          height={200}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.style?.opacity).toBe(1)
  })

  it('can keep eager critical web media hidden until load when revealOnLoadOnly is enabled', () => {
    let tree: renderer.ReactTestRenderer
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo-visible-after-load.jpg"
          height={200}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
          revealOnLoadOnly
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.style?.opacity).toBe(0)

    renderer.act(() => {
      mainImage.props.onLoad()
    })

    const loadedMainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(loadedMainImage.props.style?.opacity).toBe(1)
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

  it('keeps contain-mode web backdrop strongly blurred so side fill does not read like adjacent slides', () => {
    let tree: renderer.ReactTestRenderer
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo-contain-blur.jpg"
          height={200}
          width={320}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
        />
      )
    })

    const blurLayer = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop'] === 'true'
    })[0]

    expect(blurLayer).toBeTruthy()
    expect(blurLayer.type).toBe('div')
    expect(String(blurLayer.props.style?.filter || '')).toContain('blur(20px)')
    expect(String(blurLayer.props.style?.transform || '')).toContain('scale(1.08)')
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

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return typeof node?.props?.onLoad === 'function'
    })[0]

    renderer.act(() => {
      mainImage.props.onLoad()
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
      if (typeof node?.props?.onLoad !== 'function') return false
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
      if (typeof node?.props?.onLoad !== 'function') return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(secondMainImage.props.style?.opacity).toBe(1)
  })
})
