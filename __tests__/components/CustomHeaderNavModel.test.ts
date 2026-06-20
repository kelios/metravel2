import { Platform } from 'react-native'

import { handleHeaderNavPress } from '@/components/layout/customHeaderNavModel'
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(),
  openExternalUrlInNewTab: jest.fn(),
}))

describe('handleHeaderNavPress', () => {
  const originalOS = Platform.OS
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    jest.clearAllMocks()
  })

  it('uses SPA navigation for web internal header routes', () => {
    const assign = jest.fn()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://metravel.by',
        pathname: '/',
        search: '',
        assign,
      },
    })
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, '/roulette')

    expect(assign).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith('/roulette')
  })

  it('keeps router push for current web route', () => {
    const assign = jest.fn()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://metravel.by',
        pathname: '/roulette',
        search: '',
        assign,
      },
    })
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, '/roulette')

    expect(assign).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith('/roulette')
  })

  it('keeps router push for native internal routes', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    const router = { push: jest.fn() }

    handleHeaderNavPress(router, '/quests')

    expect(router.push).toHaveBeenCalledWith('/quests')
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
