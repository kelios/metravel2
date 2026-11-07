/**
 * #2887: строка «Опишите, что ищете» на карте — применение JSON-фильтра к карте,
 * чипы «Понял так», «Сбросить» к прежним значениям, подсказка про constraints без
 * фильтра, отказ службы без потери строки и ручных фильтров.
 */
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AiMapIntentError } from '@/api/aiMapIntent'
import MapIntentRow, { focusZoomForRadius } from '@/components/MapPage/MapIntentRow'
import { OSM_POI_DEFAULT_CATEGORIES } from '@/components/MapPage/FiltersPanelMapSettings'
import { ThemeProvider } from '@/hooks/useTheme'

const mockFetchMapIntent = jest.fn()
jest.mock('@/api/aiMapIntent', () => ({
  ...jest.requireActual('@/api/aiMapIntent'),
  fetchMapIntent: (...args: unknown[]) => mockFetchMapIntent(...args),
}))
jest.mock('@/utils/aiPicksConfig', () => ({ ...jest.requireActual('@/utils/aiPicksConfig'), isAiPicksEnabled: () => true }))

const mockGeocode = jest.fn()
jest.mock('@/api/geoQueries', () => ({
  useLocationSearchQuery: (args: { query: string; enabled?: boolean }) => mockGeocode(args),
}))

const GOOD_INTENT = { categories: ['viewpoints', 'history'], radius_km: 60, center: { name: 'Несвиж' }, constraints: { camper: true, kids: true } }

function makeMapUiApi() {
  return {
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    centerOnUser: jest.fn(),
    fitToResults: jest.fn(),
    focusOnCoord: jest.fn(),
    exportGpx: jest.fn(),
    exportKml: jest.fn(),
    setBaseLayer: jest.fn(),
    setOverlayEnabled: jest.fn(),
    setOsmPoiCategories: jest.fn(),
  }
}

async function renderRow(overrides: Partial<React.ComponentProps<typeof MapIntentRow>> = {}) {
  const onFilterChange = jest.fn()
  const onOverlayToggle = jest.fn()
  const mapUiApi = makeMapUiApi()
  const props = {
    filterValue: { radius: '100', address: '' },
    onFilterChange,
    mapUiApi,
    enabledOverlays: { 'osm-poi': false },
    onOverlayToggle,
    ...overrides,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MapIntentRow {...props} />
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { ...utils, onFilterChange, onOverlayToggle, mapUiApi }
}

const submit = async (utils: Awaited<ReturnType<typeof renderRow>>, text = 'смотровые у Несвижа для кемпера') => {
  await fireEvent.changeText(utils.getByTestId('map-intent-input'), text)
  await fireEvent.press(utils.getByTestId('map-intent-submit'))
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  mockFetchMapIntent.mockReset()
  mockGeocode.mockReset()
  mockGeocode.mockImplementation(({ query, enabled }) => ({
    data: enabled && query ? [{ place_id: '1', display_name: 'Нясвіж', lat: '53.2226', lon: '26.6833' }] : undefined,
  }))
})

