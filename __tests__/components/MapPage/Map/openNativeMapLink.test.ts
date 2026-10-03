import { Linking } from 'react-native'
import { router } from 'expo-router'

import { openNativeMapLink } from '@/components/MapPage/Map/openNativeMapLink'

// #2135: один обработчик OPEN_URL для WebView-карт приложения — ссылка на статью
// и на наш сайт открывается экраном приложения, а не в Safari с cookie-баннером.
describe('openNativeMapLink', () => {
  const push = router.push as jest.Mock

  beforeEach(() => {
    push.mockClear()
    jest.restoreAllMocks()
  })

  it('routes a metravel.by travel link inside the app without the hash', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue()

    await expect(openNativeMapLink('https://metravel.by/travels/forty-krakova#points')).resolves.toBe(true)

    expect(push).toHaveBeenCalledWith('/travels/forty-krakova')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('routes travel links built against a dev/local API host by path', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue()

    await expect(openNativeMapLink('http://192.168.50.36/travel/321')).resolves.toBe(true)

    expect(push).toHaveBeenCalledWith('/travel/321')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('routes other own-site screens through the shared external-link chokepoint', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue()

    await expect(openNativeMapLink('/places?country=BY')).resolves.toBe(true)

    expect(push).toHaveBeenCalledWith('/places?country=BY')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('opens foreign links in the system browser and ignores unsafe input', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue()

    await expect(openNativeMapLink('https://www.openstreetmap.org/copyright')).resolves.toBe(true)
    await expect(openNativeMapLink('javascript:alert(1)')).resolves.toBe(false)
    await expect(openNativeMapLink(undefined)).resolves.toBe(false)

    expect(push).not.toHaveBeenCalled()
    expect(openSpy.mock.calls).toEqual([['https://www.openstreetmap.org/copyright']])
  })
})
