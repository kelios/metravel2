import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import LanguageSection from '@/components/settings/LanguageSection'

jest.mock('@/i18n/LocaleProvider', () => {
  const state = {
    locale: 'ru',
    preference: { version: 1, mode: 'explicit', locale: 'ru' },
    supportedLocales: ['ru', 'pl', 'en'],
    isHydrated: true,
    setLocale: jest.fn(async () => undefined),
    useSystemLocale: jest.fn(async () => undefined),
  }
  return {
    useLocale: () => state,
    __localeState: state,
  }
})

const localeState = jest.requireMock('@/i18n/LocaleProvider').__localeState

jest.mock('@/ui/paper', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    DialogMenu: ({ anchor, children, visible }: any) =>
      React.createElement(View, null, anchor, visible ? children : null),
  }
})

const styles = new Proxy(
  {},
  {
    get: () => ({}),
  },
) as any

const colors = {
  backgroundSecondary: '#fff',
  border: '#ddd',
  borderLight: '#eee',
  primary: '#000',
  primaryDark: '#000',
  primarySoft: '#eee',
  surface: '#fff',
  surfaceMuted: '#f5f5f5',
  text: '#000',
  textMuted: '#555',
} as any

describe('language selection surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens the header picker and selects Polish without authentication', () => {
    const { getByTestId, getByLabelText } = render(<LanguageSwitcher />)

    fireEvent.press(getByTestId('header-language-switcher'))
    expect(getByLabelText('Русский')).toBeTruthy()
    expect(getByLabelText('Polski')).toBeTruthy()
    expect(getByLabelText('English')).toBeTruthy()

    fireEvent.press(getByTestId('header-language-option-pl'))
    expect(localeState.setLocale).toHaveBeenCalledWith('pl')
  })

  it('offers explicit languages and opt-in system mode in account settings', () => {
    const { getByLabelText } = render(
      <LanguageSection colors={colors} styles={styles} />,
    )

    fireEvent.press(getByLabelText('English'))
    expect(localeState.setLocale).toHaveBeenCalledWith('en')

    fireEvent.press(getByLabelText('Как в системе'))
    expect(localeState.useSystemLocale).toHaveBeenCalledTimes(1)
  })
})
