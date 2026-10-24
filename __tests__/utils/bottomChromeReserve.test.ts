/**
 * @jest-environment jsdom
 */
import {
  getBottomChromeReserve,
  getCriticalBottomChromeOwner,
  getLowerBottomChromeReserve,
  releaseBottomChromeReserve,
  resetBottomChromeReserve,
  setBottomChromeReserve,
  setCriticalBottomChromeOwner,
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

  it('orders positioning dependencies without including the owner or a higher banner', () => {
    setBottomChromeReserve('consent-banner', 180)
    setBottomChromeReserve('app-install-bar', 320)
    setBottomChromeReserve('network-status', 400)
    expect(getLowerBottomChromeReserve('consent-banner')).toBe(0)
    expect(getLowerBottomChromeReserve('app-install-bar')).toBe(180)
    expect(getLowerBottomChromeReserve('network-status')).toBe(320)
    setBottomChromeReserve('network-status', 700)
    expect(getLowerBottomChromeReserve('app-install-bar')).toBe(180)
    expect(getLowerBottomChromeReserve('network-status')).toBe(320)
    expect(getBottomChromeReserve()).toBe(700)
    releaseBottomChromeReserve('app-install-bar')
    expect(getLowerBottomChromeReserve('network-status')).toBe(180)
    expect(getBottomChromeReserve()).toBe(700)
  })

  it('settles consent/install/network extents without a reserve-growth cycle', () => {
    setBottomChromeReserve('consent-banner', 180)
    const syncInstall = () => setBottomChromeReserve('app-install-bar', getLowerBottomChromeReserve('app-install-bar') + 100)
    const syncNetwork = () => setBottomChromeReserve('network-status', getLowerBottomChromeReserve('network-status') + 60)
    const unsubscribeInstall = subscribeBottomChromeReserve(syncInstall)
    const unsubscribeNetwork = subscribeBottomChromeReserve(syncNetwork)
    syncInstall()
    syncNetwork()
    expect(getBottomChromeReserve()).toBe(340)
    setBottomChromeReserve('consent-banner', 220)
    expect(getBottomChromeReserve()).toBe(380)
    expect(getLowerBottomChromeReserve('network-status')).toBe(320)
    unsubscribeInstall()
    unsubscribeNetwork()
  })

  it('atomically excludes stale optional extents for the critical owner independently of physical reserves', () => {
    setBottomChromeReserve('consent-banner', 172)
    setBottomChromeReserve('app-install-bar', 300)
    const snapshots: number[] = []
    const unsubscribe = subscribeBottomChromeReserve(() => snapshots.push(getBottomChromeReserve()))
    setCriticalBottomChromeOwner('network-status')
    expect(getCriticalBottomChromeOwner()).toBe('network-status')
    expect(getLowerBottomChromeReserve('network-status')).toBe(0)
    expect(getBottomChromeReserve('network-status')).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('')
    setBottomChromeReserve('network-status', 132)
    expect(getBottomChromeReserve()).toBe(132)
    releaseBottomChromeReserve('network-status') // More/keyboard: logical priority is still held.
    expect(getCriticalBottomChromeOwner()).toBe('network-status')
    expect(getBottomChromeReserve()).toBe(0)
    setCriticalBottomChromeOwner(null)
    expect(getBottomChromeReserve()).toBe(300)
    expect(snapshots).toEqual([0, 132, 0, 300])
    unsubscribe()
  })

  it('resets logical priority even when no physical owner remains', () => {
    setCriticalBottomChromeOwner('network-status')
    resetBottomChromeReserve()
    expect(getCriticalBottomChromeOwner()).toBeNull()
  })
})
