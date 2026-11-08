import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlaceRequest } from '@/api/placeRequests'
import PlaceRequestCard from '@/components/places/PlaceRequestCard'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@expo/vector-icons/Feather', () => () => null)
jest.mock('@/hooks/useTrackedImpression', () => ({
  useTrackedImpression: () => ({ ref: undefined, onLayout: undefined }),
}))
jest.mock('@/utils/placeContributionAnalytics', () => ({ trackPlaceContribution: jest.fn() }))

const request: PlaceRequest = {
  id: '89b3aaf4-7590-5e29-af5a-ecb918dd96f1',
  status: 'open',
  placeId: '3b9fd4c1-12f7-5792-ba43-1e08e334a358',
  name: 'Дворец Булгаков в Жиличах',
  address: 'Жиличи',
  countryId: 3,
  region: 'mogilev',
  categoryId: 33,
  categoryName: 'Дворец',
  lat: 53.155767,
  lng: 29.689178,
  prompt: 'Что запомнилось во дворце?',
  description: 'Дворец построен в стиле классицизма.',
  preview: null,
  publicTravelUrl: null,
}

beforeEach(() => mockPush.mockReset())

it('clamps the place history in a collection and opens the place view on demand', async () => {
  const onReadMore = jest.fn()
  const view = await render(
    <PlaceRequestCard request={request} regionLabel="Могилёвская область" source="places" onReadMore={onReadMore} />,
  )
  expect(view.getByText(request.description).props.numberOfLines).toBe(4)
  await fireEvent.press(view.getByTestId(`place-request-read-more-${request.id}`))
  expect(onReadMore).toHaveBeenCalledTimes(1)
})

it('shows the full history in the place view and leads with the full trip story', async () => {
  const view = await render(<PlaceRequestCard request={request} regionLabel="Жиличи" source="map" />)
  expect(view.getByText(request.description).props.numberOfLines).toBeUndefined()
  expect(view.queryByTestId(`place-request-read-more-${request.id}`)).toBeNull()
  await fireEvent.press(view.getByText('Рассказать о поездке'))
  // The full article is the editor's default format; only the note carries `mode=note`.
  expect(mockPush).toHaveBeenCalledWith(`/travel/new?place_request_id=${request.id}&contribution_source=map`)
  await fireEvent.press(view.getByText('Короткая заметка с фото'))
  expect(mockPush).toHaveBeenLastCalledWith(expect.stringContaining('mode=note'))
})

it('keeps the invitation usable before the history is filled in', async () => {
  const view = await render(
    <PlaceRequestCard request={{ ...request, description: '' }} regionLabel="Жиличи" source="places" onReadMore={jest.fn()} />,
  )
  expect(view.queryByText('О месте')).toBeNull()
  expect(view.getByText(request.prompt)).toBeTruthy()
  expect(view.getByText('Короткая заметка с фото')).toBeTruthy()
})
