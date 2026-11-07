import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { normalizeTagSuggestions } from '@/api/aiTagSuggestions'
import TravelTagSuggestions, { dictionaryLabels } from '@/components/travel/upsert/TravelTagSuggestions'
import type { TravelFilters } from '@/types/types'

const mockUseSuggestions = jest.fn()
jest.mock('@/hooks/useTravelTagSuggestions', () => ({
  useTravelTagSuggestions: (...args: unknown[]) => mockUseSuggestions(...args),
}))

const mockTrack = jest.fn()
jest.mock('@/utils/analytics', () => ({ trackWizardEvent: (...args: unknown[]) => mockTrack(...args) }))

const filters: TravelFilters = {
  countries: [
    { country_id: '1', title_ru: 'Польша' },
    { country_id: '2', title_ru: 'Беларусь' },
  ],
  categories: [
    { id: '10', name: 'Горы' },
    { id: '11', name: 'Города' },
  ],
  transports: [{ id: '20', name: 'Авто' }],
  complexity: [],
  companions: [{ id: '30', name: 'С детьми' }],
  over_nights_stay: [{ id: '40', name: 'Отель' }],
  month: [],
}

const formData = { countries: ['2'], categories: [] as string[], transports: [] as string[], companions: [] as string[], over_nights_stay: [] as string[] }

const suggestions = (payload: Record<string, unknown>) => normalizeTagSuggestions(payload)

async function renderBlock(props: Partial<React.ComponentProps<typeof TravelTagSuggestions>> = {}) {
  const onApply = jest.fn()
  const utils = await render(<TravelTagSuggestions description="<p>текст</p>" formData={formData} filters={filters} onApply={onApply} {...props} />)
  return { ...utils, onApply }
}

beforeEach(() => {
  mockUseSuggestions.mockReset()
  mockTrack.mockReset()
})

describe('TravelTagSuggestions', () => {
  it('показывает чипы по полям с подписями словаря, уже выбранные и неизвестные id пропускает', async () => {
    mockUseSuggestions.mockReturnValue({ data: suggestions({ countries: [1, 2], categories: [10, 99], transports: [20], confidence: 0.7 }) })
    const { getByText, queryByText, queryByTestId, getByTestId } = await renderBlock()
    expect(mockUseSuggestions).toHaveBeenCalledWith('текст', { enabled: true })
    expect(getByText('Предложено по тексту')).toBeTruthy()
    expect(getByText('Польша')).toBeTruthy()
    expect(queryByText('Беларусь')).toBeNull()
    expect(getByText('Горы')).toBeTruthy()
    expect(queryByTestId('travel-tag-suggestions-chip-categories-99')).toBeNull()
    expect(getByTestId('travel-tag-suggestions-transports')).toBeTruthy()
    expect(queryByTestId('travel-tag-suggestions-companions')).toBeNull()
  })

  it('чип добавляет значение к выбранным, не снимая их, и пишет аналитику', async () => {
    mockUseSuggestions.mockReturnValue({ data: suggestions({ countries: [1], categories: [10, 11], confidence: 0.5 }) })
    const { getByTestId, onApply } = await renderBlock()
    await fireEvent.press(getByTestId('travel-tag-suggestions-chip-countries-1'))
    expect(onApply).toHaveBeenCalledWith('countries', ['2', '1'])
    await fireEvent.press(getByTestId('travel-tag-suggestions-chip-categories-11'))
    expect(onApply).toHaveBeenCalledWith('categories', ['11'])
    expect(mockTrack).toHaveBeenCalledWith('wizard_tag_suggestion_accepted', { field: 'countries', values: '1', count: 1, mode: 'chip', confidence: 0.5 })
  })

  it('«Принять все» применяет все поля разом', async () => {
    mockUseSuggestions.mockReturnValue({ data: suggestions({ countries: [1, 2], categories: [10, 11], over_nights_stay: [40], confidence: 0.9 }) })
    const { getByTestId, onApply } = await renderBlock()
    await fireEvent.press(getByTestId('travel-tag-suggestions-accept-all'))
    expect(onApply.mock.calls).toEqual([
      ['countries', ['2', '1']],
      ['categories', ['10', '11']],
      ['over_nights_stay', ['40']],
    ])
    expect(mockTrack).toHaveBeenCalledTimes(3)
    expect(mockTrack).toHaveBeenCalledWith('wizard_tag_suggestion_accepted', expect.objectContaining({ field: 'categories', count: 2, mode: 'all' }))
  })

  it('«Скрыть» прячет блок, выключает запрос и пишет отклонение', async () => {
    mockUseSuggestions.mockReturnValue({ data: suggestions({ categories: [10, 11], confidence: 0.4 }) })
    const { getByTestId, queryByTestId } = await renderBlock()
    await fireEvent.press(getByTestId('travel-tag-suggestions-dismiss'))
    expect(queryByTestId('travel-tag-suggestions')).toBeNull()
    expect(mockTrack).toHaveBeenCalledWith('wizard_tag_suggestion_dismissed', { remaining: 2, confidence: 0.4 })
    expect(mockUseSuggestions).toHaveBeenLastCalledWith('текст', { enabled: false })
  })

  it('пустой ответ, деградация, ошибка или всё уже выбрано — блока нет', async () => {
    const cases = [
      { data: undefined, error: new Error('x') },
      { data: suggestions({}) },
      { data: suggestions({ categories: [10], degraded: true }) },
      { data: suggestions({ countries: [2] }) },
    ]
    for (const value of cases) {
      mockUseSuggestions.mockReturnValue(value)
      const { queryByTestId, unmount } = await renderBlock()
      expect(queryByTestId('travel-tag-suggestions')).toBeNull()
      unmount()
    }
  })

  it('подписи словаря: страны по country_id, остальные по id, числа бэка — тоже', () => {
    const labels = dictionaryLabels({ ...filters, categories: [{ id: 7 as unknown as string, name: 'Лес' }] }, 'categories')
    expect(labels.get('7')).toBe('Лес')
    expect(dictionaryLabels(filters, 'countries').get('1')).toBe('Польша')
    expect(dictionaryLabels(null, 'countries').size).toBe(0)
  })
})
