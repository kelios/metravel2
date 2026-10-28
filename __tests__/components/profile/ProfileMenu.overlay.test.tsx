import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { PaperProvider } from 'react-native-paper'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import { NativeMenuAccessibilityProvider, NativeMenuBackground } from '@/components/ui/NativeMenuAccessibilityScope'

jest.mock('react-native-paper', () => jest.requireActual('react-native-paper'))

const scene = (props: React.ComponentProps<typeof ProfileMenu>) => (
  <NativeMenuAccessibilityProvider>
    <PaperProvider><NativeMenuBackground><ProfileMenu {...props} /></NativeMenuBackground></PaperProvider>
  </NativeMenuAccessibilityProvider>
)
const renderMenu = async (props: React.ComponentProps<typeof ProfileMenu>) => await render(scene(props))

describe('Profile menu route transitions', () => {
  const originalOS = Platform.OS
  afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }))

  it.each(['ios', 'android'])('removes the actual %s Paper-host overlay before opening settings', async (platform) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    const onSettings = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = await renderMenu({ onSettings, onLogout: jest.fn() })
    await fireEvent.press(utils.getByLabelText('Меню профиля'))
    expect(utils.getByTestId('native-menu-overlay')).toBeTruthy()
    expect(mockProfileMenuModalProps.size).toBe(0)
    await fireEvent.press(utils.getByLabelText('Настройки'))
    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(utils.queryByTestId('native-menu-overlay')).toBeNull()
    await fireEvent.press(utils.getByLabelText('Меню профиля'))
    expect(utils.getByTestId('native-menu-overlay')).toBeTruthy()
  })

  it.each(['ios', 'android'])('removes the actual %s Paper-host overlay before logout', async (platform) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    const logout = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = await renderMenu({ onLogout: logout })
    await fireEvent.press(utils.getByLabelText('Меню профиля'))
    await fireEvent.press(utils.getByLabelText('Выйти из аккаунта'))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(utils.queryByTestId('native-menu-overlay')).toBeNull()
  })

  it('cancels queued settings navigation when the owner unmounts before the host removes its menu', async () => {
    const settings = jest.fn()
    const utils = await renderMenu({ onSettings: settings, onLogout: jest.fn() })
    await fireEvent.press(utils.getByLabelText('Меню профиля'))
    const action = utils.getByLabelText('Настройки')
    await act(async () => {
      await fireEvent.press(action)
      await utils.unmount()
    })
    expect(settings).not.toHaveBeenCalled()
  })

  it('does not execute actions during StrictMode replay and executes settings once after actual removal', async () => {
    const settings = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = await render(<React.StrictMode>{scene({ onSettings: settings, onLogout: jest.fn() })}</React.StrictMode>)
    await fireEvent.press(utils.getByLabelText('Меню профиля'))
    expect(settings).not.toHaveBeenCalled()
    await fireEvent.press(utils.getByLabelText('Настройки'))
    expect(settings).toHaveBeenCalledTimes(1)
  })
})

// Observe the public component input while retaining its normal host rendering.
const captureNative = require('react-native')
const capturedOriginalModal = captureNative.Modal
const mockProfileMenuModalProps = new Map<string, any>()
beforeAll(() => {
  captureNative.Modal = require('react').forwardRef((props: any, ref: any) => {
    const key = 'unexpected-native-modal'
    if (key) mockProfileMenuModalProps.set(key, props)
    return require('react').createElement(capturedOriginalModal, { ...props, ref })
  })
})
afterAll(() => { captureNative.Modal = capturedOriginalModal })
beforeEach(() => { mockProfileMenuModalProps.clear() })
