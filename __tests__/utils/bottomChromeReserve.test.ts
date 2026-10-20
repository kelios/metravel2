/**
 * @jest-environment jsdom
 */
import {
  getBottomChromeReserve,
  releaseBottomChromeReserve,
  resetBottomChromeReserve,
  setBottomChromeReserve,
  subscribeBottomChromeReserve,
} from '@/utils/bottomChromeReserve'

describe('bottom chrome reserves', () => {
  beforeEach(() => {
    resetBottomChromeReserve()
  })

  afterEach(() => {
    resetBottomChromeReserve()
  })

  it('keeps the maximum CSS reserve while exposing the space taken by other owners', () => {
    expect(getBottomChromeReserve()).toBe(0)
    setBottomChromeReserve('consent-banner', 144)
    setBottomChromeReserve('app-install-bar', 240)

    expect(getBottomChromeReserve()).toBe(240)
    expect(getBottomChromeReserve('app-install-bar')).toBe(144)
    expect(getBottomChromeReserve('consent-banner')).toBe(240)
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('240px')

    releaseBottomChromeReserve('app-install-bar')
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('144px')
    releaseBottomChromeReserve('consent-banner')
    expect(getBottomChromeReserve()).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('')
  })

  it('notifies excluded-owner consumers when a lower reserve changes without changing the global maximum', () => {
    setBottomChromeReserve('app-install-bar', 240)
    const snapshots: number[] = []
    const unsubscribe = subscribeBottomChromeReserve(() => {
      snapshots.push(getBottomChromeReserve('app-install-bar'))
    })

    setBottomChromeReserve('consent-banner', 144)
    setBottomChromeReserve('consent-banner', 180)
    releaseBottomChromeReserve('consent-banner')

    expect(snapshots).toEqual([144, 180, 0])
    expect(getBottomChromeReserve()).toBe(240)
    unsubscribe()
  })

  it('does not notify for unchanged or missing owners and supports unsubscribe', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeBottomChromeReserve(listener)

    setBottomChromeReserve('consent-banner', 144)
    setBottomChromeReserve('consent-banner', 144)
    releaseBottomChromeReserve('missing')
    setBottomChromeReserve('missing', Number.NaN)
    expect(listener).toHaveBeenCalledTimes(1)

    setBottomChromeReserve('consent-banner', 0)
    expect(listener).toHaveBeenCalledTimes(2)
    resetBottomChromeReserve()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    setBottomChromeReserve('consent-banner', 120)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('publishes a zero snapshot when all owners are reset', () => {
    setBottomChromeReserve('consent-banner', 144)
    const listener = jest.fn()
    const unsubscribe = subscribeBottomChromeReserve(listener)

    resetBottomChromeReserve()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getBottomChromeReserve('app-install-bar')).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('')
    unsubscribe()
  })
})
