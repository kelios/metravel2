import { render, waitFor } from '@testing-library/react-native'
import { useIsFocused } from 'expo-router'

import UpsertTravelRoute from '@/components/travel/upsert/UpsertTravelRoute'

jest.mock('expo-router', () => ({
  useIsFocused: jest.fn(),
}))

jest.mock('@/components/travel/UpsertTravel', () => {
  const React = require('react')
  const { Text } = require('react-native')

  return {
    __esModule: true,
    default: () => <Text>UpsertTravel loaded</Text>,
  }
})

const useIsFocusedMock = useIsFocused as jest.Mock

describe('native UpsertTravelRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not mount the wizard when route is not focused', () => {
    useIsFocusedMock.mockReturnValue(false)

    const { queryByText } = render(<UpsertTravelRoute />)

    expect(queryByText('Загрузка...')).toBeNull()
    expect(queryByText('UpsertTravel loaded')).toBeNull()
  })

  it('loads the wizard behind a Suspense boundary when focused', async () => {
    useIsFocusedMock.mockReturnValue(true)

    const { getByText, queryByText } = render(<UpsertTravelRoute />)

    expect(getByText('Загрузка...')).toBeTruthy()

    await waitFor(() => {
      expect(queryByText('UpsertTravel loaded')).toBeTruthy()
    })
  })
})
