import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import BelkrajWidget from '@/components/belkraj/BelkrajWidget.android'
import { loadBelkrajNativeData, type BelkrajNativeData } from '@/components/belkraj/belkrajNativeData.native'
import { openExternalUrl } from '@/utils/externalLinks'

jest.mock('@/components/belkraj/belkrajNativeData.native', () => ({ loadBelkrajNativeData: jest.fn() }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn(async () => true) }))
jest.mock('@/components/ui/ImageCardMedia', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: (props: unknown) => <View {...(props as object)} /> }
})

const mockLoad = loadBelkrajNativeData as jest.MockedFunction<typeof loadBelkrajNativeData>
const mockOpen = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>
const minskPoints = [{ id: 1, address: 'Минск', coord: '53.9,27.56' }]
const warsawPoints = [{ id: 2, address: 'Варшава', lat: 52.2297, lng: 21.0122 }]
const selection: BelkrajNativeData = {
  title: 'Популярные экскурсии в Минске',
  listLabel: 'Все экскурсии в Минске',
  listUrl: 'https://belkraj.by/tours/minsk?partner=u180793',
  cards: [{
    title: 'Минск: прогулка по старому городу',
    url: 'https://belkraj.by/tour/minsk?partner=u180793',
    imageUrl: 'https://belkraj.by/images/minsk.jpg',
    subtitle: 'Индивидуальная экскурсия · 2 часа',
    rating: '4.9 (12 отзывов)',
  }],
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('BelkrajWidget.android — in-app excursions', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'production'
    mockLoad.mockResolvedValue(selection)
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
    jest.useRealTimers()
  })

  it.each(['android'])('shows excursion content on %s and opens the selected tour', async (platform) => {
    Object.defineProperty(Platform, 'OS', { value: platform, configurable: true })
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)

    expect(await screen.findByText(selection.cards[0].title)).toBeTruthy()
    expect(screen.getByText(selection.title)).toBeTruthy()
    expect(screen.getByText(selection.cards[0].subtitle)).toBeTruthy()
    expect(screen.getByText(selection.cards[0].rating)).toBeTruthy()
    expect(screen.queryByTestId('belkraj-native-link-card')).toBeNull()
    expect(screen.queryByText('Открыть подборку belkraj.by в браузере')).toBeNull()
    expect(mockLoad).toHaveBeenCalledWith(
      'https://belkraj.by/partner/widget?lat=53.9&lng=27.56&term=place&theme=cards&partner=u180793&size=6&country=BY',
      expect.any(AbortSignal),
    )

    await fireEvent.press(screen.getByTestId('belkraj-native-excursion-card'))
    expect(mockOpen).toHaveBeenCalledWith(selection.cards[0].url, { allowedProtocols: ['https:'] })
    await fireEvent.press(screen.getByTestId('belkraj-native-excursions-list-link'))
    expect(mockOpen).toHaveBeenLastCalledWith(selection.listUrl, { allowedProtocols: ['https:'] })
  })

  it('preserves real coordinates, country and requested number of cards', async () => {
    await render(<BelkrajWidget points={warsawPoints} countryCode="PL" cardsCount={3} />)
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1))
    const url = new URL(mockLoad.mock.calls[0][0])
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      lat: '52.2297', lng: '21.0122', country: 'PL', partner: 'u180793', size: '3',
    })
  })

  it.each([
    { countryCode: 'CY', points: [{ id: 1, address: 'Лимасол', lat: 34.7071, lng: 33.0226 }] },
    { countryCode: 'BY', points: [{ id: 1, address: 'Минск' }] },
  ])('does not load unsupported or unlocated selections', async (props) => {
    const screen = await render(<BelkrajWidget {...props} />)
    expect(screen.toJSON()).toBeNull()
    expect(mockLoad).not.toHaveBeenCalled()
  })

  it('does not load outside production, matching the web gate', async () => {
    process.env.NODE_ENV = 'development'
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    expect(screen.toJSON()).toBeNull()
    expect(mockLoad).not.toHaveBeenCalled()
  })

  it('shows a skeleton while loading and retries a failed request', async () => {
    const pending = deferred<BelkrajNativeData>()
    mockLoad.mockReturnValueOnce(pending.promise)
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    expect(screen.getByTestId('section-skeleton-reserved')).toBeTruthy()
    await act(async () => { pending.resolve({ ...selection, cards: [] }) })
    expect(await screen.findByText('Не удалось загрузить подборку')).toBeTruthy()
    await fireEvent.press(screen.getByText('Попробовать снова'))
    expect(await screen.findByText(selection.cards[0].title)).toBeTruthy()
    expect(mockLoad).toHaveBeenCalledTimes(2)
  })

  it('shows an explicit error on a rejected request', async () => {
    mockLoad.mockRejectedValueOnce(new Error('Partner unavailable'))
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    expect(await screen.findByText('Не удалось загрузить подборку')).toBeTruthy()
    expect(screen.queryByTestId('belkraj-native-excursions')).toBeNull()
  })

  it('aborts timed-out requests and ignores a late result', async () => {
    jest.useFakeTimers()
    const pending = deferred<BelkrajNativeData>()
    mockLoad.mockReturnValueOnce(pending.promise)
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    await act(() => jest.advanceTimersByTime(15_000))
    expect(mockLoad.mock.calls[0][1].aborted).toBe(true)
    expect(screen.getByText('Не удалось загрузить подборку')).toBeTruthy()
    await act(async () => { pending.resolve(selection) })
    expect(screen.queryByText(selection.cards[0].title)).toBeNull()
  })

  it('resets on a changed location and ignores the previous request', async () => {
    const first = deferred<BelkrajNativeData>()
    const second = deferred<BelkrajNativeData>()
    mockLoad.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    const firstSignal = mockLoad.mock.calls[0][1]
    await await screen.rerender(<BelkrajWidget points={warsawPoints} countryCode="PL" />)
    expect(firstSignal.aborted).toBe(true)
    expect(screen.getByTestId('section-skeleton-reserved')).toBeTruthy()
    await act(async () => { first.resolve(selection) })
    expect(screen.queryByText(selection.cards[0].title)).toBeNull()
    await act(async () => {
      second.resolve({ ...selection, title: 'Экскурсии в Варшаве', cards: [{ ...selection.cards[0], title: 'Прогулка по Варшаве' }] })
    })
    expect(screen.getByText('Прогулка по Варшаве')).toBeTruthy()
    expect(screen.queryByText(selection.cards[0].title)).toBeNull()
  })

  it('hides previously loaded cards immediately when the point changes', async () => {
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    await screen.findByText(selection.cards[0].title)
    mockLoad.mockReturnValueOnce(new Promise(() => {}))
    await await screen.rerender(<BelkrajWidget points={warsawPoints} countryCode="PL" />)
    expect(screen.queryByText(selection.cards[0].title)).toBeNull()
    expect(screen.getByTestId('section-skeleton-reserved')).toBeTruthy()
  })

  it('cancels pending work on unmount', async () => {
    const pending = deferred<BelkrajNativeData>()
    mockLoad.mockReturnValueOnce(pending.promise)
    const screen = await render(<BelkrajWidget points={minskPoints} countryCode="BY" />)
    const signal = mockLoad.mock.calls[0][1]
    await await screen.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { pending.resolve(selection) })
  })
})
