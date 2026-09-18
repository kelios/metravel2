/**
 * @jest-environment jsdom
 *
 * Helmet/expo-router Head keeps script innerHTML only from string children.
 * Do not mock LazyInstantSEO here — that mock hid SEO-JSONLD-HEAD-DROP-001.
 */

import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import { Helmet, HelmetProvider, type HelmetServerState } from 'expo-router/vendor/react-helmet-async/lib'

import LazyInstantSEO from '@/components/seo/LazyInstantSEO'
import { jsonLdScript } from '@/components/seo/jsonLdScript'

const emitHelmetScripts = (node: React.ReactNode) => {
  const context: { helmet?: HelmetServerState } = {}
  const originalCanUseDOM = HelmetProvider.canUseDOM
  let helmetScreen: ReturnType<typeof render> | undefined
  HelmetProvider.canUseDOM = false
  try {
    helmetScreen = render(
      <HelmetProvider context={context}>
        <Helmet>{node}</Helmet>
      </HelmetProvider>,
    )
    const html = context.helmet?.script.toString() ?? ''
    const template = document.createElement('template')
    template.innerHTML = html
    const scripts = [...template.content.querySelectorAll('script')]
    return { html, scripts }
  } finally {
    helmetScreen?.unmount()
    HelmetProvider.canUseDOM = originalCanUseDOM
  }
}

describe('JSON-LD Helmet contract (#1967)', () => {
  const originalOS = Platform.OS

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })

  it('keeps jsonLdScript string children and drops dangerouslySetInnerHTML', () => {
    const kept = emitHelmetScripts(
      jsonLdScript({ '@context': 'https://schema.org', '@type': 'WebPage', url: 'https://metravel.by/map' }),
    )
    expect(kept.scripts).toHaveLength(1)
    expect(kept.scripts[0].type).toBe('application/ld+json')
    expect(kept.scripts[0].getAttribute('data-rh')).toBe('true')
    expect(JSON.parse(kept.scripts[0].textContent ?? '')).toMatchObject({
      '@type': 'WebPage',
      url: 'https://metravel.by/map',
    })

    const dropped = emitHelmetScripts(
      React.createElement('script', {
        type: 'application/ld+json',
        dangerouslySetInnerHTML: { __html: '{"@type":"WebPage"}' },
      }),
    )
    expect(dropped.scripts).toHaveLength(0)
  })

  it('emits JSON-LD from real LazyInstantSEO additionalTags through Helmet', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      url: 'https://metravel.by/map',
    }
    const screen = render(
      <LazyInstantSEO
        title="Карта маршрутов | Metravel"
        additionalTags={jsonLdScript(data, { key: 'map-structured-data' })}
      />,
    )

    const { additionalTags } = screen.UNSAFE_root.findByType(LazyInstantSEO).props
    const { scripts } = emitHelmetScripts(additionalTags)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].type).toBe('application/ld+json')
    expect(scripts[0].getAttribute('data-rh')).toBe('true')
    expect(JSON.parse(scripts[0].textContent ?? '')).toMatchObject(data)
  })
})
