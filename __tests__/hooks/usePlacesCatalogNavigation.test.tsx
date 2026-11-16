import React from 'react'
import { act, render } from '@testing-library/react-native'
import { Platform, View } from 'react-native'
import { usePlacesCatalogNavigation } from '@/hooks/usePlacesCatalogNavigation'
import { sendAnalyticsEvent } from '@/utils/analytics'

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))
type Entry = { isIntersecting: boolean; intersectionRatio: number }
class Observer {
  static instances: Observer[] = []
  disconnected = false
  constructor(private callback: (entries: Entry[]) => void) { Observer.instances.push(this) }
  observe() {}
  disconnect() { this.disconnected = true }
  emit(ratio: number) { if (!this.disconnected) this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]) }
}
function Link({ href = '/places' }: { href?: string }) {
  const navigation = usePlacesCatalogNavigation(href, 'mobile_menu')
  return <View testID="link" ref={navigation.ref as any} onTouchEnd={navigation.onEntry} />
}
function Menu({ open }: { open: boolean }) { return open ? <Link /> : null }

const originalPlatform = Platform.OS
const originalObserver = globalThis.IntersectionObserver
beforeEach(() => {
  ;(Platform as any).OS = 'web'
  ;(globalThis as any).IntersectionObserver = Observer
  Observer.instances = []
  jest.clearAllMocks()
})
afterEach(() => { (Platform as any).OS = originalPlatform; globalThis.IntersectionObserver = originalObserver })

test('closed or offscreen mobile menu is not an impression; half-visible link counts once', async () => {
  const view = await render(<Menu open={false} />)
  expect(Observer.instances).toHaveLength(0)
  expect(sendAnalyticsEvent).not.toHaveBeenCalled()
  await view.rerender(<Menu open />)
  const observer = Observer.instances.at(-1)!
  observer.emit(0.49)
  expect(sendAnalyticsEvent).not.toHaveBeenCalled()
  observer.emit(0.5)
  observer.emit(1)
  expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1)
  expect(sendAnalyticsEvent).toHaveBeenCalledWith('places_catalog_impression', expect.objectContaining({ source: 'mobile_menu' }))
  await act(() => view.getByTestId('link').props.onTouchEnd())
  expect(sendAnalyticsEvent).toHaveBeenLastCalledWith('places_catalog_entry', expect.objectContaining({ source: 'mobile_menu' }))
  await view.rerender(<Menu open={false} />)
  expect(observer.disconnected).toBe(true)
})

test('map, places help and native links do not emit catalog impressions or entries', async () => {
  for (const href of ['/map', '/places/help']) {
    const view = await render(<Link href={href} />)
    await act(() => view.getByTestId('link').props.onTouchEnd())
    await view.unmount()
  }
  ;(Platform as any).OS = 'ios'
  const view = await render(<Link />)
  await act(() => view.getByTestId('link').props.onTouchEnd())
  expect(sendAnalyticsEvent).not.toHaveBeenCalled()
})
