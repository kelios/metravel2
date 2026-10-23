import { Platform } from 'react-native'
import { isQuestDetailHeaderPath, resolveQuestHeaderPresentation } from '@/components/layout/questHeaderPresentation'
import { resolveHeaderContextBarIsMobile } from '@/components/layout/headerContextBarModel'
import { shouldShowHeaderContextBar, shouldShowBrandRow } from '@/components/layout/customHeaderModel'
import { HEADER_HEIGHT_FALLBACK } from '@/components/layout/headerLayoutContract'
import { WEB_MOBILE_DOCK_LAYOUT } from '@/components/layout/webMobileDockLayout'

describe('quest detail header ownership', () => {
  const previousOS = Platform.OS
  beforeAll(() => { Platform.OS = 'web' })
  afterAll(() => { Platform.OS = previousOS })

  it.each(['/quests/35/istanbul', '/be/quests/35/istanbul', '/uk/quests/35/istanbul/', '/pl/quests/35/istanbul', '/en/quests/35/istanbul'])(
    'recognizes the real detail route %s', path => expect(isQuestDetailHeaderPath(path)).toBe(true),
  )
  it.each(['/quests', '/quests/35', '/quests/country/poland', '/pl/quests/country/poland', '/quests/theme/family', '/pl/quests/theme/family', '/quests/scenario', '/quests/map', '/pl/quests/35', '/travel/35', '/settings'])(
    'preserves other route families: %s', path => expect(isQuestDetailHeaderPath(path)).toBe(false),
  )

  it.each([[320, 640], [390, 844], [718, 735], [960, 640], [1024, 768], [844, 390], [1279, 640]] as const)(
    '%dx%d shares one screen-row owner with the global header', (width, height) => {
      const model = resolveQuestHeaderPresentation({ width, height, isWeb: true })
      const row = resolveHeaderContextBarIsMobile({ width, isPhone: false, isLargePhone: false, pathname: '/pl/quests/35/istanbul' })
      expect(model.headerInScreenRow).toBe(true)
      expect(row).toBe(model.headerInScreenRow)
      expect(shouldShowHeaderContextBar('/pl/quests/35/istanbul', true)).toBe(true)
      expect(shouldShowBrandRow('/pl/quests/35/istanbul', row)).toBe(false)
      expect(HEADER_HEIGHT_FALLBACK['quest-screen'] / height).toBeLessThanOrEqual(0.2)
    },
  )

  it.each([960, 1024, 1279])('the existing site-navigation/language dock covers compact quest width %d', width => {
    const model = resolveQuestHeaderPresentation({ width, height: 640, isWeb: true })
    expect(model.headerInScreenRow).toBe(true)
    // Compare with the actual dock's registered first-frame visibility boundary,
    // rather than creating a second guessed "mobile" boundary for quests.
    expect(width).toBeLessThan(WEB_MOBILE_DOCK_LAYOUT.minWidth)
    expect(WEB_MOBILE_DOCK_LAYOUT.blocks.shell.narrow.display).toBe('flex')
  })

  it.each([[1440, 900], [1280, 390]] as const)('wide desktop %dx%d keeps brand and sidebar as separate site/quest owners', (width, height) => {
    const model = resolveQuestHeaderPresentation({ width, height, isWeb: true })
    expect(model.compactDesktopLayout).toBe(true)
    expect(model.headerInScreenRow).toBe(false)
    expect(shouldShowHeaderContextBar('/quests/35/istanbul', false)).toBe(false)
    expect(shouldShowBrandRow('/quests/35/istanbul', false)).toBe(true)
    expect(HEADER_HEIGHT_FALLBACK['wide-nobar'] / height).toBeLessThanOrEqual(0.2)
  })

  it('leaves native phone/tablet ownership and its compact-phone placement intact', () => {
    expect(resolveQuestHeaderPresentation({ width: 390, height: 640, isWeb: false, nativeScreenRow: true })).toMatchObject({ headerInScreenRow: true, headerInContentFlow: true })
    expect(resolveQuestHeaderPresentation({ width: 960, height: 640, isWeb: false })).toMatchObject({ headerInScreenRow: false, headerInContentFlow: false, compactDesktopLayout: false })
    expect(resolveHeaderContextBarIsMobile({ width: 960, isPhone: false, isLargePhone: false, pathname: '/settings' })).toBe(false)
  })
})
