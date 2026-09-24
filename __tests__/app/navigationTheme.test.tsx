import { navigationThemeColors } from '@/components/layout/navigationTheme'
import { getThemedColors } from '@/constants/designSystem'

const LIGHT_NAVIGATION_BACKGROUND = 'rgb(242, 242, 242)'

describe('navigation theme (#2095)', () => {
  it('dark mode does not keep the default light navigation background', () => {
    const colors = getThemedColors(true)
    const themeColors = navigationThemeColors(colors)
    expect(themeColors.background).toBe(colors.background)
    expect(themeColors.card).toBe(colors.surface)
    expect(themeColors.text).toBe(colors.text)
    expect(themeColors.border).toBe(colors.border)
    expect(themeColors.primary).toBe(colors.primary)
    expect(themeColors.notification).toBe(colors.danger)
    expect(themeColors.background).not.toBe(LIGHT_NAVIGATION_BACKGROUND)
  })

  it('light mode still uses the app background, not a second palette', () => {
    const colors = getThemedColors(false)
    expect(navigationThemeColors(colors).background).toBe(colors.background)
  })
})
