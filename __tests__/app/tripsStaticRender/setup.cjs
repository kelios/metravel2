'use strict'
/* global require, jest */

// Same Winter exclusions as the repository native test setup. No catalog,
// query, theme, locale, SEO, card, filter or screen-header mocks are installed.
jest.mock('expo/src/winter/runtime.native', () => ({}))
jest.mock('expo/src/winter/runtime', () => ({}))

const { TextEncoder, TextDecoder } = require('node:util')
Object.assign(globalThis, { TextEncoder, TextDecoder, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: () => { throw new Error('Unexpected HTTP in code-level trip fixture') },
})
Object.defineProperty(globalThis, 'URL', { configurable: true, writable: true, value: require('node:url').URL })
Object.defineProperty(globalThis, 'URLSearchParams', {
  configurable: true, writable: true, value: require('node:url').URLSearchParams,
})

if (typeof window !== 'undefined') {
  window.matchMedia = () => ({
    matches: false,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  })
  // jsdom has CSSFontFaceRule objects but omits the constructor global required
  // by actual expo-font. Use its own CSSOM rule class; do not patch expo-font.
  const style = document.createElement('style')
  style.textContent = '@font-face { font-family: trip-fixture; src: url(trip-fixture.woff); }'
  document.head.appendChild(style)
  globalThis.CSSFontFaceRule = style.sheet.cssRules[0].constructor
  style.remove()
  // jsdom cannot measure downloadable fonts. Its CSSOM still receives every
  // actual font-face rule; only the browser Font Loading API is an adapter.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: async () => [], check: () => true, ready: Promise.resolve() },
  })
  // jsdom has no raster canvas backend. Report the real unavailable capability
  // to the actual media placeholder owner, which already handles a null context.
  // No pixels or media rendering are asserted by this code-level fixture.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  })
}
