import { fireEvent, render } from '@testing-library/react-native'

import UpsertTravelRoute, { resolveUpsertTravelEntryKey } from '@/components/travel/upsert/UpsertTravelRoute'

let mockParams: Record<string, unknown> = {}
const mockMount = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
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
    mockMount.mockClear()
  })

  it('remounts the wizard when another create entry opens the same tab screen', () => {
    const view = render(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(1)
    fireEvent.changeText(view.getByTestId('draft'), 'full draft')

    mockParams = { mode: 'note' }
    view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('draft').props.value).toBe('')

    mockParams = { mode: 'note', source_travel_id: '42', place: 'Гродно' }
    view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(3)

    fireEvent.changeText(view.getByTestId('draft'), 'note draft')
    mockParams = {}
    view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(4)
    expect(view.getByTestId('draft').props.value).toBe('')
  })

  it('keeps the form when the created id is written into the URL or unknown params change', () => {
    mockParams = { mode: 'note', source_travel_id: '42' }
    const view = render(<UpsertTravelRoute />)
    fireEvent.changeText(view.getByTestId('draft'), 'unsaved words')

    mockParams = { mode: 'note', source_travel_id: '42', id: '501' }
    view.rerender(<UpsertTravelRoute />)
    mockParams = { mode: 'note', source_travel_id: '42', id: '501', utm_source: 'x' }
    view.rerender(<UpsertTravelRoute />)

    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('unsaved words')
  })

  it('keeps unsaved input when equivalent article context is normalized', () => {
    mockParams = { mode: 'note', source_travel_id: '42', country: 'by', place: '  Старый   замок  ' }
    const view = render(<UpsertTravelRoute />)
    fireEvent.changeText(view.getByTestId('draft'), 'unsaved words')

    mockParams = { mode: ['note'], source_travel_id: 42, country: 'BY', place: 'Старый замок' }
    view.rerender(<UpsertTravelRoute />)

    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('unsaved words')
  })

  it.each(['note', 'full'])('starts a fresh %s after leaving the saved record for the same create entry', (mode) => {
    mockParams = { mode }
    const view = render(<UpsertTravelRoute />)
    fireEvent.changeText(view.getByTestId('draft'), 'saved record')

    mockParams = { mode, id: '501' }
    view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('draft').props.value).toBe('saved record')

    mockParams = { mode }
    view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('draft').props.value).toBe('')

    fireEvent.changeText(view.getByTestId('draft'), 'second record')
    mockParams = { mode, id: '502' }
    view.rerender(<UpsertTravelRoute />)
    expect(mockMount).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('draft').props.value).toBe('second record')
  })

  it('treats anything but an exact note mode as the full wizard', () => {
    expect(resolveUpsertTravelEntryKey({})).toBe('/travel/new')
    expect(resolveUpsertTravelEntryKey({ mode: 'full' })).toBe('/travel/new')
    expect(resolveUpsertTravelEntryKey({ mode: 'NOTE' })).toBe('/travel/new')
    expect(resolveUpsertTravelEntryKey({ mode: 'note', id: '7' })).toBe('/travel/new?mode=note')
  })
})
