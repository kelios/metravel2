/**
 * @jest-environment jsdom
 *
 * Helmet/expo-router Head keeps script innerHTML only from string children.
 * Do not mock LazyInstantSEO here — that mock hid SEO-JSONLD-HEAD-DROP-001.
 */

import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import { emitHelmetScripts, readHelmetHead } from '../../helpers/helmetHead'

import LazyInstantSEO from '@/components/seo/LazyInstantSEO'
import { jsonLdScript } from '@/components/seo/jsonLdScript'

jest.mock('expo-router/head', () => require('../../helpers/helmetHead').createHelmetHeadMock())

describe('JSON-LD Helmet contract (#1967)', () => {
  const originalOS = Platform.OS
  const originalCanUseDOM = HelmetProvider.canUseDOM

  beforeAll(() => {
    HelmetProvider.canUseDOM = false
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    HelmetProvider.canUseDOM = originalCanUseDOM
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })

  it('keeps jsonLdScript string children and drops dangerouslySetInnerHTML', async () => {
    const kept = await emitHelmetScripts(
      jsonLdScript({ '@context': 'https://schema.org', '@type': 'WebPage', url: 'https://metravel.by/map' }),
    )
    expect(kept.scripts).toHaveLength(1)
    expect(kept.scripts[0].type).toBe('application/ld+json')
    expect(kept.scripts[0].getAttribute('data-rh')).toBe('true')
    expect(JSON.parse(kept.scripts[0].textContent ?? '')).toMatchObject({
      '@type': 'WebPage',
      url: 'https://metravel.by/map',
    })

    const dropped = await emitHelmetScripts(
      React.createElement('script', {
        type: 'application/ld+json',
        dangerouslySetInnerHTML: { __html: '{"@type":"WebPage"}' },
      }),
    )
    expect(dropped.scripts).toHaveLength(0)
  })

  it('emits JSON-LD from real LazyInstantSEO additionalTags through Helmet', async () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      url: 'https://metravel.by/map',
    }
    await render(
      <LazyInstantSEO
        title="Карта маршрутов | Metravel"
        additionalTags={jsonLdScript(data, { key: 'map-structured-data' })}
      />,
    )

    const { scripts } = readHelmetHead()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].type).toBe('application/ld+json')
    expect(scripts[0].getAttribute('data-rh')).toBe('true')
    expect(JSON.parse(scripts[0].textContent ?? '')).toMatchObject(data)
  })
})
