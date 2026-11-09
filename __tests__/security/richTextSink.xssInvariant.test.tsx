/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://metravel.by/"}
 */

// #3202: инвариант web-стоков rich-text. Враждебная строка проходит РЕАЛЬНЫЙ путь
// до значения, которое уходит в `dangerouslySetInnerHTML`, и браузерный разбор
// (jsdom) этого значения не содержит ни одного исполняемого атрибута, `<script>`
// или `javascript:`-адреса. Преобразователь не мокается.
import type React from 'react'

type SinkProps = { html: string; serverSanitized?: boolean }

let createElement: typeof import('react').createElement
let renderToString: typeof import('react-dom/server').renderToString
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let StableContent: React.ComponentType<SinkProps & { contentWidth: number }>
let SafeHtml: React.ComponentType<SinkProps & { imageAlt?: string }>
let Description: React.ComponentType<{ htmlContent: string; serverSanitized: boolean; noBox: boolean }>
let LoaderProvider: React.Provider<unknown>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
      text: '#111111',
      textMuted: '#666666',
      primary: '#0a84ff',
      focus: '#ff00ff',
      surface: '#ffffff',
      surfaceMuted: '#f7f7f7',
      borderLight: '#e5e7eb',
      backgroundSecondary: '#fafafa',
      mutedBackground: '#f3f4f6',
      boxShadows: { card: 'none', light: 'none' },
    }),
  }))
  jest.doMock('@/components/travel/FullscreenGallery', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/travel/DeferredStableContent', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/travel/TravelDescriptionHtml', () =>
    jest.requireActual('@/components/travel/TravelDescriptionHtml.web'))
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
  ;({ createElement, act } = require('react'))
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ createRoot } = require('react-dom/client'))
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  StableContent = require('@/components/travel/StableContent.web').default
  SafeHtml = require('@/components/article/SafeHtml').SafeHtml
  Description = require('@/components/travel/TravelDescription').default
  LoaderProvider = require('@/components/travel/details/travelLoaderData').TravelLoaderDataContext.Provider
})

const HOSTILE: readonly string[] = [
  // Оба пробоя из карточки.
  '<img alt="x src=" class="a b/onerror=alert(document.domain) c" src="https://x.invalid/a.jpg">',
  '<img class="x src=" alt=" src=x onerror=alert(1) y=">',
  // Ложные `src=`/`style=`/`class=`/`width=`/`srcset=` внутри свободных значений.
  '<p><img title="t src=" id="i/onerror=alert(1) z" src="https://metravel.by/gallery/1.jpg"></p>',
  '<p><img id="q style=" alt="/onerror=alert(1) k" src="https://metravel.by/gallery/2.jpg"></p>',
  '<p><img data-x="w class=" alt="/onload=alert(1) k" src="https://x.invalid/3.jpg"></p>',
  '<p><img alt="a width=" title="/onerror=alert(1) b" width="10" height="20" src="https://x.invalid/4.jpg"></p>',
  '<p><img alt="a srcset=" title="/onerror=alert(1) b" src="https://x.invalid/5.jpg"></p>',
  '<figure class="f src=" title="/onerror=alert(1)"><img src="https://x.invalid/6.jpg"></figure>',
  // `>` внутри значения атрибута у img / figure / p.
  '<img alt="x><img src=x onerror=alert(1)>" src="https://x.invalid/7.jpg">',
  '<figure title="x><img src=x onerror=alert(1)>"><img src="https://x.invalid/8.jpg"></figure>',
  '<p title="x><img src=x onerror=alert(1)>"><img src="https://x.invalid/9.jpg"></p>',
  '<p title="z>1. y"><img src="https://x.invalid/10.jpg"></p>',
  '<h2 title="x>1. Раздел">1. Раздел</h2><a href="#q onmouseover=alert(1) x">к разделу</a>',
  '<div class="img-grid" title="x><img src=q onerror=alert(1)>"><p><img src="https://x.invalid/11.jpg"></p></div>',
  // Одинарные кавычки, значения без кавычек, `/` вместо пробела.
  "<img alt='x src=' class='a/onerror=alert(1) b' src='https://x.invalid/12.jpg'>",
  '<img src=https://x.invalid/13.jpg alt=x/onerror=alert(1)>',
  '<img/src="https://x.invalid/14.jpg"/onerror=alert(1)>',
  '<p/onclick=alert(1)>текст</p>',
  // Враждебные атрибуты у figure, iframe (YouTube), a.
  '<figure onmouseover="alert(1)"><img src="https://x.invalid/15.jpg"></figure>',
  '<iframe src="https://www.youtube.com/embed/abcdefg" onload="alert(1)"></iframe>',
  '<a href="javascript:alert(1)">a</a><a href="  JaVa&#x53;cript:alert(1)">b</a><a href="java&Tab;script:alert(1)">c</a>',
  '<a href="https://metravel.by" onclick="alert(1)">d</a>',
  // Содержимое iframe и комментарии: расхождение парсеров.
  '<iframe src="https://www.youtube.com/embed/x"><a title="</iframe><img src=x onerror=alert(1)>"></a></iframe>',
  '<!-- <a title=" --><img src=x onerror=alert(1)>">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p></noscript>',
  '<style><img src=x onerror=alert(1)></style><textarea><img src=x onerror=alert(1)></textarea>',
  '<script>alert(1)</script><svg><script>alert(1)</script></svg>',
  // Сущности в значениях.
  '<img alt="&quot; src=&quot;x" class="&quot;/onerror=alert(1) c" src="https://x.invalid/16.jpg">',
  '<p><img src="https://example.com/a.jpg&quot; onerror=&quot;alert(1)" alt="x"></p>',
]

