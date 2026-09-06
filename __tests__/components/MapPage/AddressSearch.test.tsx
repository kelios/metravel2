import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import AddressSearch from '@/components/MapPage/AddressSearch'
import { nominatimSearch } from '@/api/external/nominatim'
import type { SupportedLocale } from '@/i18n/config'
import { createQueryWrapper } from '../../helpers/testQueryClient'

let mockLocale: SupportedLocale = 'ru'

jest.mock('@/api/external/nominatim', () => ({ nominatimSearch: jest.fn() }))
// Проверяется реальный React Query cache и UI состояний; ожидание debounce
// остаётся обязанностью useDebouncedValue и не замедляет эти регрессии.
jest.mock('@/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }))
jest.mock('@/i18n', () => {
  const actual = jest.requireActual('@/i18n')
  return {
    ...actual,
    getActiveLocaleDefinition: () => actual.getLocaleDefinition(mockLocale),
    translate: (key: string) => key,
  }
})

const mockSearch = jest.mocked(nominatimSearch)
const result = (name: string) => ({
  place_id: '123',
  display_name: name,
  lat: '49.8209',
  lon: '18.2625',
})
const response = (results: ReturnType<typeof result>[]) =>
  ({ ok: true, json: async () => results }) as Response

describe('AddressSearch: результаты поиска точки маршрута', () => {
  let query: ReturnType<typeof createQueryWrapper>

  beforeEach(() => {
    mockLocale = 'ru'
    mockSearch.mockReset()
    query = createQueryWrapper()
  })

  // Размонтирование остаётся за авто-cleanup RNTL: он ждёт `unmountAsync`,
  // а синхронный `cleanup()` бросает тот же act и роняет следующий `render`.
  afterEach(() => {
    query.queryClient.clear()
  })

  it('разделяет ответы одного запроса по всем языкам и переиспользует кэш выбранного языка', async () => {
    mockSearch.mockImplementation(async (params) => response([result(`Ostrava (${params.acceptLanguage})`)]))

    // LocaleProvider пересоздаёт subtree при переключении языка; QueryClient
    // сохраняется. Повторный RU должен взять RU-кэш, а не последний EN-ответ.
    for (const locale of ['ru', 'be', 'uk', 'pl', 'en', 'ru'] as const) {
      mockLocale = locale
      const view = render(<AddressSearch placeholder="Search" onAddressSelect={jest.fn()} />, {
        wrapper: query.Wrapper,
      })
      fireEvent.changeText(view.getByPlaceholderText('Search'), 'Острава')
      await waitFor(() => expect(view.getByText(`Ostrava (${locale})`)).toBeTruthy())
      await view.unmountAsync()
    }

    expect(mockSearch).toHaveBeenCalledTimes(5)
    for (const locale of ['ru', 'be', 'uk', 'pl', 'en']) {
      expect(mockSearch).toHaveBeenCalledWith(
        { q: 'Острава', limit: 5, addressdetails: 1, acceptLanguage: locale },
        expect.objectContaining({
          signal: expect.anything(),
          headers: expect.objectContaining({ 'Accept-Language': locale }),
        }),
      )
    }
  })

  it('показывает пустой результат после предыдущего успешного поиска', async () => {
    mockSearch
      .mockResolvedValueOnce(response([result('Острава, Чехия')]))
      .mockResolvedValueOnce(response([]))
    const view = render(<AddressSearch placeholder="Search" onAddressSelect={jest.fn()} />, {
      wrapper: query.Wrapper,
    })

    fireEvent.changeText(view.getByPlaceholderText('Search'), 'Острава')
    await waitFor(() => expect(view.getByText('Острава, Чехия')).toBeTruthy())
    fireEvent.changeText(view.getByPlaceholderText('Search'), 'Неттакогоместа')

    await waitFor(() => expect(view.getByText(/nichego_ne_naydeno_po_zaprosu/)).toBeTruthy())
    expect(view.queryByText('Острава, Чехия')).toBeNull()
  })

  it('показывает отказ геокодера, повторяет поиск и отдаёт выбранные координаты', async () => {
    mockSearch
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(response([result('Острава, Чехия')]))
    const select = jest.fn()
    const view = render(<AddressSearch placeholder="Search" onAddressSelect={select} />, {
      wrapper: query.Wrapper,
    })

    fireEvent.changeText(view.getByPlaceholderText('Search'), 'Острава')
    await waitFor(() => expect(view.getByText(
      'map:components.MapPage.AddressSearch.ne_udalos_vypolnit_poisk_proverte_soedinenie_d006a955',
    )).toBeTruthy())
    fireEvent.press(view.getByLabelText('map:components.MapPage.AddressSearch.povtorit_poisk_6e2f285c'))
    await waitFor(() => expect(view.getByText('Острава, Чехия')).toBeTruthy())
    fireEvent.press(view.getByText('Острава, Чехия'))

    expect(mockSearch).toHaveBeenCalledTimes(2)
    expect(select).toHaveBeenCalledWith('Острава, Чехия', { lat: 49.8209, lng: 18.2625 })
  })
})
