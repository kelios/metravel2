import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'

const mockFavoriteButton = jest.fn((props: any) => React.createElement('favorite-button', props))
const mockStatusButton = jest.fn((props: any) => React.createElement('status-button', props))
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
        relatedTravelId={129}
        fallbackTitle="Вьетнам"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockFavoriteButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: 129,
        url: '/travels/ourvietnam?id=129',
      }),
    )
    expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ travelId: 129, travelTitle: 'Вьетнам' }),
    )
  })

  it('uses a catalog travel id with a canonical slug route without resolving the slug', async () => {
    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="/travels/polish-camino"
        relatedTravelId={77}
        fallbackTitle="Камино"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockFavoriteButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: 77,
        url: '/travels/polish-camino',
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

  it('ignores a malformed explicit id and keeps the slug-only fallback', async () => {
    mockFetchTravelBySlug.mockResolvedValue({
      id: 77,
      name: 'Польское Камино',
      url: '/travels/polish-camino',
    })

    renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="/travels/polish-camino"
        relatedTravelId={Number.NaN}
        fallbackTitle="Камино"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockFetchTravelBySlug).toHaveBeenCalledTimes(1)
    expect(mockFetchTravelBySlug.mock.calls[0]?.[0]).toBe('polish-camino')
  })

  it('deduplicates concurrent slug-only fallbacks for the same travel identity', async () => {
    mockFetchTravelBySlug.mockResolvedValue({
      id: 77,
      name: 'Польское Камино',
      url: '/travels/polish-camino',
    })

    renderWithQuery(
      <>
        <RelatedTravelActionStack
          relatedTravelUrl="/travels/polish-camino"
          fallbackTitle="Камино, точка 1"
        />
        <RelatedTravelActionStack
          relatedTravelUrl="/travels/polish-camino"
          fallbackTitle="Камино, точка 2"
        />
      </>,
    )

    await waitFor(() => {
      expect(mockStatusButton.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    expect(mockFetchTravelBySlug).toHaveBeenCalledTimes(1)
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
    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockFavoriteButton).not.toHaveBeenCalled()
    expect(mockStatusButton).not.toHaveBeenCalled()
  })
})
