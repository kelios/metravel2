import type { ThemedColors } from '@/hooks/useTheme'
let Platform: typeof import('react-native').Platform
let createTravelDetailsLayoutStyles: typeof import('@/components/travel/details/styles/travelDetailsLayoutStyles').createTravelDetailsLayoutStyles
let TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS: typeof import('@/components/travel/details/hooks/useTravelDeferredSectionsModel').TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ Platform } = require('react-native'))
  ;({ createTravelDetailsLayoutStyles } = require('@/components/travel/details/styles/travelDetailsLayoutStyles'))
  ;({ TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS } = require('@/components/travel/details/hooks/useTravelDeferredSectionsModel'))
})

describe('travel deferred sections keep real flow geometry after their shared visibility gate', () => {
  it.each(['webDeferredSection', 'webOptionalDeferredSection'] as const)('%s never substitutes a skipped intrinsic height', key => {
    const styles = createTravelDetailsLayoutStyles({} as ThemedColors)
    expect(styles[key]).toEqual({
      contentVisibility: 'visible',
      contain: 'layout style paint',
      containIntrinsicSize: 'none',
    })
  })

  it('retains actual mount/fetch deferral for map and sidebar', () => {
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.map.rootMargin).toBe('200px')
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.map.fallbackDelay).toBeNull()
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.sidebar.rootMargin).toBe('200%')
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.sidebar.fallbackDelay).toBeNull()
  })

  it('keeps those browser geometry declarations off native', () => {
    const select = jest.spyOn(Platform, 'select').mockImplementation(options => options.default as never)
    try {
      const styles = createTravelDetailsLayoutStyles({} as ThemedColors)
      expect(styles.webDeferredSection).toEqual({})
      expect(styles.webOptionalDeferredSection).toEqual({})
    } finally {
      select.mockRestore()
    }
  })
})
