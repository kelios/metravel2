import { Platform } from 'react-native'

import { handleHeaderNavPress } from '@/components/layout/customHeaderNavModel'
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(),
  openExternalUrlInNewTab: jest.fn(),
}))

describe('handleHeaderNavPress', () => {
  const originalOS = Platform.OS
  const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    // location в jsdom 26 non-configurable: исходный адрес возвращаем через history.
    window.history.replaceState(null, '', originalUrl)
    jest.clearAllMocks()
  })

  it('uses SPA navigation for web internal header routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    window.history.replaceState(null, '', '/')
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, '/roulette')

    // Жёсткой навигации (смены документа) нет: адрес остаётся прежним, переход делает router.
    expect(window.location.pathname).toBe('/')
    expect(router.push).toHaveBeenCalledWith('/roulette')
  })

  it('keeps router push for current web route', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    window.history.replaceState(null, '', '/roulette')
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, '/roulette')

    // Жёсткой навигации (смены документа) нет: адрес остаётся прежним, переход делает router.
    expect(window.location.pathname).toBe('/roulette')
    expect(router.push).toHaveBeenCalledWith('/roulette')
  })

  it('keeps router push for native internal routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, '/quests')

    expect(router.push).toHaveBeenCalledWith('/quests')
  })

  it('drops a saved travel id when the create screen is opened again', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    window.history.replaceState(null, '', '/travel/new?mode=note&id=946')
    const router = { push: jest.fn(), setParams: jest.fn() }

    handleHeaderNavPress(router, '/travel/new?mode=note')

    expect(router.push).toHaveBeenCalledWith('/travel/new?mode=note')
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ id: undefined, mode: 'note' }))
  })

  it('keeps external navigation in centralized helpers', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, 'https://example.test', true)

    expect(openExternalUrlInNewTab).toHaveBeenCalledWith('https://example.test')
    expect(openExternalUrl).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})
