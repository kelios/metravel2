import { render, fireEvent } from '@testing-library/react-native'

jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: { radii: { sm: 8, md: 12, lg: 16, pill: 999 } },
}))

const mockSetAudience = jest.fn()
let mockHookState = {
  settings: {
    trips: 'all',
    routes: 'all',
    social: 'registered',
    achievements: 'all',
    visited_places: 'all',
  },
  isLoading: false,
  isError: false,
  isSaving: false,
  setAudience: mockSetAudience,
  refetch: jest.fn(),
}
jest.mock('@/hooks/usePrivacySettings', () => ({
  usePrivacySettings: () => mockHookState,
}))

import PrivacySettingsMatrix from '@/components/settings/PrivacySettingsMatrix'

beforeEach(() => {
  jest.clearAllMocks()
  mockHookState = { ...mockHookState, isLoading: false, settings: { ...mockHookState.settings } }
})

describe('PrivacySettingsMatrix', () => {
  it('renders a row for every content type', () => {
    const { getByText } = render(<PrivacySettingsMatrix />)
    expect(getByText('Путешествия')).toBeTruthy()
    expect(getByText('Маршруты')).toBeTruthy()
    expect(getByText('Контакты и соцсети')).toBeTruthy()
    expect(getByText('Достижения')).toBeTruthy()
    expect(getByText('Посещённые места')).toBeTruthy()
  })

  it('calls setAudience with the chosen content type + audience', () => {
    const { getAllByText } = render(<PrivacySettingsMatrix />)
    // "Только я" appears once per content-type row; pressing the first toggles trips.
    fireEvent.press(getAllByText('Только я')[0])
    expect(mockSetAudience).toHaveBeenCalledWith('trips', 'only_me')
  })

  it('shows a spinner while loading', () => {
    mockHookState.isLoading = true
    const { queryByText } = render(<PrivacySettingsMatrix />)
    expect(queryByText('Путешествия')).toBeNull()
  })
})
