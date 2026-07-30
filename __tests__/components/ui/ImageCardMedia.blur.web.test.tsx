/**
 * @jest-environment jsdom
 */

const renderer = require('react-test-renderer')
const { Platform } = require('react-native')
const {
  default: ImageCardMedia,
  isIOSSafariUserAgent,
  isIOSWebKitUserAgent,
} = require('@/components/ui/ImageCardMedia')
const { WebMainImage } = require('@/components/ui/ImageCardMediaWebHelpers')

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

  it('uses a local data placeholder without rendering backdrop/LQIP network URLs', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo.jpg"
          placeholderBlurhash="LEHL6nWB2yk8pyo0adR*.7kCMdnj"
          placeholderSrc="https://example.com/photo-lqip.jpg"
          testID="media"
          height={200}
          blurBackground
          fit="contain"
          revealOnLoadOnly
        />
      )
    })

    expect(tree!.root.findByProps({ testID: 'media-data-placeholder' })).toBeTruthy()
    expect(
      tree!.root.findAll(
        (node: any) => node?.props?.['data-blur-backdrop'] === 'true',
      ),
    ).toHaveLength(0)
    expect(
      tree!.root.findAll(
        (node: any) => String(node?.props?.src || '').includes('photo-lqip.jpg'),
      ),
    ).toHaveLength(0)
    expect(
      tree!.root.findAll(
        (node: any) => node?.props?.source?.blurhash === 'LEHL6nWB2yk8pyo0adR*.7kCMdnj',
      ).length,
    ).toBeGreaterThan(0)
  })

  // Стили <img> внутри blurhash-слоя задаёт expo-image, поэтому обойти внешнее
  // правило `… img{max-width:…}` инлайном (как делают резкий слой и blur-подложка)
  // он не может. Маркер включает критическое правило, которое возвращает слою
  // полную ширину контейнера — без него слой зажимался в 720px и оставлял справа
  // от кадра пустую полосу.
  it('marks the data placeholder so critical CSS cannot clamp its width', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/photo.jpg"
          placeholderBlurhash="LEHL6nWB2yk8pyo0adR*.7kCMdnj"
          testID="media"
          height={200}
          blurBackground
          fit="contain"
        />
      )
    })

    const marked = tree!.root.findAll(
      (node: any) =>
        node?.props?.testID === 'media-data-placeholder' &&
        node?.props?.dataSet?.heroDataPlaceholder === 'true',
    )

    expect(marked.length).toBeGreaterThan(0)
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

  it('recognizes Chrome on iPhone as iOS WebKit without misclassifying desktop Chrome', () => {
    expect(
      isIOSWebKitUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1',
        5,
      ),
    ).toBe(true)

    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1',
        5,
      ),
    ).toBe(false)

    expect(
      isIOSWebKitUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        0,
      ),
    ).toBe(false)
  })

  it('applies the iOS WebKit sharp-reveal path in Chrome on iPhone', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1',
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
          src="https://metravel.by/gallery/38/gallery/photo.JPG?w=400&q=52&fit=contain"
          width={390}
          height={560}
          blurBackground
          fit="contain"
          loading="lazy"
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

    expect(mainImage.props.loading).toBe('eager')
    expect(mainImage.props.style?.opacity).toBe(0)
    expect(String(mainImage.props.srcSet)).toContain('1280w')

    renderer.act(() => mainImage.props.onLoad())
    const loadedMainImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['aria-hidden'] !== true
    })[0]
    expect(loadedMainImage.props.style?.opacity).toBe(1)
  })

  it('reports a decoded eager image when Chromium misses the native load event', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    })

    let resolveDecode: (() => void) | undefined
    const imageNode = {
      complete: false,
      naturalWidth: 0,
      currentSrc: '',
      decode: jest.fn(
        () => new Promise<void>((resolve) => {
          resolveDecode = resolve
        }),
      ),
    }
    const onLoad = jest.fn()
    let tree: any

    await renderer.act(async () => {
      tree = renderer.create(
        <WebMainImage
          src="https://metravel.by/travel-image/38/photo.webp?w=640"
          alt="Travel cover"
          width={390}
          height={260}
          fit="cover"
          borderRadius={12}
          loading="eager"
          priority="high"
          hasBlurBehind
          loaded={false}
          onLoad={onLoad}
        />,
        {
          createNodeMock: (element: any) => (element.type === 'img' ? imageNode : null),
        },
      )
    })

    imageNode.complete = true
    imageNode.naturalWidth = 640
    imageNode.currentSrc = 'https://metravel.by/travel-image/38/photo.webp?w=640'
    await renderer.act(async () => {
      resolveDecode?.()
      await Promise.resolve()
    })

    expect(onLoad).toHaveBeenCalledWith(imageNode.currentSrc)
    renderer.act(() => tree.unmount())
  })

  // Родитель имеет право заново закрыть уже показанное медиа (смена decode-режима,
  // recycle). `<img>` при этом не перезапрашивает неизменный `src` и не выдаёт
  // второе событие `load`, поэтому единственный, кто может подтвердить готовность
  // повторно, — сам слой: `complete && naturalWidth > 0` это факт из DOM.
  it('re-reports load when the parent resets loaded for an already complete image', async () => {
    const src = 'https://metravel.by/gallery/38/slide-recover.webp?w=640'
    const imageNode = {
      complete: true,
      naturalWidth: 640,
      currentSrc: src,
      decode: jest.fn(() => Promise.resolve()),
    }
    const onLoad = jest.fn()
    const props = {
      src,
      alt: 'Slide',
      width: 390,
      height: 560,
      fit: 'contain' as const,
      borderRadius: 12,
      loading: 'eager' as const,
      priority: 'high' as const,
      hasBlurBehind: true,
      onLoad,
    }
    let tree: any

    await renderer.act(async () => {
      tree = renderer.create(<WebMainImage {...props} loaded={false} />, {
        createNodeMock: (element: any) => (element.type === 'img' ? imageNode : null),
      })
    })
    expect(onLoad).toHaveBeenCalledTimes(1)

    // Родитель принял загрузку...
    await renderer.act(async () => {
      tree.update(<WebMainImage {...props} loaded />)
    })
    expect(onLoad).toHaveBeenCalledTimes(1)

    // ...а затем снова закрыл слой (слайд стал активным и включил decode-гейт).
    await renderer.act(async () => {
      tree.update(<WebMainImage {...props} loaded={false} />)
    })
    expect(onLoad).toHaveBeenCalledTimes(2)

    renderer.act(() => tree.unmount())
  })

  it('starts iOS lazy-image recovery only when the image approaches the viewport', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    const observe = jest.fn()
    const disconnect = jest.fn()
    const originalIntersectionObserver = (window as any).IntersectionObserver
    ;(window as any).IntersectionObserver = class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        intersectionCallback = callback
      }
      observe = observe
      disconnect = disconnect
    }

    let resolveDecode: (() => void) | undefined
    const imageNode = {
      complete: false,
      naturalWidth: 0,
      currentSrc: '',
      decode: jest.fn(
        () => new Promise<void>((resolve) => {
          resolveDecode = resolve
        }),
      ),
    }
    const onLoad = jest.fn()
    let tree: any

    await renderer.act(async () => {
      tree = renderer.create(
        <WebMainImage
          src="https://metravel.by/gallery/38/photo.webp?w=480"
          alt="Description image"
          width={390}
          height={390}
          fit="contain"
          borderRadius={12}
          loading="lazy"
          priority="normal"
          hasBlurBehind
          loaded={false}
          onLoad={onLoad}
        />,
        {
          createNodeMock: (element: any) => (element.type === 'img' ? imageNode : null),
        },
      )
    })

    expect(observe).toHaveBeenCalledWith(imageNode)
    expect(imageNode.decode).not.toHaveBeenCalled()

    await renderer.act(async () => {
      intersectionCallback?.([{ isIntersecting: true }])
      await Promise.resolve()
    })
    expect(imageNode.decode).toHaveBeenCalledTimes(1)

    imageNode.complete = true
    imageNode.naturalWidth = 480
    imageNode.currentSrc = 'https://metravel.by/gallery/38/photo.webp?w=480'
    await renderer.act(async () => {
      resolveDecode?.()
      await Promise.resolve()
    })

    expect(onLoad).toHaveBeenCalledWith(imageNode.currentSrc)
    renderer.act(() => tree.unmount())
    expect(disconnect).toHaveBeenCalled()
    ;(window as any).IntersectionObserver = originalIntersectionObserver
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

  it('forces catalog media eager on iPhone Safari so the sharp layer always reveals', () => {
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
          src="https://metravel.by/quest-cover/quests/1/main/cover.jpg?w=480"
          width={420}
          height={260}
          blurBackground
          fit="contain"
          loading="lazy"
          optimizeWeb={false}
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
    expect(mainImage.props.loading).toBe('eager')
    expect(mainImage.props.style?.opacity).toBe(1)
    expect(mainImage.props.src).toContain('w=480')
    expect(mainImage.props.srcSet).toBeUndefined()

    const blurImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['data-blur-backdrop'] === 'true'
    })[0]
    const cssBlurLayer = tree!.root.findAll((node: any) => {
      return node?.type === 'div' && node?.props?.['data-blur-backdrop'] === 'true'
    })[0]

    expect(blurImage).toBeUndefined()
    expect(cssBlurLayer).toBeTruthy()
    expect(String(cssBlurLayer.props.style?.backgroundImage || '')).toContain(mainImage.props.src)
  })

  it('keeps no-blur quest catalog covers lazy on iPhone Safari', () => {
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
          src="https://metravel.by/quest-cover/quests/1/main/cover.jpg?w=480&q=60&fit=cover"
          width={420}
          height={287}
          blurBackground={false}
          fit="cover"
          loading="lazy"
          optimizeWeb={false}
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['aria-hidden'] !== true
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.loading).toBe('lazy')
    expect(mainImage.props.src).toContain('w=480')
  })

  it('uses a full-width sizes fallback for iPhone Safari auto-width cards', () => {
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
          height={220}
          blurBackground
          fit="contain"
          loading="lazy"
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
    expect(mainImage.props.sizes).toBe('(min-width: 768px) 50vw, 100vw')
    // #1113: верхний кандидат снэпится к реальной ступени прокси (1200 → 1280) и
    // капится WEB_SRCSET_MAX_WIDTH — обещать 1200w нельзя, такого варианта нет.
    expect(String(mainImage.props.srcSet)).toContain('1280w')
    expect(String(mainImage.props.srcSet)).not.toContain('1200w')
  })

  it('keeps iPhone Safari shared-blur cards hidden until the main image finishes loading', () => {
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
    expect(mainImage.props.loading).toBe('eager')
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

  it('keeps high-priority shared-blur cards hidden until decode on iPhone Safari', () => {
    // Regression: the "Маршрут недели" featured card is the only card that sets
    // priority="high", which used to bypass the iOS Safari decode-wait and paint
    // a blurry progressive frame. It must now behave like the popular cards.
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
          src="https://example.com/cover_sorapiso.jpg"
          width={358}
          height={220}
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
    // Still requested eagerly with high fetch priority for LCP...
    expect(mainImage.props.loading).toBe('eager')
    expect(mainImage.props.fetchPriority).toBe('high')
    // ...but hidden until the sharp decode lands (no blurry progressive frame).
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

  it('maps low-priority web media to fetchPriority=low', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/near-viewport-card.jpg"
          width={320}
          height={200}
          loading="eager"
          priority="low"
          revealOnLoadOnly
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['aria-hidden'] !== true
    })[0]

    expect(mainImage.props.fetchPriority).toBe('low')
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

  it('uses caller-provided backend responsive source on web', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/original.jpg"
          width={320}
          height={200}
          blurBackground
          fit="contain"
          webResponsiveSource={{
            src: 'https://metravel.by/gallery/544/gallery/photo.webp?w=640&q=75&fit=cover',
            srcSet:
              'https://metravel.by/gallery/544/gallery/photo.webp?w=320&q=72&fit=cover 320w, https://metravel.by/gallery/544/gallery/photo.webp?w=640&q=75&fit=cover 640w',
            sizes: '(max-width: 768px) 100vw, 320px',
          }}
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.src).toBe(
      'https://metravel.by/gallery/544/gallery/photo.webp?w=640&q=75&fit=cover',
    )
    expect(mainImage.props.srcSet).toContain('320w')
    expect(mainImage.props.srcSet).toContain('640w')
    expect(mainImage.props.sizes).toBe('(max-width: 768px) 100vw, 320px')
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
    // #1113: 960 снэпится к 1280 — ступени 960 нет в клиентской лестнице,
    // а дескриптор обязан совпадать с фактически отдаваемым вариантом.
    expect(String(mainImage.props.srcSet)).toContain('1280w')
    expect(String(mainImage.props.srcSet)).not.toContain('960w')
  })

  it('keeps one effective source for shared-blur quest covers when web optimization is disabled', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    const src = 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1'
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src={src}
          width={340}
          height={238}
          blurBackground
          fit="contain"
          loading="lazy"
          priority="normal"
          allowCriticalWebBlur
          optimizeWeb={false}
        />
      )
    })

    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]
    const blurImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['data-blur-backdrop'] === 'true'
    })[0]
    const cssBlurLayer = tree!.root.findAll((node: any) => {
      return node?.type === 'div' && node?.props?.['data-blur-backdrop'] === 'true'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.props.src).toBe(src)
    expect(mainImage.props.srcSet).toBeUndefined()
    expect(blurImage).toBeUndefined()
    expect(cssBlurLayer).toBeTruthy()
    expect(String(cssBlurLayer.props.style?.backgroundImage || '')).toContain(src)
  })

  it('uses an image blur backdrop for quest covers in the mobile Safari reveal-on-load path', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    const src = 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1'
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src={src}
          width={340}
          height={238}
          blurBackground
          fit="contain"
          loading="eager"
          priority="low"
          allowCriticalWebBlur
          revealOnLoadOnly
          optimizeWeb={false}
        />
      )
    })

    const blurImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['data-blur-backdrop'] === 'true'
    })[0]
    const cssBlurLayer = tree!.root.findAll((node: any) => {
      return node?.type === 'div' && node?.props?.['data-blur-backdrop'] === 'true'
    })[0]
    const mainImage = tree!.root.findAll((node: any) => {
      if (node?.type !== 'img') return false
      if (node?.props?.['aria-hidden'] === true) return false
      return String(node?.props?.style?.objectFit || '') === 'contain'
    })[0]

    expect(blurImage).toBeTruthy()
    expect(cssBlurLayer).toBeUndefined()
    expect(blurImage.props.src).toBe(src)
    expect(mainImage.props.src).toBe(src)
    expect(mainImage.props.srcSet).toBeUndefined()
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
    const baseBlurLayers = tree!.root.findAll((node: any) => {
      return node?.props?.['data-blur-backdrop-base'] === 'true'
    })
    const mainLayers = tree!.root.findAll((node: any) => node?.type === 'img')

    expect(blurLayers.length).toBeGreaterThan(0)
    expect(baseBlurLayers.length).toBe(1)
    expect(blurBackdropLayers.every((node: any) => node?.props?.['data-blur-backdrop-segment'] === 'true')).toBe(true)
    expect(blurBackdropLayers.length).toBe(blurLayers.length - baseBlurLayers.length)
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

  // #1111: подложка больше не заказывает собственный серверный вариант с `blur=`.
  // Она переиспользует main-URL (одна сетевая загрузка на картинку), а размытие
  // делает CSS-фильтр. Прежний контракт стоил второго запроса за тем же файлом:
  // замер прода 2026-07-28 — подложка карточки квеста просила `?w=160`, резкий
  // слой `?w=320`, и на путях из #1120 это было 2.5 МБ вместо килобайтов, дважды.
  it('reuses the main image URL for the backdrop instead of a second request', () => {
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
    const backdropSrc = String(blurLayers[0].props.src || '')
    const mainSrc = String(mainImage.props.src || '')

    // Тот же самый ресурс, что и резкий слой — второй адрес не появляется.
    expect(backdropSrc).toBe(mainSrc)
    expect(backdropSrc).not.toContain('blur=')
    // Раз серверного размытия нет, его обязан дать CSS-фильтр.
    expect(String(blurLayers[0].props.style?.filter || '')).toContain('blur(')
  })

  it('still reports onLoad on a cache-hit mount so the LCP gate releases', () => {
    // Regression: navigating into a travel whose hero image was already rendered
    // on the previous screen initialises webLoaded=true from the module cache.
    // WebMainImage must still fire onLoad in that case, otherwise the first-image
    // callback (which releases the travel-details skeleton overlay) never runs and
    // the page stays blank behind the skeleton until a 6s safety timeout.
    const src = 'https://example.com/photo-cache-hit.jpg'

    // First mount + load primes loadedWebImageBaseCache for this base src.
    let firstTree: any
    renderer.act(() => {
      firstTree = renderer.create(
        <ImageCardMedia src={src} height={200} blurBackground fit="contain" />
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

    // Second mount of the same base image: webLoaded inits true (cache hit).
    const onLoad = jest.fn()
    let secondTree: any
    renderer.act(() => {
      secondTree = renderer.create(
        <ImageCardMedia src={`${src}?w=480&q=60`} height={200} blurBackground fit="contain" onLoad={onLoad} />
      )
    })

    // onLoad must fire even though no real <img> load event occurs for a cached image.
    expect(onLoad).toHaveBeenCalled()

    renderer.act(() => {
      secondTree!.unmount()
    })
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

  it('does not let a cached thumbnail bypass an explicit decode gate', () => {
    const src = 'https://example.com/photo-candidate-gate.jpg'
    let thumbnailTree: any
    renderer.act(() => {
      thumbnailTree = renderer.create(
        <ImageCardMedia src={`${src}?w=160&q=70`} height={120} blurBackground fit="contain" />
      )
    })
    const thumbnail = thumbnailTree!.root.findAll((node: any) => {
      return (
        node?.type === 'img' &&
        node?.props?.['aria-hidden'] !== true &&
        node?.props?.['data-blur-backdrop'] !== 'true'
      )
    })[0]
    renderer.act(() => thumbnail.props.onLoad())
    renderer.act(() => thumbnailTree!.unmount())

    let sharpTree: any
    renderer.act(() => {
      sharpTree = renderer.create(
        <ImageCardMedia
          src={`${src}?w=1280&q=80`}
          height={240}
          blurBackground
          fit="contain"
          loading="eager"
          revealOnLoadOnly
        />
      )
    })

    const sharp = sharpTree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['aria-hidden'] !== true
    })[0]
    expect(sharp.props.style?.opacity).toBe(0)
  })

  // Регрессия галереи на iPhone: сосед грузится ДО того, как становится активным,
  // и только в активном состоянии `Slide` включает decode-гейт (`revealOnLoadOnly`
  // + `allowCriticalWebBlur`). Сброс «загружено» в этот момент гасил уже показанное
  // фото, а `<img>` не повторяет событие `load` для неизменного `src` — слайд
  // оставался блюром навсегда: первый кадр видно, все следующие — только подложка.
  it('keeps an already decoded image visible when the decode gate turns on later', () => {
    const src = 'https://metravel.by/gallery/544/gallery/slide-gate.JPG?v=91&w=390&q=52&fit=contain'
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src={src}
          width={390}
          height={560}
          blurBackground
          fit="contain"
          loading="eager"
          priority="normal"
          preserveOptimizedWebSrc
        />
      )
    })

    const findMain = () =>
      tree!.root.findAll((node: any) => {
        if (node?.type !== 'img') return false
        if (node?.props?.['aria-hidden'] === true) return false
        return String(node?.props?.style?.objectFit || '') === 'contain'
      })[0]

    renderer.act(() => {
      findMain().props.onLoad()
    })
    expect(findMain().props.style?.opacity).toBe(1)

    // Свайп: слайд стал активным, Slide включает iOS decode-гейт на том же URL.
    renderer.act(() => {
      tree!.update(
        <ImageCardMedia
          src={src}
          width={390}
          height={560}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          preserveOptimizedWebSrc
          allowCriticalWebBlur
          revealOnLoadOnly
        />
      )
    })

    expect(findMain().props.style?.opacity).toBe(1)

    renderer.act(() => {
      tree!.unmount()
    })
  })

  it('does not paint a recycled card with the previous image loaded state', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://example.com/recycled-a.jpg"
          height={240}
          blurBackground
          fit="contain"
          loading="eager"
          revealOnLoadOnly
        />
      )
    })
    const firstImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['aria-hidden'] !== true
    })[0]
    renderer.act(() => firstImage.props.onLoad())

    renderer.act(() => {
      tree!.update(
        <ImageCardMedia
          src="https://example.com/recycled-b.jpg"
          height={240}
          blurBackground
          fit="contain"
          loading="eager"
          revealOnLoadOnly
        />
      )
    })

    const recycledImage = tree!.root.findAll((node: any) => {
      return node?.type === 'img' && node?.props?.['aria-hidden'] !== true
    })[0]
    expect(recycledImage.props.src).toContain('recycled-b.jpg')
    expect(recycledImage.props.style?.opacity).toBe(0)
  })
})

