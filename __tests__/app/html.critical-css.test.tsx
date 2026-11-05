import React from 'react'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

const { renderToStaticMarkup } = require('react-dom/server.node')
let mockPathname = '/'

jest.mock('expo-router/html', () => ({
  ScrollViewStyleReset: () => null,
  useServerDocumentContext: () => ({ headNodes: [], bodyNodes: [], htmlAttributes: {}, bodyAttributes: {} }),
}))
jest.mock('@/utils/ssr/requestLocale', () => ({
  ...jest.requireActual('@/utils/ssr/requestLocale'),
  readRequestPathname: () => mockPathname,
}))
jest.mock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: { font: {} } }))
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '/assets/feather.ttf' }) } }))

describe('SSR first-screen critical CSS', () => {
  const Root = require('@/app/+html').default
  const oldRuntime = process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
  const oldFile = process.env.METRAVEL_SSR_CRITICAL_CSS

  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
    process.env.METRAVEL_SSR_CRITICAL_CSS = 'critical-0123456789abcdef.css'
  })
  afterAll(() => {
    if (oldRuntime === undefined) delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
    else process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = oldRuntime
    if (oldFile === undefined) delete process.env.METRAVEL_SSR_CRITICAL_CSS
    else process.env.METRAVEL_SSR_CRITICAL_CSS = oldFile
  })

  it.each(['/', '/travels/nesvizh-i-mir-rasstoianie-i-marshrut-na-dva-dnia'])
    ('renders the complete critical stylesheet without another request on %s', (pathname) => {
      mockPathname = pathname
      const html = renderToStaticMarkup(<Root><div>Article</div></Root>)
      expect(html).toContain(`<style id="metravel-critical-css">${buildCriticalCSS()}</style>`)
      expect(html).not.toContain('/_expo/static/css/critical-0123456789abcdef.css')
    })

  it('keeps the shared immutable stylesheet on an adjacent route', () => {
    mockPathname = '/books'
    const html = renderToStaticMarkup(<Root><div>Books</div></Root>)
    expect(html).toContain('href="/_expo/static/css/critical-0123456789abcdef.css"')
    expect(html).not.toContain('<style id="metravel-critical-css">')
  })
})
