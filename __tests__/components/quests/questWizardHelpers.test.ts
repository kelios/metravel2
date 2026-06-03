const mockOpenExternalUrl = jest.fn<Promise<boolean>, [string, unknown?]>()
const mockSetStringAsync = jest.fn<Promise<void>, [string]>()
const mockShowToastMessage = jest.fn()

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: [string, unknown?]) => mockOpenExternalUrl(...args),
}))

jest.mock('@/utils/toast', () => ({
  showToastMessage: (...args: unknown[]) => mockShowToastMessage(...args),
}))

jest.mock('@/components/quests/questWizardMedia', () => ({
  getQuestClipboard: async () => ({ setStringAsync: (value: string) => mockSetStringAsync(value) }),
}))

import { Platform } from 'react-native'
import { copyQuestCoords, openQuestMap } from '@/components/quests/questWizardHelpers'

describe('questWizardHelpers.openQuestMap', () => {
  const point = { lat: 53.9, lng: 27.56, title: 'Площадь Победы' }

  beforeEach(() => {
    jest.clearAllMocks()
    mockOpenExternalUrl.mockResolvedValue(true)
    ;(Platform as { OS: string }).OS = 'web'
  })

  it('opens a Google Maps search URL with the point coordinates', async () => {
    const opened = await openQuestMap(point, 'google')

    expect(opened).toBe(true)
    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'https://www.google.com/maps/search/?api=1&query=53.9,27.56',
    )
  })

  it('opens an Apple Maps URL for the apple target', async () => {
    await openQuestMap(point, 'apple')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe('http://maps.apple.com/?ll=53.9,27.56')
  })

  it('opens a Yandex Maps URL with swapped lng,lat order', async () => {
    await openQuestMap(point, 'yandex')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'https://yandex.ru/maps/?pt=27.56,53.9&z=15',
    )
  })

  it('falls back through Organic Maps candidates until one succeeds', async () => {
    // First two scheme URLs fail, web fallback succeeds.
    mockOpenExternalUrl.mockResolvedValueOnce(false)
    mockOpenExternalUrl.mockResolvedValueOnce(false)
    mockOpenExternalUrl.mockResolvedValueOnce(true)

    const opened = await openQuestMap(point, 'organic')

    expect(opened).toBe(true)
    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe('om://map?ll=53.9,27.56&z=17')
    expect(mockOpenExternalUrl.mock.calls[1][0]).toBe('organicmaps://map?ll=53.9,27.56&z=17')
    expect(mockOpenExternalUrl.mock.calls[2][0]).toBe('https://omaps.app/?lat=53.9&lon=27.56&zoom=17')
    // Should stop once one candidate opened.
    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(3)
  })

  it('notifies the user when no map candidate could be opened', async () => {
    mockOpenExternalUrl.mockResolvedValue(false)

    const opened = await openQuestMap(point, 'mapsme')

    expect(opened).toBe(false)
    expect(mockShowToastMessage).toHaveBeenCalledTimes(1)
    expect(mockShowToastMessage.mock.calls[0][0]).toMatchObject({ type: 'info' })
  })

  it('encodes the point title for the mapsme deep link', async () => {
    await openQuestMap(point, 'mapsme')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'mapsme://map?ll=53.9,27.56&zoom=17&n=%D0%9F%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D1%8C%20%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B',
    )
  })
})

describe('questWizardHelpers.copyQuestCoords', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetStringAsync.mockResolvedValue(undefined)
  })

  it('copies coordinates with fixed 6-decimal precision and notifies the user', async () => {
    await copyQuestCoords({ lat: 53.9006, lng: 27.559 })

    expect(mockSetStringAsync).toHaveBeenCalledWith('53.900600, 27.559000')
    expect(mockShowToastMessage.mock.calls[0][0]).toMatchObject({ text1: 'Координаты скопированы' })
  })
})
