import { Platform } from 'react-native'
import { getThemedColors } from '@/constants/designSystem'
import { createMediaStyles } from '@/components/quests/questWizardStyles/mediaStyles'

// A photo can be entirely white in either theme. Modal overlays are too light
// for small white city labels; the caption scrim must meet AA independently.
it.each([false, true])('caption on a white image keeps AA contrast (dark=%s)', (isDark) => {
  const original = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  try {
    const colors = getThemedColors(isDark)
    const styles = createMediaStyles(colors, true, 320)
    const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(styles.videoCaption.backgroundColor)!
    expect(rgba).not.toBeNull()
    const alpha = Number(rgba[4])
    const linear = (channel: number) => {
      const value = (channel * alpha + 255 * (1 - alpha)) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    const luminance = linear(Number(rgba[1])) * 0.2126 + linear(Number(rgba[2])) * 0.7152 + linear(Number(rgba[3])) * 0.0722
    expect(colors.textOnDark.toLowerCase()).toBe('#ffffff')
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5)
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original })
  }
})
