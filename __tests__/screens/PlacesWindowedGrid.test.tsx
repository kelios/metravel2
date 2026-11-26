import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { PlacesCatalogScrollView, PlacesWindowedGrid, rememberRowHeight } from '@/screens/tabs/PlacesWindowedGrid'
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

it('keeps measured row heights when the grid width changes by a pixel', () => {
  const measured = rememberRowHeight(
    { width: 900, columns: 3, heights: new Map() },
    { width: 900, columns: 3, key: 'a', height: 720 },
  )
  const jittered = rememberRowHeight(measured, { width: 901, columns: 3, key: 'b', height: 700 })
  expect(jittered.heights.get('a')).toBe(720)
  expect(jittered.heights.get('b')).toBe(700)
  const regrouped = rememberRowHeight(jittered, { width: 390, columns: 1, key: 'c', height: 500 })
  expect(regrouped.heights.has('a')).toBe(false)
  expect(regrouped.heights.get('c')).toBe(500)
})

it('keeps an off-screen web row mounted until Tab focus has moved', async () => {
  const original = Platform.OS
  Platform.OS = 'web'
  // React's awaited act continues on setImmediate. A real setTimeout(0) from
  // blur can run before that continuation, so the deferred clear must be faked
  // or the row unmounts inside fireEvent.
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
  try {
    const { places } = mapPlacesCatalogResponse({
      results: Array.from({ length: 200 }, (_, i) => ({
        id: String(i + 1), title: `Place ${i + 1}`, lat: 53, lng: 26,
      })),
    })
    const view = await render(
      <PlacesCatalogScrollView testID="scroller">
        <PlacesWindowedGrid places={places} columns={1} parentTop={0} firstScreenCount={2} footer={null}
          onOpenMap={jest.fn()} onOpenTravel={jest.fn()} styles={{} as PlacesStyles} />
      </PlacesCatalogScrollView>,
    )
    const scrollTo = (y: number) => fireEvent.scroll(view.getByTestId('scroller'), {
      nativeEvent: { contentOffset: { y, x: 0 }, layoutMeasurement: { height: 675, width: 390 }, contentSize: { height: 105000, width: 390 } },
    })
    await scrollTo(51000)
    await fireEvent(view.getByTestId('place-100').parent!, 'focus')
    await scrollTo(0)
    expect(view.getByTestId('place-1')).toBeTruthy()
    expect(view.getByTestId('place-100')).toBeTruthy()
    const row = () => view.getByTestId('place-100').parent!
    await fireEvent(row(), 'blur', { nativeEvent: { relatedTarget: null } })
    expect(view.getByTestId('place-100')).toBeTruthy()
    await fireEvent(row(), 'focus')
    await act(async () => { jest.runOnlyPendingTimers() })
    expect(view.getByTestId('place-100')).toBeTruthy()
    await fireEvent(row(), 'blur', { nativeEvent: { relatedTarget: null } })
    await act(async () => { jest.runOnlyPendingTimers() })
    expect(view.queryByTestId('place-100')).toBeNull()
  } finally {
    jest.useRealTimers()
    Platform.OS = original
  }
})
