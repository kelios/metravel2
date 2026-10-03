import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'

import BottomDockMoreList from '@/components/layout/BottomDockMoreList'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import { BOTTOM_DOCK_MORE_MENU_SECTIONS } from '@/components/layout/bottomDockModel'
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

  // #2100: на вложенных экранах телефона бренд-строки нет — язык меняется из «Ещё».
  // Подэкран внутри того же листа: второй Modal на iOS поверх первого не показывается.
  it('«Ещё» → «Язык интерфейса» открывает выбор языка внутри листа и меняет локаль', () => {
    const items = BOTTOM_DOCK_MORE_MENU_SECTIONS.flatMap((section) => section.items)
    const language = items.find((item) => item.key === 'language')
    expect(language).toEqual(expect.objectContaining({ action: 'language', iconName: 'globe' }))
    expect(language?.route).toBeUndefined()

    const onClose = jest.fn()
    const { getByTestId, queryByTestId, getByLabelText } = render(
      <BottomDockMoreList
        styles={styles}
        iconColor="#000"
        itemFilter={() => true}
        onClose={onClose}
        renderItem={(item, openLanguage) => (
          <Pressable key={item.key} testID={`footer-more-item-${item.key}`} onPress={item.action ? openLanguage : onClose}>
            <Text>{item.label}</Text>
          </Pressable>
        )}
      />,
    )
    expect(queryByTestId('more-language-option-pl')).toBeNull()
    fireEvent.press(getByTestId('footer-more-item-language'))
    expect(onClose).not.toHaveBeenCalled()
    expect(getByLabelText('English')).toBeTruthy()
    fireEvent.press(getByTestId('more-language-option-pl'))
    expect(localeState.setLocale).toHaveBeenCalledWith('pl')
    expect(onClose).toHaveBeenCalledTimes(1)
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
    const originalPlatformOS = Platform.OS
    localeState.locale = locale
    Object.defineProperty(Platform, 'OS', { value: 'web' })
    try {
      const { getByText } = render(<LanguageSwitcher />)
      const code = getByText(displayCode)

      expect(StyleSheet.flatten(code.props.style)).toMatchObject({
        width: 22,
        textAlign: 'center',
      })
      expect(code.props.numberOfLines).toBe(1)
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalPlatformOS })
      localeState.locale = 'ru'
    }
  })

  // Фиксированный бокс кода — web-only: на native он не нужен (пререндера нет),
  // а вместе с `numberOfLines` резал бы код при системном увеличении шрифта.
  it('на native бокс кода языка не фиксирует', () => {
    const originalPlatformOS = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'ios' })
    try {
      const { getByText } = render(<LanguageSwitcher />)
      const flattened = StyleSheet.flatten(getByText('RU').props.style)

      expect(flattened.width).toBeUndefined()
      expect(flattened.textAlign).toBeUndefined()
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalPlatformOS })
    }
  })
})
