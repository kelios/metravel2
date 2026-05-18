import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'

const mockFavoriteButton = jest.fn((props: any) => React.createElement('favorite-button', props))
const mockStatusButton = jest.fn((props: any) => React.createElement('status-button', props))
const mockFetchTravel = jest.fn()
const mockFetchTravelBySlug = jest.fn()

jest.mock('@/components/travel/OptimizedFavoriteButton', () => ({
  __esModule: true,
  default: (props: any) => mockFavoriteButton(props),
}))

jest.mock('@/components/travel/TravelStatusButton', () => ({
  __esModule: true,
  default: (props: any) => mockStatusButton(props),
}))

jest.mock('@/api/travelDetailsQueries', () => ({
  fetchTravel: (...args: any[]) => mockFetchTravel(...args),
  fetchTravelBySlug: (...args: any[]) => mockFetchTravelBySlug(...args),
}))

jest.mock('@/utils/seo', () => ({
  getSiteBaseUrl: () => 'https://metravel.by',
}))

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('RelatedTravelActionStack', () => {
  beforeEach(() => {
    mockFavoriteButton.mockClear()
    mockStatusButton.mockClear()
    mockFetchTravel.mockReset()
    mockFetchTravelBySlug.mockReset()
  })

  it('renders favorite and planned actions for numeric travel routes', async () => {
    mockFetchTravel.mockResolvedValue({
      id: 42,
      name: 'Поход в Альпы',
      url: '/travels/alps-hike',
      travel_image_thumb_url: 'https://cdn.example.com/alps.jpg',
      countryName: 'Швейцария',
      cityName: 'Берн',
      year: '2026',
      monthName: 'Июль',
    })

    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="/travel/42"
        fallbackTitle="Связанное путешествие"
      />,
    )

    await waitFor(() => {
      expect(mockFavoriteButton.mock.calls.some(([props]) => props?.title === 'Поход в Альпы')).toBe(true)
      expect(mockStatusButton.mock.calls.some(([props]) => props?.travelTitle === 'Поход в Альпы')).toBe(true)
    })

    expect(mockFetchTravel.mock.calls[0]?.[0]).toBe(42)
    expect(mockFavoriteButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: 42,
        title: 'Поход в Альпы',
        url: '/travels/alps-hike',
        country: 'Швейцария',
      }),
    )
    expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        travelId: 42,
        travelTitle: 'Поход в Альпы',
        travelUrl: '/travels/alps-hike',
        travelYear: '2026',
        travelMonthName: 'Июль',
        compact: true,
      }),
    )
  })

  it('resolves slug routes before rendering actions', async () => {
    mockFetchTravelBySlug.mockResolvedValue({
      id: 77,
      name: 'Польское Камино',
      url: '/travels/polish-camino',
      travel_image_thumb_url: 'https://cdn.example.com/camino.jpg',
      countryName: 'Польша',
      cityName: 'Краков',
      year: '2025',
      monthName: 'Сентябрь',
    })

    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="https://metravel.by/travels/polish-camino"
        fallbackTitle="Камино"
        fallbackCountry="Польша"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockFetchTravelBySlug.mock.calls[0]?.[0]).toBe('polish-camino')
    expect(mockFavoriteButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: 77,
        title: 'Польское Камино',
        url: '/travels/polish-camino',
      }),
    )
  })

  it('does not render actions for non-metravel or non-travel urls', () => {
    const view = renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="https://example.com/place/123"
        fallbackTitle="Внешняя ссылка"
      />,
    )

    expect(view.toJSON()).toBeNull()
    expect(mockFetchTravel).not.toHaveBeenCalled()
    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockFavoriteButton).not.toHaveBeenCalled()
    expect(mockStatusButton).not.toHaveBeenCalled()
  })
})
