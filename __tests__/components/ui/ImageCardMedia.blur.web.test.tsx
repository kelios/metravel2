/**
 * @jest-environment jsdom
 */

const renderer = require('react-test-renderer')
const { Platform } = require('react-native')
const { default: ImageCardMedia, isIOSSafariUserAgent } = require('@/components/ui/ImageCardMedia')

describe('ImageCardMedia blur background (web)', () => {
  const originalPlatform = Platform.OS
  const originalJestWorkerId = process.env.JEST_WORKER_ID
  const originalUserAgent = window.navigator.userAgent
  const originalMaxTouchPoints = window.navigator.maxTouchPoints

  beforeEach(() => {
    Platform.OS = 'web'
    // ImageCardMedia disables web <img> rendering in Jest by default.
    // For this regression test we need to exercise the real web <img> branch.
    delete process.env.JEST_WORKER_ID
  })

  afterEach(() => {
    Platform.OS = originalPlatform
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    })
    if (originalJestWorkerId) {
      process.env.JEST_WORKER_ID = originalJestWorkerId
    } else {
      delete process.env.JEST_WORKER_ID
    }
  })

  it('shows blur background immediately for lazy web media (before image load)', () => {
    let tree: any
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

  it('recognizes iPhone Safari user agents for the lazy-to-eager fallback', () => {
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        5
      )
    ).toBe(true)

    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        0
      )
    ).toBe(false)
  })

  it('keeps responsive srcSet enabled on iPhone Safari while still forcing eager load', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg"
          width={320}
          height={200}
          blurBackground
          fit="contain"
          loading="lazy"
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.loading).toBe('eager')
    expect(mainImage.props.srcSet).toBeTruthy()
    expect(String(mainImage.props.srcSet)).toContain('160w')
    expect(mainImage.props.sizes).toBe('320px')
  })

  it('keeps the main image visible on first frame for eager critical web media', () => {
    let tree: any
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

  it('preserves a pre-optimized critical web source instead of generating a new srcSet', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/photo.JPG?v=3567&w=400&q=35&fit=contain"
          width={392}
          height={576}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
          preserveOptimizedWebSrc
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.src).toContain('w=400')
    expect(mainImage.props.src).toContain('q=35')
    expect(mainImage.props.srcSet).toBeUndefined()
  })

  it('keeps responsive srcSet for pre-optimized shared-blur cards on iPhone Safari', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/photo.JPG?v=3567&w=320&h=168&q=52&fit=contain"
          width={320}
          height={168}
          blurBackground
          fit="contain"
          loading="lazy"
          priority="low"
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
    expect(mainImage.props.srcSet).toBeTruthy()
    expect(String(mainImage.props.srcSet)).toContain('640w')
  })

  it('keeps the exact pre-optimized shared-blur source on non-Safari browsers by default', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/photo.JPG?v=3567&w=320&h=168&q=52&fit=contain"
          width={320}
          height={168}
          blurBackground
          fit="contain"
          loading="lazy"
          priority="low"
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
    expect(mainImage.props.src).toContain('w=320')
    expect(mainImage.props.srcSet).toBeUndefined()
  })

  it('keeps lazy shared-blur web media hidden until the main image is loaded', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo-ready-card.jpg"
          height={200}
          blurBackground
          fit="contain"
          loading="lazy"
          priority="low"
          allowCriticalWebBlur
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    const blurLayer = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop'] === 'true'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.style?.opacity).toBe(0)
    expect(blurLayer).toBeTruthy()
    expect(blurLayer.props.style?.opacity).toBe(0)

    renderer.act(() => {
      mainImage.props.onLoad()
    })

    const loadedMainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    const loadedBlurLayer = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop'] === 'true'
    })[0]

    expect(loadedMainImage.props.style?.opacity).toBe(1)
    expect(loadedBlurLayer.props.style?.opacity).toBe(0.95)
  })

  it('can keep eager critical web media hidden until load when revealOnLoadOnly is enabled', () => {
    let tree: any
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
      mainImage.props.onLoad({ currentTarget: { style: {} } })
    })

    const loadedMainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(loadedMainImage.props.style?.opacity).toBe(1)
  })

  it('keeps blur background for eager high-priority image when explicitly allowed', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo.jpg"
          height={200}
          width={320}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
          contentAspectRatio={16 / 9}
        />
      )
    })

    const blurLayers = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop'] === 'true'
    })
    const blurBackdropLayers = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop-layer'] === 'true'
    })
    const mainLayers = tree!.root.findAll((node: any) => node?.type === 'img')

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(blurLayers.every((node: any) => node?.props?.['data-blur-backdrop-segment'] === 'true')).toBe(true)
    expect(blurBackdropLayers.length).toBe(blurLayers.length)
    expect(mainLayers.length).toBeGreaterThan(0)
    expect(String(blurBackdropLayers[0].props.style?.filter || '')).toContain('saturate')
    expect(blurLayers[0].type).toBe('div')
    expect(String(blurBackdropLayers[0].props.style?.backgroundImage || '')).toContain('photo.jpg')
    expect(mainLayers[0].props.src).toContain('photo.jpg')
  })

  it('keeps contain-mode web backdrop strongly blurred so side fill does not read like adjacent slides', () => {
    let tree: any
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
          contentAspectRatio={16 / 9}
        />
      )
    })

    const blurLayer = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop-layer'] === 'true'
    })[0]
    const blurSegments = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop-segment'] === 'true'
    })

    expect(blurLayer).toBeTruthy()
    expect(blurSegments.length).toBeGreaterThan(1)
    expect(blurLayer.type).toBe('div')
    expect(String(blurLayer.props.style?.filter || '')).toContain('blur(20px)')
    expect(String(blurLayer.props.style?.transform || '')).toContain('scale(1.08)')
  })

  it('does not apply extra css blur when backdrop source is already server-blurred', () => {
    let tree: any
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
      mainImage.props.onLoad({ currentTarget: { style: {} } })
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

    let firstTree: any
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

    let secondTree: any
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
