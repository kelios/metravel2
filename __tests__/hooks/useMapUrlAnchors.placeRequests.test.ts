import { renderHook } from '@testing-library/react-native'

import { useMapUrlAnchors } from '@/hooks/map/useMapUrlAnchors'

let mockParams: Record<string, string | string[]> = {}

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }))
jest.mock('@/utils/placeRequestsConfig', () => ({ isPlaceRequestsPilotEnabled: () => true }))

const campaignId = '89b3aaf4-7590-5e29-af5a-ecb918dd96f1'

it('ignores supplied coordinates, ordinary-place selection and filter hints on a campaign link', async () => {
  mockParams = {
    place_request_id: campaignId.toUpperCase(), lat: '1', lng: '2',
    placeTitle: 'Wrong', focusPlace: '1', categories: 'category', radius: '5',
  }
  const { result } = await renderHook(useMapUrlAnchors)
  expect(result.current.placeRequestId).toBe(campaignId)
  expect(result.current.urlCoordinates).toBeNull()
  expect(result.current.urlSelectedPlace).toBeNull()
  expect(result.current.initialCategories).toBeUndefined()
  expect(result.current.initialRadius).toBeUndefined()
})

it('keeps the ordinary deep-link contract', async () => {
  mockParams = { lat: '53.4', lng: '29.6', placeTitle: 'Ordinary place', focusPlace: '1', radius: '5' }
  const { result } = await renderHook(useMapUrlAnchors)
  expect(result.current.placeRequestId).toBeNull()
  expect(result.current.urlCoordinates).toEqual({ latitude: 53.4, longitude: 29.6 })
  expect(result.current.urlSelectedPlace?.address).toBe('Ordinary place')
  expect(result.current.shouldFocusUrlPlace).toBe(true)
  expect(result.current.initialRadius).toBe('5')
})
