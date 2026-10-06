import { Platform } from 'react-native'
import { getIsHeaderMobile } from '@/components/layout/customHeaderModel'
import { HEADER_LAYOUT_BREAKPOINTS } from '@/components/layout/headerLayoutContract'

it.each(['web', 'ios', 'android'] as const)('shares the compact navigation threshold on %s (including tablet rotation)', (os) => {
  const original = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
  try {
    for (const width of [768, 1024, 1180, 1280, 1366, 1440, 768]) {
      expect(getIsHeaderMobile(width, width)).toBe(width < HEADER_LAYOUT_BREAKPOINTS.compactRow)
    }
  } finally { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }) }
})
