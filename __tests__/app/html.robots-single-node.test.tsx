import React from 'react'
const { renderToStaticMarkup } = require('react-dom/server.node')

let mockHeadNodes: React.ReactNode[] = []
jest.mock('expo-router/html', () => ({
  ScrollViewStyleReset: () => null,
  useServerDocumentContext: () => ({ headNodes: mockHeadNodes, bodyNodes: [], htmlAttributes: {}, bodyAttributes: {} }),
}))

jest.mock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: { font: new Proxy({}, { get: () => 1 }) } }))
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '/assets/feather.ttf' }) } }))

const robotsOf = (html: string) => [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((match) => match[1])

// The request renderer emitted the quest verdict and the site default side by
// side, so verify-live-quest-ssr rolled the SSR release back (two robots tags).
describe('document robots', () => {
  const Root = require('@/app/+html').default

  it('keeps the route robots as the only node when the route declares one', () => {
    mockHeadNodes = [<title key="t">Quest</title>, <meta key="r" name="robots" content="noindex, follow" />]
    expect(robotsOf(renderToStaticMarkup(<Root><div /></Root>))).toEqual(['noindex, follow'])
  })

  it('falls back to the single site default without a route robots', () => {
    mockHeadNodes = [<title key="t">Page</title>]
    expect(robotsOf(renderToStaticMarkup(<Root><div /></Root>))).toHaveLength(1)
  })
})
