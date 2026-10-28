import { act, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import WeatherWidget from '@/components/home/WeatherWidget'
import i18n from '@/i18n/instance'
import { translate } from '@/i18n'

describe('WeatherWidget', () => {
  const originalPlatform = Platform.OS
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useRealTimers()
    ;(Platform as any).OS = 'web'
    global.fetch = jest.fn()
  })

  afterEach(async () => {
    ;(Platform as any).OS = originalPlatform
    global.fetch = originalFetch
    jest.clearAllMocks()
    await act(async () => { await i18n.changeLanguage('ru') })
  })

  it('renders native fallback instead of blank content while loading', async () => {
    ;(Platform as any).OS = 'ios'
    global.fetch = jest.fn(() => new Promise(() => {})) as typeof fetch
    const { getByText } = await render(
      <WeatherWidget points={[{ coord: '53.9, 27.56', address: 'Минск' }]} countryName="BY" />
    )
    expect(getByText(/Погода в Минск, BY/)).toBeTruthy()
    expect(getByText(/Загружаем прогноз/)).toBeTruthy()
  })

  it('renders an error fallback for invalid coords', async () => {
    const { getByText } = await render(<WeatherWidget points={[{ coord: 'bad', address: 'Минск' }]} />)
    await waitFor(() => expect(getByText(/Не удалось загрузить прогноз/)).toBeTruthy())
  })

  it('renders forecast for valid coordinates', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          daily: {
            time: ['2024-01-01', '2024-01-02', '2024-01-03'],
            temperature_2m_max: [10.2, 3.5, -1],
            temperature_2m_min: [1.5, -2, -4],
            weather_code: [0, 85, 96],
          },
        }),
    })

    const { getByText, queryByText } = await render(
      <WeatherWidget
        points={[{ coord: '53.9, 27.56', address: 'Минск, Беларусь, Центр' }]}
        countryName="BY"
      />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })
    await waitFor(() => expect(getByText(/Погода в Минск, Беларусь, Центр, BY/)).toBeTruthy())
    await waitFor(() => expect(getByText('Ясно')).toBeTruthy())
    expect(getByText(/Гроза/)).toBeTruthy()
    expect(queryByText(/tooltip/i)).toBeNull()
  })

  it('keeps forecast for a fallback address and updates weather labels without a request or settle replay', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ daily: {
      time: ['2026-10-13'], temperature_2m_max: [15], temperature_2m_min: [5], weather_code: [0],
    } }) })
    const onSettled = jest.fn()
    const { getByText, queryByText } = await render(<WeatherWidget points={[{ coord: '53.9, 27.56' }]} onSettled={onSettled} />)
    await waitFor(() => expect(getByText('Ясно')).toBeTruthy())
    for (const locale of ['en', 'pl', 'ru'] as const) {
      await act(async () => { await i18n.changeLanguage(locale) })
      expect(getByText(translate('homeStatic:weather.clear'))).toBeTruthy()
      expect(queryByText(translate('home:components.home.WeatherWidget.zagruzhaem_prognoz_58fcfd93'))).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(onSettled).toHaveBeenCalledTimes(1)
    }
  })

  it('calls onSettled for invalid coords and again after a successful reload with new coords', async () => {
    const fetchMock = global.fetch as jest.Mock
    const onSettled = jest.fn()

    const { rerender } = await render(
      <WeatherWidget
        points={[{ coord: 'bad', address: 'Минск' }]}
        countryName="BY"
        onSettled={onSettled}
      />
    )

    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          daily: {
            time: ['2024-01-01', '2024-01-02', '2024-01-03'],
            temperature_2m_max: [8, 7, 6],
            temperature_2m_min: [1, 0, -1],
            weather_code: [1, 2, 3],
          },
        }),
    })

    await rerender(
      <WeatherWidget
        points={[{ coord: '53.9, 27.56', address: 'Минск, Беларусь, Центр' }]}
        countryName="BY"
        onSettled={onSettled}
      />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(2))
  })

  it('разбирает цепочку геокодера через « · » и не дублирует страну (#1750)', async () => {
    const { getByText } = await render(
      <WeatherWidget
        points={[{ coord: '50.6, 16.1', address: '30110 · Адршпа · Краловеградецкий край · Чехия' }]}
        countryName="Чехия"
      />,
    )
    // Номер дома/индекс не попадает в заголовок, страна не повторяется дважды.
    expect(getByText(/Погода в Адршпа, Краловеградецкий край, Чехия$/)).toBeTruthy()
  })
})
