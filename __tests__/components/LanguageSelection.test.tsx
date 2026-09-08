import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import LanguageSection from '@/components/settings/LanguageSection'

jest.mock('@/i18n/LocaleProvider', () => {
  const state = {
    locale: 'ru',
    preference: { version: 1, mode: 'explicit', locale: 'ru' },
    supportedLocales: ['ru', 'be', 'uk', 'pl', 'en'],
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

  it('opens the header picker and selects Ukrainian without authentication', () => {
    const { getByTestId, getByLabelText, getByText } = render(<LanguageSwitcher />)

    fireEvent.press(getByTestId('header-language-switcher'))
    expect(getByLabelText('Русский')).toBeTruthy()
    expect(getByLabelText('Беларуская')).toBeTruthy()
    expect(getByLabelText('Українська')).toBeTruthy()
    expect(getByLabelText('Polski')).toBeTruthy()
    expect(getByLabelText('English')).toBeTruthy()
    expect(getByText('BY')).toBeTruthy()

    fireEvent.press(getByTestId('header-language-option-uk'))
    expect(localeState.setLocale).toHaveBeenCalledWith('uk')
  })

  it('offers explicit languages and opt-in system mode in account settings', () => {
    const { getAllByText, getByLabelText } = render(
      <LanguageSection colors={colors} styles={styles} />,
    )

    expect(getAllByText('BY')).toHaveLength(2)
    fireEvent.press(getByLabelText('Беларуская'))
    expect(localeState.setLocale).toHaveBeenCalledWith('be')

    fireEvent.press(getByLabelText('Как в системе'))
    expect(localeState.useSystemLocale).toHaveBeenCalledTimes(1)
  })

  // #1879: статический HTML пререндерится на RU, а выбранная локаль доезжает из
  // хранилища уже после первого кадра. Код языка рисуется в боксе фиксированной
  // ширины, иначе смена RU -> BY/UK/PL/EN меняет ширину самого переключателя, а
  // вместе с ней и его x: правее `navScroll` с `flex:1` весь слак строки левее.
  it.each([
    ['ru', 'RU'],
    ['be', 'BY'],
    ['uk', 'UK'],
    ['pl', 'PL'],
    ['en', 'EN'],
  ] as const)('держит бокс кода языка одинаковым на локали %s', (locale, displayCode) => {
    localeState.locale = locale
    try {
      const { getByText } = render(<LanguageSwitcher />)
      const code = getByText(displayCode)

      expect(StyleSheet.flatten(code.props.style)).toMatchObject({
        width: 22,
        textAlign: 'center',
      })
      expect(code.props.numberOfLines).toBe(1)
    } finally {
      localeState.locale = 'ru'
    }
  })
})
