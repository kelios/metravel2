/**
 * @jest-environment jsdom
 */

import { Platform } from 'react-native'

import { buildUriNative } from '@/components/travel/sliderParts/utils'

const widthOf = (src: string) => {
  const m = src.match(/[?&]w=(\d+)/)
  return m ? Number(m[1]) : NaN
}

describe('sliderParts/utils buildUriNative (native)', () => {
  const originalPlatform = Platform.OS
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    ;(Platform as any).OS = 'ios'
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    ;(window as any).devicePixelRatio = 3
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
  })

  const img = {
    id: 'n-1',
    url: 'https://metravel.by/gallery/123/photo.jpg',
    width: 1600,
    height: 900,
  } as any

  it('caps neighbour slide width below the active slide on a retina phone', () => {
    const first = buildUriNative(img, 390, 812, true)
    const neighbour = buildUriNative(img, 390, 812, false)

    // Active slide keeps full device DPR: 390×3 = 1170 → 1280 rung. The
    // neighbour is capped to dpr 2: 390×2 = 780 → 800 rung — far less on-device
    // decode on swipe 1→2, while the active slide stays sharp.
    expect(widthOf(first)).toBe(1280)
    expect(widthOf(neighbour)).toBe(800)
  })
})
