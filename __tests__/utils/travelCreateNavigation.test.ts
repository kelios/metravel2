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
      place_request_id: undefined,
      contribution_source: undefined,
    })
    expect(travelCreateResetParams('/profile')).toBeNull()
  })

  it('keeps campaign identity only when it is present in the requested URL', () => {
    const id = 'c79916ab-35d9-44e5-ad02-c9fb67979c14'
    expect(travelCreateResetParams(`/travel/new?mode=note&place_request_id=${id}&contribution_source=map`)).toMatchObject({
      id: undefined,
      mode: 'note',
      place_request_id: id,
      contribution_source: 'map',
    })
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
      place_request_id: undefined,
      contribution_source: undefined,
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
