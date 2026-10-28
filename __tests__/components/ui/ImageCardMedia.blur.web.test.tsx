/**
 * @jest-environment jsdom
 */

jest.resetModules()
jest.doMock('react-native', () => jest.requireActual('react-native-web'))
const { act } = require('react')
const { createRoot } = require('react-dom/client')
type DOMRoot = import('react-dom/client').Root
const hosts = new Map<DOMRoot, HTMLDivElement>()
const mount = (element: import('react').ReactNode): DOMRoot => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  hosts.set(root, host)
  root.render(element)
  return root
}
type Pixels = { complete: boolean; naturalWidth: number; naturalHeight?: number; currentSrc: string; decode?: () => Promise<void> }
let mockPixels: (image: HTMLImageElement) => Pixels
let loadedPixels = new WeakMap<HTMLImageElement, Pixels>()
const reportImageLoad = (image: HTMLImageElement) => {
  loadedPixels.set(image, {
    complete: true, naturalWidth: 800, naturalHeight: 600,
    currentSrc: image.srcset.split(',')[0].trim().split(/\s+/)[0] || image.src,
  })
  image.dispatchEvent(new Event('load'))
}
const initialDecode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode')

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
    loadedPixels = new WeakMap()
    mockPixels = () => ({ complete: false, naturalWidth: 0, naturalHeight: 0, currentSrc: '' })
    for (const property of ['complete', 'naturalWidth', 'naturalHeight', 'currentSrc'] as const) {
      jest.spyOn(HTMLImageElement.prototype, property, 'get').mockImplementation(function (this: HTMLImageElement) {
        return (loadedPixels.get(this) ?? mockPixels(this))[property] ?? 0
      })
    }
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: function (this: HTMLImageElement) {
      return mockPixels(this).decode?.() ?? Promise.resolve()
    } })
    // ImageCardMedia disables web <img> rendering in Jest by default.
    // For this regression test we need to exercise the real web <img> branch.
    delete process.env.JEST_WORKER_ID
  })

  afterEach(async () => {
    for (const [root, host] of hosts) {
      await act(() => root.unmount())
      host.remove()
    }
    hosts.clear()
    jest.restoreAllMocks()
    if (initialDecode) Object.defineProperty(HTMLImageElement.prototype, 'decode', initialDecode)
    else delete (HTMLImageElement.prototype as any).decode
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

  // #1174: в `cover` готовый кадр закрывает плитку целиком, подложка под ним не
  // видна — там плейсхолдер из данных остаётся единственным слоем (контракт #1127).
  // #1174: blurhash-слой на web снимается сразу после раскрытия фото (#1145), поэтому
  // в `contain` он не может быть фоном полей letterbox. Замер прода 2026-07-30
  // `/travels/ourvietnam`: слот 353×453, фото 800×800, 50 px белой полосы сверху и
  // снизу, `[data-blur-backdrop]` в слайде — 0. Подложка обязана пережить раскрытие.
  // Стили <img> внутри blurhash-слоя задаёт expo-image, поэтому обойти внешнее
  // правило `… img{max-width:…}` инлайном (как делают резкий слой и blur-подложка)
  // он не может. Маркер включает критическое правило, которое возвращает слою
  // полную ширину контейнера — без него слой зажимался в 720px и оставлял справа
  // от кадра пустую полосу.
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
      naturalHeight: 0,
      currentSrc: '',
            decode: jest.fn(
        () => new Promise<void>((resolve) => {
          resolveDecode = resolve
        }),
      ),
    }
    mockPixels = () => imageNode
    const onLoad = jest.fn()
    let tree!: DOMRoot

    await act(async () => {
      tree = mount(<WebMainImage
          src="https://metravel.by/travel-image/38/photo.webp?w=640"
          alt="Travel cover"
          width={390}
          height={260}
          fit="cover"
          borderRadius={12}
          loading="eager"
          priority="high"
          loaded={false}
          onLoad={onLoad}
        />)
    })

    imageNode.complete = true
    imageNode.naturalWidth = 640
    imageNode.naturalHeight = 360
    imageNode.currentSrc = 'https://metravel.by/travel-image/38/photo.webp?w=640'
    await act(async () => {
      resolveDecode?.()
      await Promise.resolve()
    })

    // #1177: вторым аргументом идут фактические пропорции кандидата — из них
    // считаются поля letterbox для сегментной подложки.
    expect(onLoad).toHaveBeenCalledWith(imageNode.currentSrc, { width: 640, height: 360 })
    await act(() => tree.unmount())
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
    mockPixels = () => imageNode
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
      onLoad,
    }
    let tree!: DOMRoot

    await act(async () => {
      tree = mount(<WebMainImage {...props} loaded={false} />)
    })
    expect(onLoad).toHaveBeenCalledTimes(1)

    // Родитель принял загрузку...
    await act(async () => {
      tree.render(<WebMainImage {...props} loaded />)
    })
    expect(onLoad).toHaveBeenCalledTimes(1)

    // ...а затем снова закрыл слой (слайд стал активным и включил decode-гейт).
    await act(async () => {
      tree.render(<WebMainImage {...props} loaded={false} />)
    })
    expect(onLoad).toHaveBeenCalledTimes(2)

    await act(() => tree.unmount())
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
      naturalHeight: 0,
      currentSrc: '',
            decode: jest.fn(
        () => new Promise<void>((resolve) => {
          resolveDecode = resolve
        }),
      ),
    }
    mockPixels = () => imageNode
    const onLoad = jest.fn()
    let tree!: DOMRoot

    await act(async () => {
      tree = mount(<WebMainImage
          src="https://metravel.by/gallery/38/photo.webp?w=480"
          alt="Description image"
          width={390}
          height={390}
          fit="contain"
          borderRadius={12}
          loading="lazy"
          priority="normal"
          loaded={false}
          onLoad={onLoad}
        />)
    })

    expect(observe).toHaveBeenCalledWith(hosts.get(tree!)!.querySelector('img'))
    expect(imageNode.decode).not.toHaveBeenCalled()

    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true }])
      await Promise.resolve()
    })
    expect(imageNode.decode).toHaveBeenCalledTimes(1)

    imageNode.complete = true
    imageNode.naturalWidth = 480
    imageNode.naturalHeight = 640
    imageNode.currentSrc = 'https://metravel.by/gallery/38/photo.webp?w=480'
    await act(async () => {
      resolveDecode?.()
      await Promise.resolve()
    })

    // #1177: пропорции приезжают вместе с адресом — по ним строятся поля letterbox.
    expect(onLoad).toHaveBeenCalledWith(imageNode.currentSrc, { width: 480, height: 640 })
    await act(() => tree.unmount())
    expect(disconnect).toHaveBeenCalled()
    ;(window as any).IntersectionObserver = originalIntersectionObserver
  })

  it('keeps responsive srcSet enabled on iPhone Safari while still forcing eager load', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg"
          width={320}
          height={200}
          blurBackground
          fit="contain"
          loading="lazy"
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.getAttribute('loading')).toBe('eager')
    expect(mainImage.getAttribute('srcset')).toBeTruthy()
    expect(String(mainImage.getAttribute('srcset'))).toContain('160w')
    expect(mainImage.sizes).toBe('320px')
  })

  it('keeps no-blur quest catalog covers lazy on iPhone Safari', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://metravel.by/quest-cover/quests/1/main/cover.jpg?w=480&q=60&fit=cover"
          width={420}
          height={287}
          blurBackground={false}
          fit="cover"
          loading="lazy"
          optimizeWeb={false}
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      return node.tagName === 'IMG' && node.getAttribute('aria-hidden') !== 'true'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.getAttribute('loading')).toBe('lazy')
    expect(mainImage.src).toContain('w=480')
  })

  it('uses a full-width sizes fallback for iPhone Safari auto-width cards', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg"
          height={220}
          blurBackground
          fit="contain"
          loading="lazy"
          allowCriticalWebBlur
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.sizes).toBe('(min-width: 768px) 50vw, 100vw')
    // #1170: ступень 1200 есть в контракте прокси и вернулась в клиентскую лестницу,
    // поэтому верхний кандидат — ровно 1200w. Прежнее ожидание (1280w) фиксировало
    // ограничение урезанной лестницы: 1200 округлялось вверх, и браузер тянул более
    // тяжёлый вариант на тот же слот.
    expect(String(mainImage.getAttribute('srcset'))).toContain('1200w')
    expect(String(mainImage.getAttribute('srcset'))).not.toContain('1280w')
  })

  it('maps low-priority web media to fetchPriority=low', async () => {
    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://example.com/near-viewport-card.jpg"
          width={320}
          height={200}
          loading="eager"
          priority="low"
          revealOnLoadOnly
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      return node.tagName === 'IMG' && node.getAttribute('aria-hidden') !== 'true'
    })[0]

    expect(mainImage.getAttribute('fetchpriority')).toBe('low')
  })

  it('keeps the main image visible on first frame for eager critical web media', async () => {
    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://example.com/photo-visible-with-blur.jpg"
          height={200}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.style.opacity).toBe('1')
  })

  it('preserves a pre-optimized critical web source instead of generating a new srcSet', async () => {
    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/photo.JPG?v=3567&w=400&q=35&fit=contain"
          width={392}
          height={576}
          blurBackground
          fit="contain"
          loading="eager"
          priority="high"
          allowCriticalWebBlur
          preserveOptimizedWebSrc
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.src).toContain('w=400')
    expect(mainImage.src).toContain('q=35')
    expect(mainImage.getAttribute('srcset')).toBeNull()
  })

  it('uses caller-provided backend responsive source on web', async () => {
    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
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
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.src).toBe(
      'https://metravel.by/gallery/544/gallery/photo.webp?w=640&q=75&fit=cover',
    )
    expect(mainImage.getAttribute('srcset')).toContain('320w')
    expect(mainImage.getAttribute('srcset')).toContain('640w')
    expect(mainImage.sizes).toBe('(max-width: 768px) 100vw, 320px')
  })

  it('keeps responsive srcSet for pre-optimized shared-blur cards on iPhone Safari', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })

    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/photo.JPG?v=3567&w=320&h=168&q=52&fit=contain"
          width={320}
          height={168}
          blurBackground
          fit="contain"
          loading="lazy"
          priority="low"
          allowCriticalWebBlur
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.getAttribute('srcset')).toBeTruthy()
    expect(String(mainImage.getAttribute('srcset'))).toContain('640w')
    // #1170: ступень 960 вернули в лестницу, дескриптор совпадает с фактически
    // отдаваемым вариантом без округления вверх. Замер прода 2026-07-30 на обложке
    // квеста: w=960 → 10 430 B против w=1280 → 45 978 B (мастер целиком).
    expect(String(mainImage.getAttribute('srcset'))).toContain('960w')
    expect(String(mainImage.getAttribute('srcset'))).not.toContain('1280w')
  })

  it('keeps the exact pre-optimized shared-blur source on non-Safari browsers by default', async () => {
    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src="https://metravel.by/gallery/544/gallery/photo.JPG?v=3567&w=320&h=168&q=52&fit=contain"
          width={320}
          height={168}
          blurBackground
          fit="contain"
          loading="lazy"
          priority="low"
          allowCriticalWebBlur
        />)
    })

    const mainImage = Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(mainImage).toBeTruthy()
    expect(mainImage.src).toContain('w=320')
    expect(mainImage.getAttribute('srcset')).toBeNull()
  })

  // #1111: подложка больше не заказывает собственный серверный вариант с `blur=`.
  // Она переиспользует main-URL (одна сетевая загрузка на картинку), а размытие
  // делает CSS-фильтр. Прежний контракт стоил второго запроса за тем же файлом:
  // замер прода 2026-07-28 — подложка карточки квеста просила `?w=160`, резкий
  // слой `?w=320`, и на путях из #1120 это было 2.5 МБ вместо килобайтов, дважды.
  it('still reports onLoad on a cache-hit mount so the LCP gate releases', async () => {
    // Regression: navigating into a travel whose hero image was already rendered
    // on the previous screen initialises webLoaded=true from the module cache.
    // WebMainImage must still fire onLoad in that case, otherwise the first-image
    // callback (which releases the travel-details skeleton overlay) never runs and
    // the page stays blank behind the skeleton until a 6s safety timeout.
    const src = 'https://example.com/photo-cache-hit.jpg'
    mockPixels = (image) => ({
      complete: true,
      naturalWidth: 640,
      naturalHeight: 360,
      currentSrc: image.srcset.split(',')[0].trim().split(/\s+/)[0] || image.src,
    })

    // First mount + load primes loadedWebImageBaseCache for this base src.
    let firstTree!: DOMRoot
    await act(() => {
      firstTree = mount(<ImageCardMedia src={src} height={200} blurBackground fit="contain" />)
    })
    const firstMainImage = Array.from(hosts.get(firstTree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]
    await act(() => {
      reportImageLoad(firstMainImage)
    })
    await act(() => {
      firstTree!.unmount()
    })

    // Second mount of the same base image: webLoaded inits true (cache hit).
    const onLoad = jest.fn()
    let secondTree!: DOMRoot
    await act(() => {
      secondTree = mount(<ImageCardMedia src={`${src}?w=480&q=60`} height={200} blurBackground fit="contain" onLoad={onLoad} />)
    })

    // onLoad must fire even though no real <img> load event occurs for a cached image.
    expect(onLoad).toHaveBeenCalled()

    await act(() => {
      secondTree!.unmount()
    })
  })

  it('keeps a previously loaded web image visible after remount', async () => {
    const src = 'https://example.com/photo-remount.jpg'

    let firstTree!: DOMRoot
    await act(() => {
      firstTree = mount(<ImageCardMedia
          src={src}
          height={200}
          blurBackground
          fit="contain"
        />)
    })

    const firstMainImage = Array.from(hosts.get(firstTree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    await act(() => {
      reportImageLoad(firstMainImage)
    })

    await act(() => {
      firstTree!.unmount()
    })

    let secondTree!: DOMRoot
    await act(() => {
      secondTree = mount(<ImageCardMedia
          src={`${src}?w=480&q=60`}
          height={200}
          blurBackground
          fit="contain"
        />)
    })

    const secondMainImage = Array.from(hosts.get(secondTree)!.querySelectorAll('img')).filter((node: any) => {
      if (node.tagName !== 'IMG') return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      return String(node.style.objectFit || '') === 'contain'
    })[0]

    expect(secondMainImage.style.opacity).toBe('1')
  })

  // Регрессия галереи на iPhone: сосед грузится ДО того, как становится активным,
  // и только в активном состоянии `Slide` включает decode-гейт (`revealOnLoadOnly`
  // + `allowCriticalWebBlur`). Сброс «загружено» в этот момент гасил уже показанное
  // фото, а `<img>` не повторяет событие `load` для неизменного `src` — слайд
  // оставался блюром навсегда: первый кадр видно, все следующие — только подложка.
  it('keeps an already decoded image visible when the decode gate turns on later', async () => {
    const src = 'https://metravel.by/gallery/544/gallery/slide-gate.JPG?v=91&w=390&q=52&fit=contain'
    let tree!: DOMRoot
    await act(() => {
      tree = mount(<ImageCardMedia
          src={src}
          width={390}
          height={560}
          blurBackground
          fit="contain"
          loading="eager"
          priority="normal"
          preserveOptimizedWebSrc
        />)
    })

    const findMain = () =>
      Array.from(hosts.get(tree)!.querySelectorAll('img')).filter((node: any) => {
        if (node.tagName !== 'IMG') return false
        if (node.getAttribute('aria-hidden') === 'true') return false
        return String(node.style.objectFit || '') === 'contain'
      })[0]

    await act(() => {
      reportImageLoad(findMain())
    })
    expect(findMain().style.opacity).toBe('1')

    // Свайп: слайд стал активным, Slide включает iOS decode-гейт на том же URL.
    await act(() => {
      tree!.render(
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

    expect(findMain().style.opacity).toBe('1')

    await act(() => {
      tree!.unmount()
    })
  })

})
