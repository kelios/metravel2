import { placesCatalogHref, placesCatalogSource, isPlacesCatalogHref } from '@/utils/placesCatalogAnalytics'

test('localized real href carries only finite attribution while retaining existing query and fragment', () => {
  expect(placesCatalogHref('/pl/places?category=43#catalog', 'desktop_navigation')).toBe('/pl/places?category=43&places_source=desktop_navigation#catalog')
  expect(placesCatalogHref('/places?places_source=old', 'mobile_menu')).toBe('/places?places_source=mobile_menu')
  for (const href of ['/map', '/places/help', '/places-extra', 'https://metravel.by/places']) {
    expect(isPlacesCatalogHref(href)).toBe(false)
    expect(placesCatalogHref(href, 'mobile_menu')).toBe(href)
  }
  for (const source of ['private text', ['mobile_menu'], undefined, '', '/map']) expect(placesCatalogSource(source)).toBe('direct')
  expect(placesCatalogSource('mobile_menu')).toBe('mobile_menu')
})
