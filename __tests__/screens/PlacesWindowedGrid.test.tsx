import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { PlacesCatalogScrollView, PlacesWindowedGrid } from '@/screens/tabs/PlacesWindowedGrid'
import type { PlacesStyles } from '@/screens/tabs/PlacesScreen.styles'
import { mapPlacesCatalogResponse } from '@/utils/placesCatalog'

jest.mock('@/screens/tabs/PlacesScreen.parts', () => {
  const { Text } = require('react-native')
  return { PlaceCard: ({ place }: { place: { id: string } }) => <Text testID={`place-${place.id}`}>{place.id}</Text> }
})

it.each(['ios', 'android'] as const)('windows ten pages using the shared %s scroll event and restores earlier rows', async os => {
  const original = Platform.OS
  Platform.OS = os
  try {
    const { places } = mapPlacesCatalogResponse({
      results: Array.from({ length: 200 }, (_, i) => ({
        id: String(i + 1), title: `Place ${i + 1}`, lat: 53, lng: 26,
      })),
    })
    expect(places).toHaveLength(200)
    const view = await render(
      <PlacesCatalogScrollView testID="scroller">
        <PlacesWindowedGrid places={places} columns={1} parentTop={120} firstScreenCount={2} footer={null}
          onOpenMap={jest.fn()} onOpenTravel={jest.fn()} styles={{} as PlacesStyles} />
      </PlacesCatalogScrollView>,
    )
    const scrollTo = (y: number) => fireEvent.scroll(view.getByTestId('scroller'), {
      nativeEvent: { contentOffset: { y, x: 0 }, layoutMeasurement: { height: 675, width: 390 }, contentSize: { height: 105000, width: 390 } },
    })
    expect(view.getByTestId('place-1')).toBeTruthy()
    await scrollTo(51000)
    expect(view.queryByTestId('place-1')).toBeNull()
    expect(view.getByTestId('place-100')).toBeTruthy()
    expect(view.getAllByTestId(/^place-/).length).toBeLessThanOrEqual(7)
    await scrollTo(0)
    expect(view.getByTestId('place-1')).toBeTruthy()
    expect(view.queryByTestId('place-100')).toBeNull()
  } finally {
    Platform.OS = original
  }
})