const URL_ATTRS = ['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'xlink:href']

type Violation = { sample: number; sink: string; problem: string }

const collectViolations = (root: ParentNode, sample: number, sink: string): Violation[] => {
  const violations: Violation[] = []
  if (root.querySelector('script')) violations.push({ sample, sink, problem: 'script element' })
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        violations.push({ sample, sink, problem: `${el.tagName}[${name}="${attr.value}"]` })
      }
      // eslint-disable-next-line no-control-regex -- браузер игнорирует управляющие символы в URL
      if (URL_ATTRS.includes(name) && /^javascript:/i.test(attr.value.replace(/[\s\u0000-\u001f]+/g, ''))) {
        violations.push({ sample, sink, problem: `${el.tagName}[${name}=javascript:]` })
      }
    }
  }
  return violations
}

const parseInto = (html: string): HTMLElement => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

// Клиентский рендер без @testing-library: он регистрирует хуки при require, а
// модули здесь подгружаются после `jest.resetModules()` в beforeAll.
const render = (element: React.ReactElement) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

// Островок не рендерится для описания без текста, поэтому у каждой строки есть абзац.
const withText = (html: string) => `<p>Текст статьи.</p>${html}`

describe('rich-text web sinks: no executable markup after the full path (#3202)', () => {
  it.each([true, false])('StableContent.web (serverSanitized=%s)', (serverSanitized) => {
    const violations = HOSTILE.flatMap((html, index) => {
      const { container, unmount } = render(
        createElement(StableContent, { html: withText(html), contentWidth: 800, serverSanitized }),
      )
      const found = collectViolations(container, index, 'StableContent.web')
      unmount()
      return found
    })
    expect(violations).toEqual([])
  })

  it.each([true, false])('SafeHtml (serverSanitized=%s)', (serverSanitized) => {
    const violations = HOSTILE.flatMap((html, index) => {
      const { container, unmount } = render(
        createElement(SafeHtml, { html: withText(html), serverSanitized, imageAlt: 'фото' }),
      )
      if (!container.querySelector('.safe-html-rich-text')) {
        unmount()
        return [{ sample: index, sink: 'SafeHtml', problem: 'web sink not rendered' }]
      }
      const found = collectViolations(container, index, 'SafeHtml')
      unmount()
      return found
    })
    expect(violations).toEqual([])
  })

  it('TravelDescription SSR island (server safe_html)', () => {
    const violations = HOSTILE.flatMap((html, index) => {
      const tree = createElement(LoaderProvider, { value: { travel: { id: 42 } } },
        createElement(Description, { htmlContent: withText(html), serverSanitized: true, noBox: true }))
      const host = parseInto(renderToString(tree))
      const island = host.querySelector('[data-ssr-html-island="description"]')
      if (!island) return [{ sample: index, sink: 'TravelDescription island', problem: 'island not rendered' }]
      return collectViolations(island, index, 'TravelDescription island')
    })
    expect(violations).toEqual([])
  })
})
