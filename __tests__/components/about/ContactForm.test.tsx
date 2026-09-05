import React from 'react'
import { Platform, TextInput } from 'react-native'
import { render } from '@testing-library/react-native'

import { ContactForm } from '@/components/about/ContactForm'

jest.mock('@/components/about/aboutStyles', () => ({
  useAboutStyles: () => ({}),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    textMuted: '#777',
    textOnPrimary: '#fff',
  }),
}))

jest.mock('@/i18n', () => ({
  translate: (key: string) => key,
}))

const originalPlatform = Platform.OS

const props = {
  response: { text: '', error: false },
  hp: '',
  onChangeHp: jest.fn(),
  name: '',
  email: '',
  message: '',
  onChangeName: jest.fn(),
  onChangeEmail: jest.fn(),
  onChangeMessage: jest.fn(),
  invalidName: false,
  invalidEmail: false,
  invalidMessage: false,
  invalidAgree: false,
  agree: false,
  onToggleAgree: jest.fn(),
  onSubmit: jest.fn(),
  isDisabled: true,
  sending: false,
  inputFocus: {},
  onFocusName: jest.fn(),
  onBlurName: jest.fn(),
  onFocusEmail: jest.fn(),
  onBlurEmail: jest.fn(),
  onFocusMessage: jest.fn(),
  onBlurMessage: jest.fn(),
  onKeyPress: jest.fn(),
  emailRef: React.createRef<TextInput>(),
  messageRef: React.createRef<TextInput>(),
  onSubmitEditingEmail: jest.fn(),
  onSubmitEditingMessage: jest.fn(),
}

describe('ContactForm honeypot boundary', () => {
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  it.each(['ios', 'android'])('does not render the browser honeypot on %s', (os) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })

    const { queryByTestId } = render(<ContactForm {...props} />)

    expect(queryByTestId('contact-form-honeypot')).toBeNull()
  })

  it('keeps the honeypot on web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })

    const { getByTestId } = render(<ContactForm {...props} />)

    expect(getByTestId('contact-form-honeypot', { includeHiddenElements: true })).toBeTruthy()
  })

  it.each(['web', 'ios', 'android'])('shows the keyboard shortcut hint only on web (%s)', (os) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })

    const { queryByText } = render(<ContactForm {...props} />)
    const hint = queryByText('home:components.about.ContactForm.shift_enter_novaya_stroka_enter_otpravit_web_26a15cc6')

    if (os === 'web') {
      expect(hint).toBeTruthy()
    } else {
      expect(hint).toBeNull()
    }
  })
})
