import React from 'react'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient'
import { LIBRARY_PLACE_UUID, RAW_LIBRARY_SOURCE_A, RAW_LIBRARY_SOURCE_B } from '@/__tests__/fixtures/mapPlaceFixtures'
import { invalidateBlockSensitiveQueries } from '@/api/blockSensitiveQueries'
import { PlaceCard } from '@/screens/tabs/PlacesScreen.parts'
import type { PlacesStyles } from '@/screens/tabs/PlacesScreen.styles'
import { mapPlacesCatalogResponse } from '@/utils/placesCatalog'

const mockFetchWithTimeout = jest.fn()

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}))
jest.mock('@/hooks/map/useSavedPointToggle', () => ({
  useSavedPointToggle: () => ({ isSaved: false, isReady: true }),
}))
jest.mock('@/components/books/ReadyBookRelatedLink', () => ({
  useReadyBookAction: () => null,
  ReadyBookRelatedLink: () => null,
}))
jest.mock('@/components/travel/RelatedTravelActionStack', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/places/PlaceRatingSection', () => {
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ placeId, initialRating, initialCount, testID }: {
      placeId: string, initialRating: number, initialCount: number, testID: string
    }) => <Text testID={testID}>{`${placeId}:${initialRating}:${initialCount}`}</Text>,
  }
})
jest.mock('@/components/ui/UnifiedTravelCard', () => {
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: ({ imageUrl, contentSlot, onPress }: {
      imageUrl: string, contentSlot: React.ReactNode, onPress: () => void
    }) => (
      <View>
        <Pressable testID="open-map" onPress={onPress}><Text testID="card-photo">{imageUrl}</Text></Pressable>
        {contentSlot}
      </View>
    ),
  }
})

const response = (payload: unknown, status = 200) => ({
  ok: status === 200,
  status,
  statusText: status === 200 ? 'OK' : 'Not Found',
  text: async () => JSON.stringify(payload),
})
const toPlace = (overrides: Record<string, unknown> = {}) => mapPlacesCatalogResponse({
  results: [{
    id: RAW_LIBRARY_SOURCE_A.point_id,
    place_id: LIBRARY_PLACE_UUID,
    source_count: 2,
    primary_source: RAW_LIBRARY_SOURCE_A,
    title: 'Национальная библиотека',
    address: 'Минск, проспект Независимости 116',
    lat: 53.93129,
    lng: 27.6459,
    image: { landscape_url: 'https://example.com/first.webp' },
    rating: { value: 4.6, count: 9 },
    ...overrides,
  }],
}).places[0]

const renderCards = async (places = [toPlace()]) => {
  const queryClient = createTestQueryClient()
  const openTravel = jest.fn()
  const openMap = jest.fn()
  const cards = (records: ReturnType<typeof toPlace>[]) => (
    <QueryClientProvider client={queryClient}>
      {records.map((place) => (
        <PlaceCard key={place.id} place={place} styles={{} as PlacesStyles}
          onOpenMap={openMap} onOpenTravel={openTravel} />
      ))}
    </QueryClientProvider>
  )
  const view = await render(cards(places))
  return { ...view, openTravel, openMap, cards, queryClient }
}

beforeEach(() => mockFetchWithTimeout.mockReset())

it('loads the selected place on the first arrow and pages photos and routes without changing the place or rating', async () => {
  const second = { ...RAW_LIBRARY_SOURCE_B, thumbnail_url: 'https://example.com/second.webp' }
  mockFetchWithTimeout
    .mockResolvedValueOnce(response({ results: [], next: '?cursor=next-page' }))
    .mockResolvedValueOnce(response({ results: [second], next: null }))
  const place = toPlace()
  const neighbor = toPlace({ id: 900, place_id: 'other-place' })
  const view = await renderCards([place, neighbor])
  const card = () => within(view.getByTestId(`places-card-slot-${place.id}`))

  expect(card().getByText('Материал 1 из 2')).toBeTruthy()
  expect(card().getByTestId(`place-discussion-${place.id}`)).toBeTruthy()
  expect(card().getByTestId('card-photo').props.children).toBe('https://example.com/first.webp')
  expect(mockFetchWithTimeout).not.toHaveBeenCalled()
  await fireEvent.press(card().getByLabelText('Следующий материал'))
  await waitFor(() => expect(card().getByText('Материал 2 из 2')).toBeTruthy())
  expect(card().getByText(second.article_title)).toBeTruthy()
  expect(card().getByTestId(`place-discussion-${place.id}`)).toBeTruthy()
  expect(card().getByTestId('card-photo').props.children).toBe(second.thumbnail_url)
  expect(card().getByText('Национальная библиотека')).toBeTruthy()
  expect(card().getByText('Минск, проспект Независимости 116')).toBeTruthy()
  await fireEvent.press(card().getByTestId('open-map'))
  expect(view.openMap).toHaveBeenLastCalledWith(expect.objectContaining({ coord: '53.93129,27.6459' }))
  expect(card().getByTestId(`places-rating-${place.id}`).props.children).toBe(`${place.id}:4.6:9`)
  await fireEvent.press(card().getByLabelText('Открыть статью'), { timeStamp: 1 })
  expect(view.openTravel).toHaveBeenLastCalledWith(second.article_url)

  await fireEvent.press(card().getByLabelText('Предыдущий материал'))
  expect(card().getByText('Материал 1 из 2')).toBeTruthy()
  expect(card().getByText(RAW_LIBRARY_SOURCE_A.article_title)).toBeTruthy()
  await fireEvent.press(card().getByLabelText('Открыть статью'), { timeStamp: 2 })
  expect(view.openTravel).toHaveBeenLastCalledWith(RAW_LIBRARY_SOURCE_A.article_url)

  await view.rerender(view.cards([neighbor]))
  await view.rerender(view.cards([place, neighbor]))
  await fireEvent.press(card().getByLabelText('Следующий материал'))
  expect(card().getByText('Материал 2 из 2')).toBeTruthy()
  const urls = mockFetchWithTimeout.mock.calls.map(([url]) => String(url))
  expect(urls).toHaveLength(2)
  expect(urls[0]).toContain(`/map/places/${LIBRARY_PLACE_UUID}/sources/`)
  expect(urls[1]).toContain(`/map/places/${LIBRARY_PLACE_UUID}/sources/?cursor=next-page`)
})

