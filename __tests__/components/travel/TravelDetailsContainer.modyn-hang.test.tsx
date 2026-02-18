/**
 * @jest-environment jsdom
 *
 * Regression test for the "travel details doesn't open on web view" issue on:
 * https://metravel.by/travels/modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029
 *
 * Root cause:
 * - We prefetch travel JSON in `app/+html.tsx` into `window.__metravelTravelPreload`,
 *   but it was previously consumed only inside the async `queryFn`.
 * - On some web navigations this meant `travel` stayed undefined long enough that the
 *   page appeared "stuck" (skeleton only / no hero content).
 *
 * This test ensures the preload is consumed synchronously as React Query `initialData`.
 */

import React from 'react'
import { Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

import { useTravelDetails } from '@/hooks/useTravelDetails'
import { normalizeTravelItem } from '@/api/travelsApi'

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => {
  const actual = jest.requireActual('@/api/travelsApi')
  return {
    ...actual,
    fetchTravel: jest.fn(() => {
      throw new Error('fetchTravel should not be called when preload exists')
    }),
    fetchTravelBySlug: jest.fn(() => {
      throw new Error('fetchTravelBySlug should not be called when preload exists')
    }),
  }
})

const useLocalSearchParams = jest.requireMock('expo-router').useLocalSearchParams as jest.Mock
const { fetchTravelBySlug, fetchTravel } = jest.requireMock('@/api/travelsApi') as {
  fetchTravelBySlug: jest.Mock
  fetchTravel: jest.Mock
}

// Minimal subset of API data from:
// /api/travels/by-slug/modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029/
const RAW_API_DATA = {
  id: 498,
  name: 'Модынь  - одна из самых высоких вершин Бескидов (1029)',
  url: '/travels/modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029',
  slug: 'modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029',
  description: [
    '<h2>Общая информация</h2>',
    '<ol>',
    '<li data-list="bullet"><span c"false"></span><strong>Гора:</strong> Модынь (Modyń)</li>',
    '<li data-list="bullet"><span c"false"></span><strong>Высота:</strong> 1029 м</li>',
    '</ol>',
    '<p><img src="http://metravel.by/travel-description-image/498/description/bcab181f64a5452698fde31b25c62911.png"></p>',
  ].join(''),
  year: '2025',
  youtube_link: '',
  countryName: 'Польша',
  countryCode: 'PL',
  number_days: 1,
  user: null as any,
  userIds: [1] as any,
  publish: true,
  moderation: true,
  recommendation: '<h2>Советы</h2><p>Проверь погоду и возьми воду.</p>',
  plus: '<h2>✅ Плюсы</h2><ul><li><strong>Красивая панорама</strong></li></ul>',
  minus: '<h2>⚠️ Минусы</h2><ul><li><strong>Нет туалетов</strong></li></ul>',
  travelAddress: [
    {
      id: 14652,
      lat: 49.625354,
      lng: 20.4106665,
      country: 160,
      address: 'Wierchowa Droga, Pod Modynią, Młyńczyska, gmina Łukowica',
      categories: [91],
    },
    {
      id: 14648,
      lat: 49.6210958,
      lng: 20.3754249,
      country: 160,
      address: 'Wieża widokowa na Modyni, Wierchowa Droga',
      categories: [82],
    },
  ],
  gallery: [
    {
      url: 'https://metravel.by/gallery/6874/conversions/fFz0aNfQziVLiZAcj7iNCS5pmVgY7AfFWQrZoGRc-detail_hd.jpg',
      id: 22,
    },
  ],
} as const

const setPlatformOs = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
}

describe('Travel details web preload (modyn)', () => {
  const originalPlatformOS = Platform.OS
  const originalPreload = (window as any).__metravelTravelPreload

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true })
    ;(window as any).__metravelTravelPreload = originalPreload
  })

  it('normalizes API response into a usable Travel object', () => {
    const normalized = normalizeTravelItem(RAW_API_DATA)
    expect(normalized).toBeTruthy()
    expect(normalized.id).toBe(498)
    expect(normalized.slug).toBe('modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029')
    // user is null in API, normalizeTravelItem should create one from userIds
    expect(normalized.user?.id).toBe(1)
  })

  it('consumes window preload as React Query initialData (no fetch)', async () => {
    setPlatformOs('web')
    useLocalSearchParams.mockReturnValue({ param: RAW_API_DATA.slug })

    ;(window as any).__metravelTravelPreload = {
      data: RAW_API_DATA,
      slug: RAW_API_DATA.slug,
      isId: false,
    }

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useTravelDetails(), { wrapper })

    await waitFor(() => {
      expect(result.current.travel?.id).toBe(498)
    })

    expect(result.current.isError).toBe(false)
    expect(fetchTravelBySlug).not.toHaveBeenCalled()
    expect(fetchTravel).not.toHaveBeenCalled()

    // Preload is consumed on first access to avoid stale data.
    expect((window as any).__metravelTravelPreload).toBeUndefined()
  })
})

