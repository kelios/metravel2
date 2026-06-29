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

    // q quantized to the nearest 10 (82 → 80) by imageProxy DIMENSION/quality ladder;
    // hero stays dpr-/format-free per the image-architecture rule.
    expect(src).toContain('w=1280')
    expect(src).toContain('q=80')
    expect(src).toContain('fit=contain')
    expect(src).not.toContain('dpr=')
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

    // 720 snaps up to the 800 ladder rung; q 72 → 70. Hero stays dpr-/format-free.
    expect(src).toContain('w=800')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    expect(src).not.toContain('dpr=')
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

    // 1180 snaps up to the 1280 ladder rung; q 78 → 80.
    expect(src).toContain('w=1280')
    expect(src).toContain('q=80')
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

    // 390 snaps up to the 480 ladder rung; q 78 → 80; integer dpr preserved.
    expect(src).toContain('w=480')
    expect(src).toContain('q=80')
    expect(src).toContain('dpr=3')
    expect(src).toContain('fit=contain')
  })
})
