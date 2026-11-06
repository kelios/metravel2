import { apiClient } from '@/api/client'
import { fetchPlaceRequest, fetchPlaceRequests, parsePlaceRequest } from '@/api/placeRequests'

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }))

const request = {
  id: 'c79916ab-35d9-44e5-ad02-c9fb67979c14',
  place_id: 'ff3fe16a-591f-4f2c-bc3d-4688683ca09c',
  status: 'open',
  name: 'Здравнёво',
  address: 'Здравнёво, Витебский район',
  country: { id: 112, code: 'by' },
  region: 'vitebsk',
  category: { id: 1, name: 'Музей' },
  lat: 55.282832621,
  lng: 30.316337002,
  prompt: 'Что запомнилось в усадьбе?',
  preview: {
    url: 'https://media.example.org/photo.jpg',
    credit: 'Photo author',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source_url: 'https://media.example.org/item',
  },
}
const get = jest.mocked(apiClient.get)

beforeEach(() => get.mockReset())

it('uses the Belarus public endpoint and preserves canonical coordinates and licensed media', async () => {
  const signal = new AbortController().signal
  get.mockResolvedValue({ count: 1, results: [request] })
  await expect(fetchPlaceRequests('be', signal)).resolves.toEqual([expect.objectContaining({
    id: request.id, name: request.name, lat: request.lat, lng: request.lng, countryId: 112,
    preview: {
      url: request.preview.url, credit: request.preview.credit,
      sourceUrl: request.preview.source_url, licenseUrl: request.preview.license_url,
    },
  })])
  expect(get).toHaveBeenCalledWith('/places/requests/?country=by', undefined, {
    signal, skipAuth: true, headers: { 'Accept-Language': 'be' },
  })
})

it('rejects invalid location data and omits media without valid attribution', () => {
  expect(() => parsePlaceRequest({ ...request, lat: '55.281' })).toThrow('Invalid place request response')
  expect(() => parsePlaceRequest({ ...request, country: { id: 616, code: 'pl' } })).toThrow('Invalid place request response')
  expect(parsePlaceRequest({ ...request, preview: { ...request.preview, license_url: 'media.example.org/license' } }).preview).toBeNull()
  expect(parsePlaceRequest({ ...request, preview: { ...request.preview, license_url: 'https://creativecommons.org@untrusted.example/license' } }).preview).toBeNull()
})

it('requires the exact requested UUID and permits only canonical public story links', async () => {
  get.mockResolvedValue({ ...request, status: 'fulfilled', public_travel_url: '/travels/%D0%B3%D0%B8%D0%B4' })
  await expect(fetchPlaceRequest(request.id, 'uk')).resolves.toMatchObject({
    status: 'fulfilled', publicTravelUrl: '/travels/%D0%B3%D0%B8%D0%B4',
  })
  await expect(fetchPlaceRequest(request.place_id, 'uk')).rejects.toThrow('Mismatched place request id')
  expect(parsePlaceRequest({ ...request, public_travel_url: '/travels/%2e%2e%2fprofile' }).publicTravelUrl).toBeNull()
  expect(parsePlaceRequest({ ...request, public_travel_url: '%2Ftravels%2Fstory' }).publicTravelUrl).toBeNull()
})
