import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsLayout } from '@/hooks/useTravelDetailsLayout'
import {
  HEADER_OFFSET_DESKTOP,
  HEADER_OFFSET_MOBILE,
  getTravelDetailsStyles,
} from '@/components/travel/details/TravelDetailsStyles'
import { getThemedColors } from '@/hooks/useTheme'

describe('useTravelDetailsLayout', () => {
  const originalOS = Platform.OS
  const originalSelect = Platform.select

  beforeEach(() => {
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web ?? obj.default
  })

  afterEach(() => {
    Platform.OS = originalOS
    Platform.select = originalSelect
  })

  it('returns mobile layout values', () => {
    const { result } = renderHook(() =>
      useTravelDetailsLayout({ isMobile: true, screenWidth: 360 })
    )

    expect(result.current.headerOffset).toBe(HEADER_OFFSET_MOBILE)
    expect(result.current.contentHorizontalPadding).toBe(16)
  })

  it('returns desktop layout values', () => {
    const { result } = renderHook(() =>
      useTravelDetailsLayout({ isMobile: false, screenWidth: 1680 })
    )

    expect(result.current.headerOffset).toBe(HEADER_OFFSET_DESKTOP)
    expect(result.current.contentHorizontalPadding).toBe(80)
  })

  it('uses web and native side menu styles', () => {
    const baseStyles = getTravelDetailsStyles(getThemedColors(false))
    let result = renderHook(() =>
      useTravelDetailsLayout({ isMobile: false, screenWidth: 1200 })
    ).result
    expect(result.current.sideMenuPlatformStyles).toEqual(baseStyles.sideMenuWebDesktop)

    Platform.OS = 'ios'
    result = renderHook(() =>
      useTravelDetailsLayout({ isMobile: false, screenWidth: 1200 })
    ).result
    expect(result.current.sideMenuPlatformStyles).toEqual(baseStyles.sideMenuNative)
  })
})
