import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import CustomHeaderNavSection from '@/components/layout/CustomHeaderNavSection'
import BottomDockMoreItem from '@/components/layout/BottomDockMoreItem'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { DESKTOP_BAR_NAV_ITEMS } from '@/constants/headerNavigation'
import { BOTTOM_DOCK_MORE_MENU_SECTIONS } from '@/components/layout/bottomDockModel'

const mockRouter = { push: jest.fn() }
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => mockRouter, router: mockRouter, usePathname: () => '/search' }))
jest.mock('@/hooks/useLocalizedNavHref', () => ({ useLocalizedNavHref: () => (href: string) => `/pl${href}` }))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ logout: jest.fn() }) }))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))

const event = (extra = {}) => ({ defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...extra })
const originalPlatform = Platform.OS
beforeEach(() => { (Platform as any).OS = 'web'; jest.clearAllMocks() })
afterEach(() => { (Platform as any).OS = originalPlatform })

test('desktop catalog uses the same attributed localized href for browser and SPA navigation', async () => {
  const view = await render(<CustomHeaderNavSection activePath="/search" styles={{}} />)
  const label = DESKTOP_BAR_NAV_ITEMS.find(item => item.path === '/places')!.label
  const link = view.getByLabelText(label)
  expect(link.props.href).toBe('/pl/places?places_source=desktop_navigation')
  await act(() => fireEvent.press(link, event()))
  expect(mockRouter.push).toHaveBeenCalledWith('/pl/places?places_source=desktop_navigation')
  expect(jest.mocked(sendAnalyticsEvent).mock.calls.filter(([name]) => name === 'places_catalog_entry')).toHaveLength(1)
  mockRouter.push.mockClear()
  jest.mocked(sendAnalyticsEvent).mockClear()
  await act(() => fireEvent.press(link, event({ ctrlKey: true })))
  expect(mockRouter.push).not.toHaveBeenCalled()
  expect(sendAnalyticsEvent).not.toHaveBeenCalled()
})

test('mobile menu activates its real href once and closes; native route keeps its original shape', async () => {
  const item = BOTTOM_DOCK_MORE_MENU_SECTIONS.flatMap(section => section.items).find(item => item.route === '/places')!
  const onClose = jest.fn()
  const view = await render(<BottomDockMoreItem item={item} styles={{} as any} onClose={onClose} onOpenView={jest.fn()} />)
  const link = view.getByTestId(`footer-more-item-${item.key}`)
  expect(link.props.href).toBe('/places?places_source=mobile_menu')
  await act(() => fireEvent.press(link, event()))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(mockRouter.push).toHaveBeenCalledWith('/places?places_source=mobile_menu')
  expect(sendAnalyticsEvent).toHaveBeenCalledWith('places_catalog_entry', expect.objectContaining({ source: 'mobile_menu' }))
  await view.unmount()
  jest.clearAllMocks()
  ;(Platform as any).OS = 'android'
  const native = await render(<BottomDockMoreItem item={item} styles={{} as any} onClose={onClose} onOpenView={jest.fn()} />)
  await act(() => fireEvent.press(native.getByTestId(`footer-more-item-${item.key}`)))
  expect(mockRouter.push).toHaveBeenCalledWith('/places')
  expect(sendAnalyticsEvent).not.toHaveBeenCalled()
})
