/** @jest-environment node */

import fs from 'node:fs'
import vm from 'node:vm'
import React from 'react'

const ReactDomServer = require('react-dom/server.node') as typeof import('react-dom/server')

function rendererForRequest({ routeAddsStyles = true } = {}) {
  const source = fs.readFileSync(require.resolve('@expo/router-server/build/server/renderStreamingContent'), 'utf8')
  const start = source.indexOf('async function getStreamingContent(')
  const end = source.lastIndexOf('\n//# sourceMappingURL=')
  if (start < 0 || end < start) throw new Error('Installed SDK renderer entry changed')
  let routeRendered = false
  const getStyleElement = () => React.createElement('style', { id: 'react-native-stylesheet', key: 'rnw-style-element' },
    routeRendered ? '.cold-route{color:red}' : '.base{display:flex}')
  const LateStyledRoute = () => {
    routeRendered = routeAddsStyles
    return React.createElement('article', { className: 'cold-route' }, 'Request body')
  }
  const context = vm.createContext({
    Response,
    Number,
    console,
    _server: () => ({ withServerContext: (render: () => unknown) => render() }),
    _server2: () => ({ default: ReactDomServer }),
    _jsxruntime: () => require('react/jsx-runtime'),
    _react1: {
      createInjectedCssAsNodes: () => ({ headNodes: [] }),
      createInjectedScriptAsNodes: () => ({ headNodes: [], bodyNodes: [] }),
      getBootstrapContents: () => '',
    },
    _private: () => ({ normalizeCssAssets: () => [] }),
    _server1: () => ({
      ServerDocument: ({ data, children }: { data: { headNodes: React.ReactNode[] }; children: React.ReactNode }) =>
        React.createElement('html', null, React.createElement('head', null, data.headNodes), React.createElement('body', null, children)),
    }),
    _head: () => ({ default: { Provider: ({ children }: { children: React.ReactNode }) => children } }),
    _static: () => ({ InnerRoot: ({ children }: { children: React.ReactNode }) => children }),
    FontResources: () => null,
    prepareRenderContext: () => ({
      element: React.createElement(LateStyledRoute), getStyleElement, headContext: {}, loadedData: null,
    }),
  })
  return vm.runInContext(`(${source.slice(start, end)})`, context) as (
    url: URL,
    options: { request?: Request; output?: string; assets: Record<string, unknown> },
  ) => Promise<string | ReadableStream>
}

describe('SDK request-rendered style ownership (#2766)', () => {
  it.each(['request', 'static'])('includes classes first created during a cold %s render', async (mode) => {
    const render = rendererForRequest()
    const html = await render(new URL('https://metravel.by/travels/example'), {
      assets: {},
      ...(mode === 'request' ? { request: new Request('https://metravel.by/travels/example') } : { output: 'static' }),
    })
    expect(typeof html).toBe('string')
    expect(html).toContain('<article class="cold-route">Request body</article>')
    expect(html).toContain('<style id="react-native-stylesheet">.cold-route{color:red}</style>')
    expect((String(html).match(/id="react-native-stylesheet"/g) ?? []).length).toBe(1)
  })

  // The 95eb5c09e static export appended a second sheet to every page whose
  // render added no classes: the replacement left the string unchanged.
  it('keeps one sheet when the render adds no styles', async () => {
    const render = rendererForRequest({ routeAddsStyles: false })
    const html = await render(new URL('https://metravel.by/'), { assets: {}, output: 'static' })
    expect((String(html).match(/id="react-native-stylesheet"/g) ?? []).length).toBe(1)
    expect(html).toContain('<style id="react-native-stylesheet">.base{display:flex}</style>')
  })
})
