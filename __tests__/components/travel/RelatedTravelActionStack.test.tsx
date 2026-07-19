import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'

const mockFavoriteButton = jest.fn((props: any) => React.createElement('favorite-button', props))
const mockStatusButton = jest.fn((props: any) => React.createElement('status-button', props))
const mockFetchTravel = jest.fn()
const mockFetchTravelBySlug = jest.fn()

jest.mock('@/components/travel/FavoriteButton', () => ({
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

  it('renders actions from fallbacks for numeric travel routes without fetching detail', async () => {
    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="/travel/42"
        fallbackTitle="Связанное путешествие"
        fallbackImageUrl="https://cdn.example.com/fallback.jpg"
        fallbackCountry="Беларусь"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    // id is known from the route, so no per-card travel-detail request is made
    expect(mockFetchTravel).not.toHaveBeenCalled()
    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockFavoriteButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: 42,
        title: 'Связанное путешествие',
        country: 'Беларусь',
      }),
    )
    expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        travelId: 42,
        travelTitle: 'Связанное путешествие',
        compact: true,
      }),
    )
  })

  it('does not fetch detail when slug route carries an ?id query', async () => {
    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="https://metravel.by/travels/ourvietnam?id=129"
        fallbackTitle="Вьетнам"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockFetchTravel).not.toHaveBeenCalled()
    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ travelId: 129, travelTitle: 'Вьетнам' }),
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

  it('renders inline status as an explicit travel-state action', async () => {
    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="/travel/42"
        fallbackTitle="Связанное путешествие"
        variant="inline"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        compact: false,
        idleLabel: 'Был / Хочу / Планирую',
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
