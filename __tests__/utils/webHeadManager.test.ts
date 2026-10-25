/**
 * @jest-environment jsdom
 */

/**
 * #2756: у каждого SEO-ключа в живом DOM один узел со значением текущей
 * страницы — после прямого захода, SPA-перехода A→B→A и перехода со страницы,
 * чей SEO смонтировался поздно.
 */
import { siteDefaultRobots } from '@/utils/seo'
import { applyHeadTags, captureExportHead, releaseHeadTags, resetHeadManagerForTests, type HeadTag } from '@/utils/webHeadManager'

const STATIC_TERMS = [
  '<title>Пользовательское соглашение MeTravel</title>',
  '<meta name="description" content="Terms description">',
  '<meta name="robots" content="index,follow">',
  '<link rel="canonical" href="https://metravel.by/terms">',
  '<meta property="og:title" content="Metravel">',
  '<meta property="og:url" content="https://metravel.by/terms">',
  '<meta property="og:image" content="https://metravel.by/og/terms.jpg">',
  '<meta property="og:locale" content="ru_RU">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="https://metravel.by/og/terms.jpg">',
  '<meta name="viewport" content="width=device-width">',
].join('')

const page = (name: string, extra: HeadTag[] = []): HeadTag[] => [
  { kind: 'title', content: `${name} | Metravel` },
  { kind: 'meta', attr: 'name', key: 'description', content: `${name} description` },
  { kind: 'link', rel: 'canonical', href: `https://metravel.by/${name}` },
  { kind: 'meta', attr: 'property', key: 'og:title', content: `${name} | Metravel` },
  { kind: 'meta', attr: 'property', key: 'og:url', content: `https://metravel.by/${name}` },
  { kind: 'meta', attr: 'property', key: 'og:locale', content: 'ru_RU' },
  { kind: 'meta', attr: 'name', key: 'twitter:card', content: 'summary' },
  ...extra,
]

const count = (selector: string) => document.head.querySelectorAll(selector).length
const content = (selector: string) => document.head.querySelector(selector)?.getAttribute('content')

const SEO_SELECTORS = [
  'title',
  'meta[name="description"]',
  'link[rel="canonical"]',
  'meta[property="og:title"]',
  'meta[property="og:url"]',
  'meta[property="og:locale"]',
  'meta[name="twitter:card"]',
]

const expectSingleHead = () => {
  for (const selector of SEO_SELECTORS) expect(count(selector)).toBe(1)
}

