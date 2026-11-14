import { Platform } from 'react-native'
import { getThemedColors } from '@/constants/designSystem'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'

// #3367: метка города карточки квеста лежит выше плотной части градиента; на
// светлой обложке её контраст решает собственная подложка, а не картинка.
// Худший случай — полностью белый кадр под подложкой.
it.each([false, true])('city label on a white cover keeps AA contrast (dark=%s)', (isDark) => {
  const original = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  try {
    const colors = getThemedColors(isDark)
    const label = getStyles(colors, 390).questCardCategory
    expect(label.color).toBe(colors.textOnDark)
    expect(label.backgroundColor).toBe(colors.mediaCaptionOverlay)
    const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(String(label.backgroundColor))!
    expect(rgba).not.toBeNull()
    const alpha = Number(rgba[4])
    const linear = (channel: number) => {
      const value = (channel * alpha + 255 * (1 - alpha)) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    const luminance = linear(Number(rgba[1])) * 0.2126 + linear(Number(rgba[2])) * 0.7152 + linear(Number(rgba[3])) * 0.0722
    expect(String(colors.textOnDark).toLowerCase()).toBe('#ffffff')
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5)
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original })
  }
})
