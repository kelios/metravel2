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

const renderWithQuery = async (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return await render(
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
    await renderWithQuery(
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

  // #1960: backend (#1961) снимет `?id=` с `urlTravel`, id приходит отдельным полем.
  it('does not fetch detail for a query-less slug url when the API id is explicit', async () => {
    await renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="https://metravel.by/travels/ourvietnam"
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
        url: '/travels/ourvietnam',
      }),
    )
    expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ travelId: 129, travelTitle: 'Вьетнам' }),
    )
  })

  it('keeps the legacy ?id query as a fallback when no explicit id is passed', async () => {
    await renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="https://metravel.by/travels/ourvietnam?id=129"
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
  })

  it('renders from the explicit id without fetching when the url host is the API host', async () => {
    // Локальный/dev API строит `urlTravel` от своего хоста — url-разбор такую
    // ссылку отбрасывает, а явный id остаётся достаточным без запроса статьи.
    await renderWithQuery(
      <RelatedTravelActionStack
        relatedTravelUrl="http://localhost:8000/travels/ourvietnam"
        relatedTravelId={129}
        fallbackTitle="Вьетнам"
      />,
    )

    await waitFor(() => {
      expect(mockStatusButton).toHaveBeenCalled()
    })

    expect(mockFetchTravelBySlug).not.toHaveBeenCalled()
    expect(mockFavoriteButton.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ id: 129, url: '/travels/129' }),
    )
  })

  it('uses a catalog travel id with a canonical slug route without resolving the slug', async () => {
    await renderWithQuery(
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

    await renderWithQuery(
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

    await renderWithQuery(
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

    await renderWithQuery(
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
    await renderWithQuery(
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

  it('does not render actions for non-metravel or non-travel urls', async () => {
    const view = await renderWithQuery(
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

  // 08.11.2026: ♥ на фото места сохранял статью, и все точки одной статьи
  // загорались разом. С `placeSave` ♥ — точка в «Мои точки», статус — статья.
  describe('placeSave (♥ = this place)', () => {
    const { fireEvent } = require('@testing-library/react-native')
    // jsdom-ветка ♥ — web-хит-зона с onClick/aria-*; `press` RNTL ушёл бы в
    // onPress композита в обход проверки disabled, поэтому шлём именно click.
    const click = (el: any) => fireEvent(el, 'click', { stopPropagation() {}, preventDefault() {} })

    it('two places of ONE article keep independent hearts; tap saves only its point', async () => {
      const zooToggle = jest.fn()
      const telescopeToggle = jest.fn()
      const screen = await renderWithQuery(
        <>
          <RelatedTravelActionStack
            relatedTravelUrl="/travels/568"
            fallbackTitle="Краков"
            placeSave={{ isSaved: true, onToggle: zooToggle }}
          />
          <RelatedTravelActionStack
            relatedTravelUrl="/travels/568"
            fallbackTitle="Краков"
            placeSave={{ isSaved: false, onToggle: telescopeToggle }}
          />
        </>,
      )

      expect(mockFavoriteButton).not.toHaveBeenCalled()
      const hearts = screen.getAllByTestId('place-save-heart')
      expect(hearts).toHaveLength(2)
      expect(hearts[0].props['aria-pressed']).toBe(true)
      expect(hearts[1].props['aria-pressed']).toBe(false)
      expect(hearts[1].props['aria-label']).toBe('Сохранить в «Мои точки»')

      click(hearts[1])
      expect(telescopeToggle).toHaveBeenCalledTimes(1)
      expect(zooToggle).not.toHaveBeenCalled()

      // Статус поездки по-прежнему про статью.
      expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ travelId: 568 }))
    })

    it('renders the place heart without a related article and skips the status', async () => {
      const onToggle = jest.fn()
      const screen = await renderWithQuery(
        <RelatedTravelActionStack fallbackTitle="Точка" placeSave={{ isSaved: false, onToggle }} />,
      )
      expect(screen.getByTestId('place-save-heart')).toBeTruthy()
      expect(mockStatusButton).not.toHaveBeenCalled()
    })

    it('statusOnly renders just the trip status under the «Статус поездки» label', async () => {
      const screen = await renderWithQuery(
        <RelatedTravelActionStack relatedTravelUrl="/travels/568" fallbackTitle="Краков" statusOnly />,
      )
      expect(screen.queryByTestId('place-save-heart')).toBeNull()
      expect(mockFavoriteButton).not.toHaveBeenCalled()
      expect(mockStatusButton.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ travelId: 568 }))
    })

    it('a disabled heart (auth or «Мои точки» not ready) does not toggle', async () => {
      const onToggle = jest.fn()
      const screen = await renderWithQuery(
        <RelatedTravelActionStack
          relatedTravelUrl="/travels/568"
          fallbackTitle="Краков"
          placeSave={{ isSaved: false, onToggle, disabled: true }}
        />,
      )
      click(screen.getByTestId('place-save-heart'))
      expect(onToggle).not.toHaveBeenCalled()
    })
  })
})
