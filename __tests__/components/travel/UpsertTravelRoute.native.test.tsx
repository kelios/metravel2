import { fireEvent, render, waitFor } from '@testing-library/react-native'

import UpsertTravelRoute from '@/components/travel/upsert/UpsertTravelRoute'

let mockUpsertImportShouldFail = false

jest.mock('@/components/travel/UpsertTravel', () => {
  const React = require('react')
  const { Text } = require('react-native')

  return {
    __esModule: true,
    default: () => {
      if (mockUpsertImportShouldFail) {
        throw new Error('Requiring unknown module 1234')
      }
      return <Text>UpsertTravel loaded</Text>
    },
  }
})

describe('native UpsertTravelRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpsertImportShouldFail = false
  })

  // #1039 — раньше native-ветка делала `if (!isFocused) return null`, из-за чего
  // форма мастера размонтировалась при потере фокуса экрана и терялся весь
  // введённый, но ещё не сохранённый стейт. Контракт выровнен с web: форма
  // остаётся смонтированной всегда.
  it('keeps the wizard mounted regardless of navigation focus', () => {
    const { queryByText } = render(<UpsertTravelRoute />)

    expect(queryByText('UpsertTravel loaded')).toBeTruthy()
  })

  it('loads the wizard behind an error boundary', async () => {
    const { queryByText } = render(<UpsertTravelRoute />)

    await waitFor(() => {
      expect(queryByText('UpsertTravel loaded')).toBeTruthy()
    })
    expect(queryByText('Попробовать снова')).toBeNull()
  })

  it('shows a recoverable error instead of hanging when the wizard fails to load', async () => {
    mockUpsertImportShouldFail = true

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { getByText, queryByText } = render(<UpsertTravelRoute />)

    await waitFor(() => {
      expect(getByText('Попробовать снова')).toBeTruthy()
    })
    expect(queryByText('Загрузка...')).toBeNull()

    mockUpsertImportShouldFail = false
    fireEvent.press(getByText('Попробовать снова'))

    await waitFor(() => {
      expect(queryByText('UpsertTravel loaded')).toBeTruthy()
    })

    consoleErrorSpy.mockRestore()
  })
})
