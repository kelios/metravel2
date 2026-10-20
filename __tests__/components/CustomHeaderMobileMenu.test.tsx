import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import CustomHeaderMobileMenu from '@/components/layout/CustomHeaderMobileMenu'
import NavigationIcon from '@/components/layout/NavigationIcon'
import { TASK_BOARD_URL } from '@/components/layout/accountMenuModel'
import { NativeMenuAccessibilityProvider } from '@/components/ui/NativeMenuAccessibilityScope'
import type { View } from 'react-native'
import { showLocaleSelectionError } from '@/i18n/languageSelectionFeedback'

const mockSetLocale = jest.fn(async () => undefined)
jest.mock('@/i18n/languageSelectionFeedback', () => ({ showLocaleSelectionError: jest.fn() }))

jest.mock('@/i18n/LocaleProvider', () => ({
  ...jest.requireActual('@/i18n/LocaleProvider'),
  useLocale: () => ({ locale: 'ru', supportedLocales: ['ru'], setLocale: mockSetLocale }),
}))

const colors = { primary: '#primary', textMuted: '#muted', text: '#text' } as any

const renderMenu = (props: Partial<React.ComponentProps<typeof CustomHeaderMobileMenu>> = {}) => {
  const handlers = { onNavPress: jest.fn(), onUserAction: jest.fn(), onLogout: jest.fn() }
  const utils = render(
    <NativeMenuAccessibilityProvider>
      <CustomHeaderMobileMenu
        visible
        onRequestClose={jest.fn()}
        onOverlayPress={jest.fn()}
        colors={colors}
        styles={{}}
        activePath="/"
        isAuthenticated
        userId={7}
        username="Юля"
        favoritesCount={0}
        returnFocusRef={React.createRef<View>()}
        restoreFocusRef={{ current: true }}
        {...handlers}
        {...props}
      />
    </NativeMenuAccessibilityProvider>,
  )
  return { ...utils, ...handlers }
}

describe('CustomHeaderMobileMenu account section (#2139)', () => {
  beforeEach(() => {
    mockSetLocale.mockReset().mockResolvedValue(undefined)
    jest.mocked(showLocaleSelectionError).mockClear()
  })

  it('allows deliberate current-language selection and another explicit retry', () => {
    const { getByText } = renderMenu()
    fireEvent.press(getByText('Русский'))
    fireEvent.press(getByText('Русский'))
    expect(mockSetLocale.mock.calls).toEqual([['ru'], ['ru']])
  })

  it('reports a local language selection failure through existing feedback', async () => {
    mockSetLocale.mockRejectedValueOnce(new Error('storage unavailable'))
    const { getByText } = renderMenu()
    fireEvent.press(getByText('Русский'))
    await waitFor(() => expect(showLocaleSelectionError).toHaveBeenCalledTimes(1))
  })

  it('highlights unread messages with the primary icon colour, badge label and a11y count', () => {
    const { UNSAFE_getAllByType, getByLabelText } = renderMenu({ unreadCount: 3 })

    const mailIcon = UNSAFE_getAllByType(NavigationIcon).find((node) => node.props.name === 'mail')
    expect(mailIcon?.props.color).toBe(colors.primary)
    expect(getByLabelText('Сообщения, 3 непрочитанных')).toBeTruthy()
  })

  it('keeps the muted icon colour without unread messages', () => {
    const { UNSAFE_getAllByType } = renderMenu({ unreadCount: 0 })

    const mailIcon = UNSAFE_getAllByType(NavigationIcon).find((node) => node.props.name === 'mail')
    expect(mailIcon?.props.color).toBe(colors.textMuted)
  })

  it('routes the superuser task board through the external nav handler and the public profile through onUserAction', () => {
    const { getByText, onNavPress, onUserAction } = renderMenu({ isSuperuser: true })

    fireEvent.press(getByText('Борд задач'))
    expect(onNavPress).toHaveBeenCalledWith(TASK_BOARD_URL, true)

    fireEvent.press(getByText('Публичный профиль'))
    expect(onUserAction).toHaveBeenCalledWith('/user/7')
  })
})
