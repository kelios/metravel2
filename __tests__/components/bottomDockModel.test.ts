import {
  BOTTOM_DOCK_MORE_MENU_SECTIONS,
  normalizeBottomDockActivePath,
} from '@/components/layout/bottomDockModel'

describe('bottomDockModel', () => {
  it('keeps the PDF book export out of the mobile web more menu', () => {
    const primaryItems = BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'primary')?.items ?? []

    // Экспорт в PDF («Книга путешествий») скрыт в мобильной версии сайта.
    expect(primaryItems.some((item) => item.key === 'export' || item.route === '/export')).toBe(false)
    expect(primaryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'places', route: '/places' }),
        expect.objectContaining({ key: 'articles', route: '/articles' }),
      ]),
    )
  })

  it('routes the "Связаться с нами" item to the dedicated contact screen', () => {
    const secondaryItems =
      BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'secondary')?.items ?? []

    expect(secondaryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'contact',
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

  it('does not mark the routes tab active on the landing screen', () => {
    expect(normalizeBottomDockActivePath('/')).toBe('')
    expect(normalizeBottomDockActivePath('/index')).toBe('')
    expect(normalizeBottomDockActivePath('/(tabs)')).toBe('')
  })
})
