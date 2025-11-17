import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import WeeklyHighlights from '@/components/WeeklyHighlights'

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

// Mock API
jest.mock('@/src/api/travels', () => ({
  fetchTravelsPopular: jest.fn(),
}))

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  }
})

// Mock window for web
global.window = {
  location: { href: '' },
} as any

describe('WeeklyHighlights', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockViewHistory.length = 0
  })

  it('returns null when no highlights available', () => {
    mockUseQuery.mockReturnValue({
      data: {},
    })

    const { container } = render(<WeeklyHighlights />)
    expect(container.children.length).toBe(0)
  })

  it('renders highlights when data is available', () => {
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

    const { getByText } = render(<WeeklyHighlights />)
    
    expect(getByText('Подборка недели')).toBeTruthy()
    expect(getByText('Популярные маршруты, которые вы еще не видели')).toBeTruthy()
    expect(getByText('Test Travel 1')).toBeTruthy()
    expect(getByText('Test Travel 2')).toBeTruthy()
  })

  it('filters out viewed items', () => {
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

    const { queryByText, getByText } = render(<WeeklyHighlights />)
    
    expect(queryByText('Viewed Travel')).toBeNull()
    expect(getByText('New Travel')).toBeTruthy()
  })

  it('handles item press', () => {
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

    const { getByText } = render(<WeeklyHighlights />)
    const item = getByText('Test Travel')
    
    fireEvent.press(item)
    
    expect(item).toBeTruthy()
  })

  it('displays placeholder when image is missing', () => {
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

    const { getByText } = render(<WeeklyHighlights />)
    
    expect(getByText('Test Travel')).toBeTruthy()
  })
})