// #1111: одинакового `src` мало. Резкий слой выбирает кандидата из `srcSet` по
// `sizes`, поэтому подложка без тех же атрибутов грузит другой файл. Замер прода
// 2026-07-28 на карточке квеста: у обоих слоёв src был `?w=160`, но main с
// `sizes: 132px` при DPR 2 брал `?w=320` — один файл в две загрузки.
describe('ImageCardMedia web backdrop shares the srcSet of the sharp layer (#1111)', () => {
  const originalPlatform = Platform.OS
  const originalJestWorkerId = process.env.JEST_WORKER_ID

  beforeEach(() => {
    Platform.OS = 'web'
    delete process.env.JEST_WORKER_ID
  })

  afterEach(() => {
    Platform.OS = originalPlatform
    if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId
  })

  it('gives the backdrop the same srcSet and sizes as the main image', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/quest-cover/quests/44/main/cover.png"
          width={132}
          height={132}
          blurBackground
          fit="contain"
          loading="lazy"
        />
      )
    })

    const backdrop = tree!.root.findAll(
      (n: any) => n?.type === 'img' && n?.props?.['data-blur-backdrop'] === 'true'
    )[0]
    const main = tree!.root.findAll(
      (n: any) =>
        n?.type === 'img' &&
        n?.props?.['data-blur-backdrop'] !== 'true' &&
        n?.props?.['aria-hidden'] !== true
    )[0]

    expect(backdrop).toBeTruthy()
    expect(main).toBeTruthy()
    // Ровно один набор кандидатов на оба слоя — браузер выберет один и тот же файл.
    expect(backdrop.props.src).toBe(main.props.src)
    expect(backdrop.props.srcSet).toBe(main.props.srcSet)
    expect(backdrop.props.sizes).toBe(main.props.sizes)
  })

  it('keeps eager decode-gated catalog cards on one responsive candidate', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          src="https://metravel.by/gallery/1/photo.jpg?w=1280&q=80&fit=contain"
          width={360}
          height={240}
          blurBackground
          fit="contain"
          loading="eager"
          priority="low"
          allowCriticalWebBlur
          revealOnLoadOnly
          webResponsiveSource={{
            src: 'https://metravel.by/gallery/1/photo.jpg?w=1280&q=80&fit=contain',
            srcSet: [
              'https://metravel.by/gallery/1/photo.jpg?w=320&q=70&fit=cover 320w',
              'https://metravel.by/gallery/1/photo.jpg?w=640&q=80&fit=cover 640w',
              'https://metravel.by/gallery/1/photo.jpg?w=1280&q=80&fit=contain 1280w',
            ].join(', '),
            sizes: '360px',
          }}
        />
      )
    })

    const backdrop = tree!.root.findAll(
      (node: any) => node?.type === 'img' && node?.props?.['data-blur-backdrop'] === 'true'
    )[0]
    const cssBackdrop = tree!.root.findAll(
      (node: any) => node?.type === 'div' && node?.props?.['data-blur-backdrop'] === 'true'
    )[0]
    const main = tree!.root.findAll(
      (node: any) =>
        node?.type === 'img' &&
        node?.props?.['data-blur-backdrop'] !== 'true' &&
        node?.props?.['aria-hidden'] !== true
    )[0]

    expect(cssBackdrop).toBeUndefined()
    expect(backdrop.props.src).toBe(main.props.src)
    expect(backdrop.props.srcSet).toBe(main.props.srcSet)
    expect(backdrop.props.sizes).toBe(main.props.sizes)
    expect(main.props.fetchPriority).toBe('low')
    expect(main.props.style?.opacity).toBe(0)
  })
})

