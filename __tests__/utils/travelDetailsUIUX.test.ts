import {
  getAccessibleColor,
  getAccessibleFocusStyles,
  getAnimationTiming,
  getBlurUpEffect,
  getImageOptimizationParams,
  getOptimalLayout,
  getOptimizedHeroDimensions,
  getResponsiveFontSize,
  getResponsiveLineHeight,
  getResponsiveSpacing,
  getScrollOffset,
  getSkeletonDimensions,
  isSlowNetwork,
  prefersReducedMotion,
} from '@/utils/travelDetailsUIUX'

describe('travelDetailsUIUX', () => {
  const originalMatchMedia = window.matchMedia
  const originalConnection = (navigator as any).connection
  const originalPlatform = require('react-native').Platform.OS

  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
  })

  afterAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = originalPlatform
    window.matchMedia = originalMatchMedia
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: originalConnection,
    })
  })

  it('calculates responsive spacing thresholds', () => {
    expect(getResponsiveSpacing(320)).toBe(16)
    expect(getResponsiveSpacing(600)).toBe(24)
    expect(getResponsiveSpacing(900)).toBe(32)
    expect(getResponsiveSpacing(1200)).toBe(48)
    expect(getResponsiveSpacing(1600)).toBe(80)
  })

  it('selects responsive font sizes and line heights', () => {
    expect(getResponsiveFontSize(14, 16, 18, 360)).toBe(14)
    expect(getResponsiveFontSize(14, 16, 18, 900)).toBe(16)
    expect(getResponsiveFontSize(14, 16, 18, 1200)).toBe(18)
    expect(getResponsiveLineHeight(16, true)).toBe(24)
    expect(getResponsiveLineHeight(16, false)).toBe(26)
  })

  it('returns accessible colors for light and dark modes', () => {
    expect(getAccessibleColor(true).background).toBe('#ffffff')
    expect(getAccessibleColor(false).background).toBe('#1a1a1a')
  })

  it('optimizes hero dimensions for mobile and desktop', () => {
    expect(getOptimizedHeroDimensions(360, 800).height).toBeGreaterThanOrEqual(200)
    expect(getOptimizedHeroDimensions(1280, 900).height).toBeGreaterThanOrEqual(320)
  })

  it('chooses image optimization params', () => {
    expect(getImageOptimizationParams({ isMobile: true, isHighDPR: false, is3G: true })).toEqual({
      width: 320,
      format: 'jpg',
      quality: 60,
      fit: 'contain',
    })
    expect(getImageOptimizationParams({ isMobile: false, isHighDPR: false, is3G: false }).format).toBe(
      'webp'
    )
  })

  it('selects layout based on screen width', () => {
    expect(getOptimalLayout(400)).toEqual({ layout: 'single-column', itemsPerRow: 1 })
    expect(getOptimalLayout(900)).toEqual({ layout: 'two-column', itemsPerRow: 2 })
    expect(getOptimalLayout(1200)).toEqual({ layout: 'three-column', itemsPerRow: 3 })
  })

  it('respects reduced motion settings', () => {
    expect(getAnimationTiming(true)).toEqual({ fast: 0, normal: 0, slow: 0 })
    expect(getAnimationTiming(false).fast).toBe(150)
  })

  it('detects reduced motion on web', () => {
    window.matchMedia = jest.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })) as any
    expect(prefersReducedMotion()).toBe(true)
  })

  it('uses scroll offsets for header sizes', () => {
    expect(getScrollOffset(true)).toBe(56)
    expect(getScrollOffset(false)).toBe(72)
  })

  it('detects slow network conditions', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '3g' },
    })
    await expect(isSlowNetwork()).resolves.toBe(true)
  })

  it('returns blur-up and skeleton presets', () => {
    expect(getBlurUpEffect().blur).toBe(12)
    expect(getSkeletonDimensions('text').height).toBe(16)
    expect(getSkeletonDimensions('image').borderRadius).toBe(12)
    expect(getSkeletonDimensions('card').height).toBe(300)
  })

  it('returns focus styles', () => {
    expect(getAccessibleFocusStyles().outlineWidth).toBe(3)
  })
})
