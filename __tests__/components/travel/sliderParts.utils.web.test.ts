/**
 * @jest-environment jsdom
 */

import { Platform } from 'react-native'

import { buildUriWeb } from '@/components/travel/sliderParts/utils'

describe('sliderParts/utils buildUriWeb (web)', () => {
  const originalPlatform = Platform.OS
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
  })

  it('keeps the first desktop slide aligned with the LCP hero image variant', () => {
    const src = buildUriWeb(
      {
        id: 'hero-1',
        url: 'https://metravel.by/gallery/123/hero.jpg',
      } as any,
      1180,
      undefined,
      'contain',
      true,
    )

    expect(src).toContain('w=720')
    expect(src).toContain('q=45')
    expect(src).toContain('fit=contain')
  })

  it('keeps the first mobile slide aligned with the LCP hero image variant', () => {
    const src = buildUriWeb(
      {
        id: 'hero-1',
        url: 'https://metravel.by/gallery/123/hero.jpg',
      } as any,
      390,
      undefined,
      'contain',
      true,
    )

    expect(src).toContain('w=390')
    expect(src).toContain('q=35')
    expect(src).toContain('fit=contain')
  })

  it('still allows non-first desktop slides to use the larger slider variant', () => {
    const src = buildUriWeb(
      {
        id: 'hero-2',
        url: 'https://metravel.by/gallery/123/hero-2.jpg',
      } as any,
      1180,
      undefined,
      'contain',
      false,
    )

    expect(src).toContain('w=1180')
    expect(src).toContain('q=65')
  })
})
