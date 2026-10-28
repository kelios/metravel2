import { Platform } from 'react-native'

import { pushInAppRoute, travelCreateResetParams } from '@/utils/travelCreateNavigation'

describe('travelCreateNavigation', () => {
  const originalOS = Platform.OS
  const originalUrl = `${window.location.pathname}${window.location.search}`

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    window.history.replaceState(null, '', originalUrl)
  })

  it('builds a reset that drops the saved id and keeps only the requested create query', () => {
    expect(travelCreateResetParams('/travel/new?mode=note')).toEqual({
      id: undefined,
      mode: 'note',
      source_travel_id: undefined,
      country: undefined,
      place: undefined,
    })
    expect(travelCreateResetParams('/profile')).toBeNull()
  })

  it('clears the saved id when the create screen is opened again', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    window.history.replaceState(null, '', '/travel/new?mode=note&id=946')
    const router = { push: jest.fn(), setParams: jest.fn() }

    pushInAppRoute(router, '/travel/new?mode=note')

    expect(router.push).toHaveBeenCalledWith('/travel/new?mode=note')
    expect(router.setParams).toHaveBeenCalledWith({
      id: undefined,
      mode: 'note',
      source_travel_id: undefined,
      country: undefined,
      place: undefined,
    })
  })

  it('does not touch params of a different screen', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    window.history.replaceState(null, '', '/article/940')
    const router = { push: jest.fn(), setParams: jest.fn() }

    pushInAppRoute(router, '/travel/new?mode=note', '/article/940')

    expect(router.push).toHaveBeenCalledWith('/travel/new?mode=note')
    expect(router.setParams).not.toHaveBeenCalled()
  })

  it('leaves an ordinary route as a plain push', () => {
    const router = { push: jest.fn(), setParams: jest.fn() }

    pushInAppRoute(router, '/profile', '/travel/new')

    expect(router.push).toHaveBeenCalledWith('/profile')
    expect(router.setParams).not.toHaveBeenCalled()
  })
})
