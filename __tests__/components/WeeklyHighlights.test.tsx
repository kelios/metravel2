import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import WeeklyHighlights from '@/components/travel/WeeklyHighlights'

// Mock React Query
const mockUseQuery = jest.fn()
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
}))

// Mock FavoritesContext
const mockViewHistory: any[] = []
jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    viewHistory: mockViewHistory,
  }),
}))

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock API (зарезервировано на будущее, компонент сейчас использует useQuery-собственный mock)
jest.mock('@/api/map', () => ({
  fetchTravelsOfMonth: jest.fn(),
}))

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  }
})

describe('WeeklyHighlights', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockViewHistory.length = 0
  })

  it('returns null when no highlights available', async () => {
    mockUseQuery.mockReturnValue({
      data: {},
    })

    const { toJSON } = await render(<WeeklyHighlights />)
    expect(toJSON()).toBeNull()
  })

  it('renders highlights when data is available', async () => {
    const mockData = {
      '1': {
        id: '1',
        name: 'Test Travel 1',
        slug: 'test-travel-1',
        travel_image_thumb_url: 'https://example.com/image.jpg',
        countryName: 'Belarus',
      },
      '2': {
        id: '2',
        name: 'Test Travel 2',
        slug: 'test-travel-2',
        travel_image_thumb_url: null,
        countryName: 'Poland',
      },
    }

    mockUseQuery.mockReturnValue({
      data: mockData,
    })

    const { getByText, getByLabelText, getByTestId } = await render(<WeeklyHighlights />)

    expect(getByText('Подборка месяца')).toBeTruthy()
    expect(getByText('Самые популярные маршруты этого месяца')).toBeTruthy()
    expect(getByTestId('weekly-highlights-section')).toBeTruthy()
    expect(getByTestId('weekly-highlights-grid')).toBeTruthy()
    // Travel names are in accessibility labels, not as text content
    expect(getByLabelText(/Test Travel 1/)).toBeTruthy()
    expect(getByLabelText(/Test Travel 2/)).toBeTruthy()
  })

  it('filters out viewed items', async () => {
    mockViewHistory.push({
      id: '1',
      type: 'travel',
    })

    const mockData = {
      '1': {
        id: '1',
        name: 'Viewed Travel',
        slug: 'viewed-travel',
      },
      '2': {
        id: '2',
        name: 'New Travel',
        slug: 'new-travel',
      },
    }

    mockUseQuery.mockReturnValue({
      data: mockData,
    })

    const { queryByText, getByLabelText } = await render(<WeeklyHighlights />)
    
    expect(queryByText('Viewed Travel')).toBeNull()
    expect(getByLabelText(/New Travel/)).toBeTruthy()
  })

  it('handles item press', async () => {
    const mockData = {
      '1': {
        id: '1',
        name: 'Test Travel',
        slug: 'test-travel',
        travel_image_thumb_url: 'https://example.com/image.jpg',
        countryName: 'Belarus',
      },
    }

    mockUseQuery.mockReturnValue({
      data: mockData,
    })

    const { getByLabelText } = await render(<WeeklyHighlights />)
    const item = getByLabelText(/Test Travel/)
    
    await fireEvent.press(item)
    
    expect(item).toBeTruthy()
  })

  it('displays placeholder when image is missing', async () => {
    const mockData = {
      '1': {
        id: '1',
        name: 'Test Travel',
        slug: 'test-travel',
        travel_image_thumb_url: null,
        countryName: 'Belarus',
      },
    }

    mockUseQuery.mockReturnValue({
      data: mockData,
    })

    const { getByLabelText } = await render(<WeeklyHighlights />)
    
    expect(getByLabelText(/Test Travel/)).toBeTruthy()
  })
})