// #1111: CSS-фон не выбирает кандидата из srcSet — он грузит ровно URL из url().
// У hero src намеренно не оптимизирован (совпадает с preload-адресом), поэтому фон
// тянул оригинал: замер прода 2026-07-28 — `?v=2051` без ресайза, 121 КБ.
describe('pickNarrowestSrcSetCandidate (#1111)', () => {
  const { pickNarrowestSrcSetCandidate } = require('@/components/ui/ImageCardMediaWebHelpers')

  it('picks the narrowest candidate so the blurred background stays cheap', () => {
    const srcSet = [
      'https://metravel.by/gallery/1/photo.jpg?w=320&q=72 320w',
      'https://metravel.by/gallery/1/photo.jpg?w=720&q=72 720w',
      'https://metravel.by/gallery/1/photo.jpg?w=1280&q=82 1280w',
    ].join(', ')

    expect(pickNarrowestSrcSetCandidate(srcSet)).toBe(
      'https://metravel.by/gallery/1/photo.jpg?w=320&q=72'
    )
  })

  it('falls back to null on empty or malformed input so the caller keeps src', () => {
    expect(pickNarrowestSrcSetCandidate('')).toBeNull()
    expect(pickNarrowestSrcSetCandidate(undefined)).toBeNull()
    expect(pickNarrowestSrcSetCandidate('https://example.com/a.jpg')).toBeNull()
    expect(pickNarrowestSrcSetCandidate('https://example.com/a.jpg 0w')).toBeNull()
  })

  it('ignores descriptor noise and still returns the smallest width', () => {
    const srcSet = 'https://x/b.jpg 640w,   https://x/a.jpg   160w , https://x/c.jpg 1280w'
    expect(pickNarrowestSrcSetCandidate(srcSet)).toBe('https://x/a.jpg')
  })
})
