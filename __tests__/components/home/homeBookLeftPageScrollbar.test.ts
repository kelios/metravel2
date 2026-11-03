import { Platform, StyleSheet } from 'react-native'

import { getThemedColors } from '@/constants/designSystem'
import { createHomeHeroStyles } from '@/components/home/homeHeroStyles'

function createWebDesktopHeroStyles() {
  const previousOS = Platform.OS
  const previousSelect = Platform.select
  Platform.OS = 'web'
  ;(Platform as any).select = (options: any) => options.web ?? options.default
  try {
    return createHomeHeroStyles({
      colors: getThemedColors(false),
      isMobile: false,
      isSmallPhone: false,
      isNarrowLayout: false,
      isTablet: false,
      isDesktop: true,
      viewportWidth: 1440,
      showSideSlider: true,
      sliderHeight: 320,
      bookHeight: 760,
    })
  } finally {
    Platform.OS = previousOS
    ;(Platform as any).select = previousSelect
  }
}

describe('home book left page scrollbar', () => {
  it('scrolls the overflow without drawing a scrollbar on the live page', () => {
    const frame = StyleSheet.flatten(createWebDesktopHeroStyles().leftPageFrame) as Record<string, unknown>
    expect(frame.overflowY).toBe('auto')
    expect(frame.scrollbarWidth).toBe('none')
  })
})