describe('MapIntentRow', () => {
  it('применяет ответ: радиус, слой POI с категориями, центр через геокод и чипы «Понял так»', async () => {
    mockFetchMapIntent.mockResolvedValue(GOOD_INTENT)
    const utils = await renderRow()
    await submit(utils)

    expect(mockFetchMapIntent).toHaveBeenCalledTimes(1)
    expect(mockFetchMapIntent.mock.calls[0][0]).toBe('смотровые у Несвижа для кемпера')
    expect(utils.onFilterChange).toHaveBeenCalledWith('radius', '50')
    expect(utils.onFilterChange).toHaveBeenCalledWith('address', 'Несвиж')
    expect(utils.onOverlayToggle).toHaveBeenCalledWith('osm-poi', true)
    expect(utils.mapUiApi.setOverlayEnabled).not.toHaveBeenCalled()
    expect(utils.mapUiApi.setOsmPoiCategories).toHaveBeenCalledWith(['viewpoints', 'history'])
    await waitFor(() => expect(utils.mapUiApi.focusOnCoord).toHaveBeenCalledWith('53.2226,26.6833', { zoom: 11 }))

    expect(utils.getByTestId('map-intent-applied')).toBeTruthy()
    expect(utils.getByText('Понял так:')).toBeTruthy()
    expect(utils.getByTestId('map-intent-chip-category-viewpoints')).toBeTruthy()
    expect(utils.getByText('Видовые места')).toBeTruthy()
    expect(utils.getByText('История')).toBeTruthy()
    expect(utils.getByText('Радиус 50 км')).toBeTruthy()
    expect(utils.getByText('Несвиж')).toBeTruthy()
    expect(utils.getByTestId('map-intent-constraints').props.children).toBe('Фильтра «на автодоме, с детьми» на карте пока нет')
    expect(utils.getByTestId('map-intent-input').props.value).toBe('смотровые у Несвижа для кемпера')
  })

  it('«Сбросить» возвращает прежние радиус, адрес, категории слоя и его состояние', async () => {
    mockFetchMapIntent.mockResolvedValue(GOOD_INTENT)
    const utils = await renderRow()
    await submit(utils)
    utils.onFilterChange.mockClear()
    utils.onOverlayToggle.mockClear()
    utils.mapUiApi.setOsmPoiCategories.mockClear()

    await fireEvent.press(utils.getByTestId('map-intent-reset'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(utils.onFilterChange).toHaveBeenCalledWith('radius', '100')
    expect(utils.onFilterChange).toHaveBeenCalledWith('address', '')
    expect(utils.mapUiApi.setOsmPoiCategories).toHaveBeenCalledWith([...OSM_POI_DEFAULT_CATEGORIES])
    expect(utils.onOverlayToggle).toHaveBeenCalledWith('osm-poi', false)
    expect(utils.queryByTestId('map-intent-applied')).toBeNull()
    expect(utils.getByTestId('map-intent-input').props.value).toBe('смотровые у Несвижа для кемпера')
  })

  it('второй запрос подряд: «Сбросить» ведёт к значениям до первого, слой не выключается, если был включён', async () => {
    mockFetchMapIntent.mockResolvedValueOnce(GOOD_INTENT).mockResolvedValueOnce({ categories: ['religion'], radius_km: 10, center: null, constraints: {} })
    const utils = await renderRow({ enabledOverlays: { 'osm-poi': true } })
    await submit(utils)
    await submit(utils, 'храмы рядом')
    expect(utils.onFilterChange).toHaveBeenLastCalledWith('radius', '10')
    expect(utils.queryByText('Несвиж')).toBeNull()
    expect(utils.getByText('Религия')).toBeTruthy()
    utils.onFilterChange.mockClear()
    utils.onOverlayToggle.mockClear()
    await fireEvent.press(utils.getByTestId('map-intent-reset'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(utils.onFilterChange).toHaveBeenCalledWith('radius', '100')
    expect(utils.onOverlayToggle).not.toHaveBeenCalled()
  })

  it('без контролируемых оверлеев слой включается через mapUiApi', async () => {
    mockFetchMapIntent.mockResolvedValue({ ...GOOD_INTENT, center: null, constraints: {} })
    const utils = await renderRow({ enabledOverlays: undefined, onOverlayToggle: undefined })
    await submit(utils)
    expect(utils.mapUiApi.setOverlayEnabled).toHaveBeenCalledWith('osm-poi', true)
    expect(utils.mapUiApi.focusOnCoord).not.toHaveBeenCalled()
    expect(utils.queryByTestId('map-intent-constraints')).toBeNull()
  })

  it('Enter в поле отправляет запрос', async () => {
    mockFetchMapIntent.mockResolvedValue(GOOD_INTENT)
    const utils = await renderRow()
    await fireEvent.changeText(utils.getByTestId('map-intent-input'), 'замки под Гродно')
    await fireEvent(utils.getByTestId('map-intent-input'), 'submitEditing')
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockFetchMapIntent).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['invalid', 422, 'map-intent-unavailable'],
    ['unavailable', 503, 'map-intent-unavailable'],
    ['limit', 429, 'map-intent-limit'],
  ])('отказ %s (%s): строка остаётся, подсказка, фильтры не тронуты', async (kind, status, hintTestId) => {
    mockFetchMapIntent.mockRejectedValue(new AiMapIntentError(kind as 'invalid', status))
    const utils = await renderRow()
    await submit(utils)
    expect(utils.getByTestId(hintTestId)).toBeTruthy()
    expect(utils.getByTestId('map-intent-input').props.value).toBe('смотровые у Несвижа для кемпера')
    expect(utils.onFilterChange).not.toHaveBeenCalled()
    expect(utils.onOverlayToggle).not.toHaveBeenCalled()
    expect(utils.mapUiApi.setOsmPoiCategories).not.toHaveBeenCalled()
    expect(utils.queryByTestId('map-intent-applied')).toBeNull()
  })

  it('короткий текст не отправляется', async () => {
    const utils = await renderRow()
    await submit(utils, 'ab')
    expect(mockFetchMapIntent).not.toHaveBeenCalled()
  })

  it('кадр по центру: зум 12 для радиуса 10 км, иначе 11 (minZoom слоя POI)', () => {
    expect(focusZoomForRadius('10')).toBe(12)
    expect(focusZoomForRadius('25')).toBe(11)
    expect(focusZoomForRadius('200')).toBe(11)
    expect(focusZoomForRadius(null)).toBe(11)
  })
})
