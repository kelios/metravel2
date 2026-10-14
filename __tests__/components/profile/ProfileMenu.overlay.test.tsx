import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Modal, Platform } from 'react-native'
import { PaperProvider } from 'react-native-paper'
import { ProfileMenu } from '@/components/profile/ProfileMenu'
import { NativeMenuAccessibilityProvider, NativeMenuBackground } from '@/components/ui/NativeMenuAccessibilityScope'

jest.mock('react-native-paper', () => jest.requireActual('react-native-paper'))

const scene = (props: React.ComponentProps<typeof ProfileMenu>) => (
  <NativeMenuAccessibilityProvider>
    <PaperProvider><NativeMenuBackground><ProfileMenu {...props} /></NativeMenuBackground></PaperProvider>
  </NativeMenuAccessibilityProvider>
)
const renderMenu = (props: React.ComponentProps<typeof ProfileMenu>) => render(scene(props))

describe('Profile menu route transitions', () => {
  const originalOS = Platform.OS
  afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }))

  it.each(['ios', 'android'])('removes the actual %s Paper-host overlay before opening settings', (platform) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    const onSettings = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = renderMenu({ onSettings, onLogout: jest.fn() })
    fireEvent.press(utils.getByLabelText('Меню профиля'))
    expect(utils.getByTestId('native-menu-overlay')).toBeTruthy()
    expect(utils.UNSAFE_queryAllByType(Modal)).toHaveLength(0)
    fireEvent.press(utils.getByLabelText('Настройки'))
    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(utils.queryByTestId('native-menu-overlay')).toBeNull()
    fireEvent.press(utils.getByLabelText('Меню профиля'))
    expect(utils.getByTestId('native-menu-overlay')).toBeTruthy()
  })

  it.each(['ios', 'android'])('removes the actual %s Paper-host overlay before logout', (platform) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    const logout = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = renderMenu({ onLogout: logout })
    fireEvent.press(utils.getByLabelText('Меню профиля'))
    fireEvent.press(utils.getByLabelText('Выйти из аккаунта'))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(utils.queryByTestId('native-menu-overlay')).toBeNull()
  })

  it('cancels queued settings navigation when the owner unmounts before the host removes its menu', () => {
    const settings = jest.fn()
    const utils = renderMenu({ onSettings: settings, onLogout: jest.fn() })
    fireEvent.press(utils.getByLabelText('Меню профиля'))
    const action = utils.getByLabelText('Настройки')
    act(() => {
      fireEvent.press(action)
      utils.unmount()
    })
    expect(settings).not.toHaveBeenCalled()
  })

  it('does not execute actions during StrictMode replay and executes settings once after actual removal', () => {
    const settings = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = render(<React.StrictMode>{scene({ onSettings: settings, onLogout: jest.fn() })}</React.StrictMode>)
    fireEvent.press(utils.getByLabelText('Меню профиля'))
    expect(settings).not.toHaveBeenCalled()
    fireEvent.press(utils.getByLabelText('Настройки'))
    expect(settings).toHaveBeenCalledTimes(1)
  })
})
