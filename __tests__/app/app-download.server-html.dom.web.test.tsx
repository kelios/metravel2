import fs from 'fs'
import path from 'path'
import type React from 'react'

// #3231: страница /app отдаёт ссылки на витрины и разметку MobileApplication уже
// в серверном HTML — без JS. Ссылки и идентификаторы — из `constants/appIdentity`.
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let AppDownloadScreen: React.ComponentType
let identity: typeof import('@/constants/appIdentity')

jest.mock('expo-router', () => ({ useIsFocused: () => true }))
jest.mock('@/components/layout/CustomHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useDeviceStorePlatform', () => ({ useDeviceStorePlatform: () => null }))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Сборка web берёт `.web.tsx`; jest-expo резолвит native-вариант — подменяем явно.
  jest.doMock('@/components/appDownload/AppDownloadJsonLd', () =>
    jest.requireActual('@/components/appDownload/AppDownloadJsonLd.web'))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  AppDownloadScreen = require('@/app/app').default
  identity = require('@/constants/appIdentity')
})

const renderPage = () => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(AppDownloadScreen))
  return host
}

it('renders both store buttons as real links in the server HTML', () => {
  const host = renderPage()
  for (const url of [identity.APP_STORE_APP_URL, identity.GOOGLE_PLAY_APP_URL]) {
    // Кнопки витрин стоят в начале и в конце страницы.
    const links = Array.from(host.querySelectorAll(`a[href="${url}"]`))
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
  }
  expect(identity.APP_STORE_APP_URL).toContain('id6801264369')
  expect(identity.GOOGLE_PLAY_APP_URL).toContain('id=by.metravel.app')
})

it('declares the app as MobileApplication for Android and iOS', () => {
  const script = renderPage().querySelector('script[type="application/ld+json"][data-seo-jsonld="app-download"]')
  expect(script).not.toBeNull()
  const graph = JSON.parse(script!.textContent || '{}')['@graph'] as Record<string, unknown>[]
  expect(graph.map((node) => [node['@type'], node.operatingSystem, node.identifier, node.installUrl])).toEqual([
    ['MobileApplication', 'Android', identity.ANDROID_APP_PACKAGE, identity.GOOGLE_PLAY_APP_URL],
    ['MobileApplication', 'iOS', identity.APP_STORE_APP_ID, identity.APP_STORE_APP_URL],
  ])
  for (const node of graph) expect(node.publisher).toEqual({ '@id': 'https://metravel.by/#organization' })
})

it('lists the same store apps as related_applications in the web manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'manifest.json'), 'utf8'))
  expect(manifest.prefer_related_applications).toBe(false)
  expect(manifest.related_applications).toEqual([
    { platform: 'play', url: identity.GOOGLE_PLAY_APP_URL, id: identity.ANDROID_APP_PACKAGE },
    { platform: 'itunes', url: identity.APP_STORE_APP_URL },
  ])
})