describe('webHeadManager (#2756)', () => {
  beforeEach(() => {
    resetHeadManagerForTests()
    window.history.replaceState(null, '', '/terms')
    document.head.innerHTML = STATIC_TERMS
  })

  it('прямой заход: пишет значения в узлы экспорта, без копий; необъявленный robots экспорта живёт', () => {
    const owner = Symbol('terms')
    applyHeadTags(owner, page('terms'))

    expectSingleHead()
    expect(document.title).toBe('terms | Metravel')
    expect(content('meta[property="og:title"]')).toBe('terms | Metravel')
    // #1929/#1930: build-owned robots без объявления страницей переживает гидрацию.
    expect(content('meta[name="robots"]')).toBe('index,follow')
    expect(count('meta[name="viewport"]')).toBe(1)
  })

  it('SPA-переход A→B→A: по одному тегу, значения текущей страницы, теги экспорта A не утекают', () => {
    const terms = Symbol('terms')
    const quests = Symbol('quests')
    applyHeadTags(terms, page('terms'))

    window.history.pushState(null, '', '/quests')
    applyHeadTags(quests, page('quests'))
    releaseHeadTags(terms)

    expectSingleHead()
    expect(content('meta[name="description"]')).toBe('quests description')
    expect(content('meta[property="og:url"]')).toBe('https://metravel.by/quests')
    // og:image / twitter:image объявляла только страница экспорта.
    expect(count('meta[property="og:image"]')).toBe(0)
    expect(count('meta[name="twitter:image"]')).toBe(0)
    // robots экспорта /terms снят, на его месте robots документа.
    expect(count('meta[name="robots"]')).toBe(1)
    expect(content('meta[name="robots"]')).toBe(siteDefaultRobots())
    expect(count('meta[name="viewport"]')).toBe(1)

    window.history.pushState(null, '', '/terms')
    releaseHeadTags(quests)
    applyHeadTags(terms, page('terms'))

    expectSingleHead()
    expect(content('meta[name="description"]')).toBe('terms description')
  })

  it('страница, чей SEO смонтировался поздно, после перехода не оставляет копий', () => {
    // Экспорт и helmet-копия рядом — состояние до #2756.
    document.head.insertAdjacentHTML('beforeend', '<meta data-rh="true" name="description" content="stale helmet">')
    window.history.pushState(null, '', '/quests')
    applyHeadTags(Symbol('quests'), page('quests'))

    expectSingleHead()
    expect(content('meta[name="description"]')).toBe('quests description')
    expect(content('meta[property="og:title"]')).toBe('quests | Metravel')
  })

  it('перенятый узел с меткой helmet теряет её: фиксация helmet (только JSON-LD) его не снимет', () => {
    // Патчер квеста/статьи создаёт недостающий тег с data-rh; helmet при следующей
    // фиксации удаляет все meta[data-rh]/link[data-rh], которых нет в его списке.
    document.head.querySelector('link[rel="canonical"]')?.remove()
    document.head.insertAdjacentHTML('beforeend', '<link data-rh="true" rel="canonical" href="https://metravel.by/patched">')
    applyHeadTags(Symbol('terms'), page('terms'))

    document.head.querySelectorAll('meta[data-rh], link[data-rh]').forEach((node) => node.remove())
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/terms')
    expectSingleHead()
  })

  it('уход владельца из фокуса не опустошает head; поздний release прежнего владельца не трогает нового', () => {
    const terms = Symbol('terms')
    applyHeadTags(terms, page('terms'))
    releaseHeadTags(terms)
    expect(content('meta[name="description"]')).toBe('terms description')

    const quests = Symbol('quests')
    window.history.pushState(null, '', '/quests')
    applyHeadTags(quests, page('quests'))
    releaseHeadTags(terms)
    applyHeadTags(quests, page('quests'))
    expectSingleHead()
    expect(content('meta[name="description"]')).toBe('quests description')
  })

  it('стартовая страница без SEO: снимок при загрузке, теги экспорта снимает первая страница с другим путём', () => {
    captureExportHead()
    window.history.pushState(null, '', '/quests')
    applyHeadTags(Symbol('quests'), page('quests'))

    expectSingleHead()
    expect(count('meta[property="og:image"]')).toBe(0)
    // robots экспорта /terms снят, на его месте robots документа.
    expect(count('meta[name="robots"]')).toBe(1)
    expect(content('meta[name="robots"]')).toBe(siteDefaultRobots())
  })

  it('эффект новой страницы раньше записи history: теги экспорта снимаются после текущей задачи', () => {
    jest.useFakeTimers()
    try {
      captureExportHead()
      // Путь ещё старый: запись идёт как на первом URL.
      applyHeadTags(Symbol('quests'), page('quests'))
      expect(count('meta[property="og:image"]')).toBe(1)

      window.history.pushState(null, '', '/quests')
      jest.runOnlyPendingTimers()

      expectSingleHead()
      expect(count('meta[property="og:image"]')).toBe(0)
      expect(count('meta[name="twitter:image"]')).toBe(0)
      expect(content('meta[name="description"]')).toBe('quests description')
    } finally {
      jest.useRealTimers()
    }
  })

  it('после noindex-страницы страница без robots получает robots документа, а не noindex', () => {
    window.history.pushState(null, '', '/cookies')
    applyHeadTags(Symbol('cookies'), page('cookies', [{ kind: 'meta', attr: 'name', key: 'robots', content: 'noindex, nofollow' }]))
    expect(content('meta[name="robots"]')).toBe('noindex, nofollow')

    window.history.pushState(null, '', '/quests')
    applyHeadTags(Symbol('quests'), page('quests'))
    expect(count('meta[name="robots"]')).toBe(1)
    expect(content('meta[name="robots"]')).toBe(siteDefaultRobots())
  })

  it('ключ, который новая страница не объявляет, снимается', () => {
    const a = Symbol('a')
    applyHeadTags(a, page('a', [{ kind: 'meta', attr: 'property', key: 'og:image:width', content: '1200' }]))
    expect(count('meta[property="og:image:width"]')).toBe(1)

    applyHeadTags(Symbol('b'), page('b'))
    expect(count('meta[property="og:image:width"]')).toBe(0)
  })
})
