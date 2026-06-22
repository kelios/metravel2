import {
  BOTTOM_DOCK_MORE_MENU_SECTIONS,
  normalizeBottomDockActivePath,
} from '@/components/layout/bottomDockModel'

describe('bottomDockModel', () => {
  it('exposes public trips in the mobile more menu', () => {
    const primaryItems = BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'primary')?.items ?? []

    expect(primaryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'trips',
          label: 'Попутчики',
          route: '/trips',
          iconName: 'users',
        }),
      ]),
    )
  })

  it('routes the "Связаться с нами" item to the dedicated contact screen', () => {
    const secondaryItems =
      BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'secondary')?.items ?? []

    expect(secondaryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'about',
          label: 'Связаться с нами',
          route: '/contact',
          iconName: 'mail',
        }),
      ]),
    )
  })

  it('normalizes public trip routes to the trips section', () => {
    expect(normalizeBottomDockActivePath('/trips')).toBe('/trips')
    expect(normalizeBottomDockActivePath('/trips/42')).toBe('/trips')
    expect(normalizeBottomDockActivePath('/trips/plan')).toBe('/trips')
  })
})
