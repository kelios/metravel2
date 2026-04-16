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
    ;(window as any).devicePixelRatio = 1
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
    expect(src).not.toContain('f=')
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

    expect(src).toContain('w=720')
    expect(src).toContain('q=50')
    expect(src).toContain('fit=contain')
    expect(src).not.toContain('f=')
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

  it('requests DPR-aware mobile slide variants on retina devices', () => {
    ;(window as any).devicePixelRatio = 3

    const src = buildUriWeb(
      {
        id: 'hero-3',
        url: 'https://metravel.by/gallery/123/hero-3.jpg',
      } as any,
      390,
      undefined,
      'contain',
      false,
    )

    expect(src).toContain('w=390')
    expect(src).toContain('q=58')
    expect(src).toContain('dpr=2')
    expect(src).toContain('fit=contain')
  })
})
