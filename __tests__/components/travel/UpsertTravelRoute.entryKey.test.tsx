import { fireEvent, render } from '@testing-library/react-native'

import UpsertTravelRoute, { resolveUpsertTravelEntryKey } from '@/components/travel/upsert/UpsertTravelRoute'

let mockParams: Record<string, unknown> = {}
let mockUserId: string | null = null
let mockPilotEnabled = true
const mockMount = jest.fn()
const mockPush = jest.fn()
const mockUsePlaceRequest = jest.fn()
const requestId = 'c79916ab-35d9-44e5-ad02-c9fb67979c14'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ userId: mockUserId, isAuthenticated: mockUserId !== null }),
}))
jest.mock('@/hooks/usePlaceRequests', () => ({
  usePlaceRequest: (...args: unknown[]) => mockUsePlaceRequest(...args),
}))
jest.mock('@/utils/placeRequestsConfig', () => ({
  isPlaceRequestsPilotEnabled: () => mockPilotEnabled,
}))

jest.mock('@/components/travel/UpsertTravel', () => {
  const React = require('react')
  const { Text, TextInput, View } = require('react-native')
  return {
    __esModule: true,
    default: function MockUpsertTravel() {
      const [draft, setDraft] = React.useState('')
      React.useEffect(() => { mockMount() }, [])
      return <View><Text>wizard</Text><TextInput testID="draft" value={draft} onChangeText={setDraft} /></View>
    },
  }
})

// #2829: экран вкладки /travel/new переиспользуется, а контроллер читает режим и
// контекст статьи один раз — другой вход обязан пересоздать форму.
describe('UpsertTravelRoute entry key', () => {
  beforeEach(() => {
    mockParams = {}
    mockUserId = null
    mockPilotEnabled = true
    mockMount.mockClear()
    mockPush.mockClear()
    mockUsePlaceRequest.mockReset()
    mockUsePlaceRequest.mockReturnValue({ isSuccess: true, data: { status: 'open' } })
  })

  it('remounts the wizard when another create entry opens the same tab screen', async () => {
    const view = await render(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(1)
    await fireEvent.changeText(view.getByTestId('draft'), 'full draft')

    mockParams = { mode: 'note' }
    await view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('draft').props.value).toBe('')

    mockParams = { mode: 'note', source_travel_id: '42', place: 'Гродно' }
    await view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(3)

    await fireEvent.changeText(view.getByTestId('draft'), 'note draft')
    mockParams = {}
    await view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(4)
    expect(view.getByTestId('draft').props.value).toBe('')
  })

  it('keeps the form when the created id is written into the URL or unknown params change', async () => {
    mockParams = { mode: 'note', source_travel_id: '42' }
    const view = await render(<UpsertTravelRoute />)
    await fireEvent.changeText(view.getByTestId('draft'), 'unsaved words')

    mockParams = { mode: 'note', source_travel_id: '42', id: '501' }
    await view.rerender(<UpsertTravelRoute />)
    mockParams = { mode: 'note', source_travel_id: '42', id: '501', utm_source: 'x' }
    await view.rerender(<UpsertTravelRoute />)

    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('unsaved words')
  })

  it('keeps unsaved input when equivalent article context is normalized', async () => {
    mockParams = { mode: 'note', source_travel_id: '42', country: 'by', place: '  Старый   замок  ' }
    const view = await render(<UpsertTravelRoute />)
    await fireEvent.changeText(view.getByTestId('draft'), 'unsaved words')

    mockParams = { mode: ['note'], source_travel_id: 42, country: 'BY', place: 'Старый замок' }
    await view.rerender(<UpsertTravelRoute />)

    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('unsaved words')
  })

  it.each(['note', 'full'])('starts a fresh %s after leaving the saved record for the same create entry', async (mode) => {
    mockParams = { mode }
    const view = await render(<UpsertTravelRoute />)
    await fireEvent.changeText(view.getByTestId('draft'), 'saved record')

    mockParams = { mode, id: '501' }
    await view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('saved record')

    mockParams = { mode, id: undefined }
    await view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('draft').props.value).toBe('')

    await fireEvent.changeText(view.getByTestId('draft'), 'second record')
    mockParams = { mode, id: '502' }
    await view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('draft').props.value).toBe('second record')
  })

  it('keys an invitation by the request and format but keeps the first saved id in the same session', () => {
    const entry = { mode: 'note', place_request_id: requestId, contribution_source: 'map' }
    const key = resolveUpsertTravelEntryKey(entry)
    expect(key).toBe(`/travel/new?mode=note&place_request_id=${requestId}&contribution_source=map`)
    expect(resolveUpsertTravelEntryKey({ ...entry, id: '7' })).toBe(key)
    expect(resolveUpsertTravelEntryKey({ ...entry, mode: 'full' })).not.toBe(key)
    expect(resolveUpsertTravelEntryKey({ ...entry, place_request_id: [requestId, requestId] })).toBe('/travel/new?invalid-place-request')
  })

  it('rechecks an invitation on auth return and offers the public article if it closed', async () => {
    mockParams = { mode: 'note', place_request_id: requestId }
    const view = await render(<UpsertTravelRoute />)
    expect(view.getByTestId('draft')).toBeTruthy()

    mockUserId = '42'
    mockUsePlaceRequest.mockReturnValue({ isSuccess: true, isFetching: true, data: { status: 'open' } })
    await view.rerender(<UpsertTravelRoute />)
    expect(view.queryByTestId('draft')).toBeNull()

    mockUsePlaceRequest.mockReturnValue({ isSuccess: true, data: { status: 'fulfilled', publicTravelUrl: '/travels/public-story' } })
    await view.rerender(<UpsertTravelRoute />)
    expect(view.queryByTestId('draft')).toBeNull()
    await fireEvent.press(view.getByText('Читать историю'))
    expect(mockPush).toHaveBeenCalledWith('/travels/public-story')
  })

  it('keeps the same saved editor after the invitation closes, and opens the record after rollback', async () => {
    mockUserId = '42'
    mockParams = { mode: 'note', place_request_id: requestId }
    const view = await render(<UpsertTravelRoute />)
    await fireEvent.changeText(view.getByTestId('draft'), 'saved invitation')

    mockParams = { ...mockParams, id: '501' }
    mockUsePlaceRequest.mockReturnValue({ isSuccess: true, data: { status: 'paused' } })
    await view.rerender(<UpsertTravelRoute />)
    expect(mockUsePlaceRequest).toHaveBeenLastCalledWith(requestId, false)
    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('saved invitation')

    mockPilotEnabled = false
    await view.rerender(<UpsertTravelRoute />)
    expect(view.getByTestId('draft')).toBeTruthy()
  })

  it('treats anything but an exact note mode as the full wizard', () => {
    expect(resolveUpsertTravelEntryKey({})).toBe('/travel/new')
    expect(resolveUpsertTravelEntryKey({ mode: 'full' })).toBe('/travel/new')
    expect(resolveUpsertTravelEntryKey({ mode: 'NOTE' })).toBe('/travel/new')
    expect(resolveUpsertTravelEntryKey({ mode: 'note', id: '7' })).toBe('/travel/new?mode=note')
  })
})
