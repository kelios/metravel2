type HeaderNavigationModule = typeof import('@/constants/headerNavigation')

const loadHeaderNavigation = (flag: string | undefined): HeaderNavigationModule => {
  if (flag === undefined) delete process.env.EXPO_PUBLIC_AI_ASSISTANT
  else process.env.EXPO_PUBLIC_AI_ASSISTANT = flag
  let loaded: HeaderNavigationModule | undefined
  jest.isolateModules(() => {
    loaded = require('@/constants/headerNavigation')
  })
  return loaded!
}

describe('header navigation: assistant entry under feature flag (#2460)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    else process.env.EXPO_PUBLIC_AI_ASSISTANT = originalFlag
  })

  it('без флага пункта «Ассистент» нет ни в одном списке', () => {
    const { HEADER_NAV_ITEMS, PRIMARY_HEADER_NAV_ITEMS } = loadHeaderNavigation(undefined)
    expect(HEADER_NAV_ITEMS.some((item) => item.path === '/assistant')).toBe(false)
    expect(PRIMARY_HEADER_NAV_ITEMS.some((item) => item.path === '/assistant')).toBe(false)
    expect(loadHeaderNavigation('0').HEADER_NAV_ITEMS.some((item) => item.path === '/assistant')).toBe(false)
  })

  it('с флагом пункт появляется среди основных, с подписью из i18n (геттер)', () => {
    const { PRIMARY_HEADER_NAV_ITEMS } = loadHeaderNavigation('1')
    const item = PRIMARY_HEADER_NAV_ITEMS.find((entry) => entry.path === '/assistant')
    expect(item).toBeDefined()
    expect(item?.icon).toBe('message-circle')
    expect(item?.external).toBeUndefined()
    expect(typeof item?.label).toBe('string')
    expect(item?.label.length).toBeGreaterThan(0)
  })
})