it('keeps the primary article usable through loading and failure and removes dead arrows after an empty retry', async () => {
  let finishRequest: ((value: ReturnType<typeof response>) => void) | undefined
  mockFetchWithTimeout.mockReturnValueOnce(new Promise((resolve) => { finishRequest = resolve }))
    .mockResolvedValueOnce(response({ results: [], next: null }))
  const view = await renderCards()

  await fireEvent.press(view.getByLabelText('Следующий материал'), { timeStamp: 1 })
  await waitFor(() => expect(view.getByText('Загрузка…')).toBeTruthy())
  await fireEvent.press(view.getByLabelText('Открыть статью'))
  expect(view.openTravel).toHaveBeenLastCalledWith(RAW_LIBRARY_SOURCE_A.article_url)
  finishRequest?.(response({}, 404))
  await waitFor(() => expect(view.getByText('Что-то пошло не так')).toBeTruthy())
  await fireEvent.press(view.getByLabelText('Открыть статью'))
  expect(view.openTravel).toHaveBeenLastCalledWith(RAW_LIBRARY_SOURCE_A.article_url)

  await fireEvent.press(view.getByLabelText('Следующий материал'), { timeStamp: 2 })
  await waitFor(() => expect(view.queryByLabelText('Следующий материал')).toBeNull())
  expect(view.getByTestId('card-photo').props.children).toBe('https://example.com/first.webp')
  expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2)
})

it.each([{ source_count: 1 }, { place_id: null }])('keeps a single article for %o', async (fields) => {
  const view = await renderCards([toPlace(fields)])
  expect(view.queryByLabelText('Следующий материал')).toBeNull()
  await fireEvent.press(view.getByLabelText('Открыть статью'))
  expect(view.openTravel).toHaveBeenLastCalledWith(RAW_LIBRARY_SOURCE_A.article_url)
  expect(mockFetchWithTimeout).not.toHaveBeenCalled()
})

it('refreshes the interacted place when article visibility changes', async () => {
  let finishRefresh: ((value: ReturnType<typeof response>) => void) | undefined
  mockFetchWithTimeout
    .mockResolvedValueOnce(response({ results: [RAW_LIBRARY_SOURCE_A, RAW_LIBRARY_SOURCE_B], next: null }))
    .mockReturnValueOnce(new Promise((resolve) => { finishRefresh = resolve }))
  const view = await renderCards([toPlace(), toPlace({ id: 900, place_id: 'other-place' })])
  const card = () => within(view.getByTestId(`places-card-slot-${RAW_LIBRARY_SOURCE_A.point_id}`))

  await fireEvent.press(card().getByLabelText('Следующий материал'))
  await waitFor(() => expect(card().getByText(RAW_LIBRARY_SOURCE_B.article_title)).toBeTruthy())
  await act(() => invalidateBlockSensitiveQueries(view.queryClient, 'block'))
  await waitFor(() => expect(card().getByText('Загрузка…')).toBeTruthy())
  expect(card().queryByText(RAW_LIBRARY_SOURCE_B.article_title)).toBeNull()
  await fireEvent.press(card().getByLabelText('Открыть статью'))
  expect(view.openTravel).toHaveBeenLastCalledWith(RAW_LIBRARY_SOURCE_A.article_url)

  finishRefresh?.(response({ results: [RAW_LIBRARY_SOURCE_A], next: null }))
  await waitFor(() => expect(card().queryByLabelText('Следующий материал')).toBeNull())
  expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2)
})
