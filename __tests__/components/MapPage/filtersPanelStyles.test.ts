import { Platform } from 'react-native'

import { getFiltersPanelStyles } from '@/components/MapPage/filtersPanelStyles'
import { getThemedColors } from '@/constants/designSystem'

describe('filtersPanelStyles', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('keeps the desktop web card constrained to the parent height so the inner scroll can reveal all sections', () => {
    ;(Platform as any).OS = 'web'

    const styles = getFiltersPanelStyles(getThemedColors(false), false, 1280)

    expect(styles.card.flex).toBe(1)
    expect(styles.card.minHeight).toBe(0)
    expect(styles.card.height).toBe('100%')
    expect(styles.card.maxHeight).toBe('100%')
  })

  it.each([
    ['android', true, 48], ['android', false, 48],
    ['ios', true, 44], ['ios', false, 44],
    ['web', true, 44], ['web', false, 44],
  ] as const)('keeps all footer actions within the %s touch target contract (mobile=%s)', (platform, isMobile, minimum) => {
    ;(Platform as any).OS = platform
    const styles = getFiltersPanelStyles(getThemedColors(false), isMobile, isMobile ? 320 : 1280)

    expect(styles.ctaButton.minHeight).toBeGreaterThanOrEqual(minimum)
    expect(styles.ctaPrimary.minHeight).toBeGreaterThanOrEqual(minimum)
  })

})
