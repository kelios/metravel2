import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { getRandomValues as nativeRandomValues } from 'expo-crypto'
import { Platform, Pressable, StyleSheet } from 'react-native'
import {
  AccessToken,
  AuthenticationToken,
  LoginManager,
  Settings,
} from 'react-native-fbsdk-next'

import FacebookSignInButton, {
  createFacebookLoginNonce,
  getFacebookLimitedCredential,
  getFacebookNativeCredential,
  getFacebookNativePermissions,
} from '@/components/auth/FacebookSignInButton.native'
import { SOCIAL_AUTH_BUTTON_GEOMETRY } from '@/components/auth/socialAuthButtonGeometry'

// На устройстве источник энтропии — нативный ExpoCrypto; в jest его нативной
// части нет, и штатная заглушка jest-expo возвращает нулевой буфер. Подменяем
// её реальным CSPRNG Node: проверяется выбор источника и кодирование nonce, а
// не случайность как таковая.
jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((array: Uint8Array) => {
    require('node:crypto').webcrypto.getRandomValues(array)
    return array
  }),
}))

jest.mock('react-native-fbsdk-next', () => ({
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
  AuthenticationToken: {
    getAuthenticationTokenIOS: jest.fn(),
  },
  LoginManager: {
    logInWithPermissions: jest.fn(),
    setLoginBehavior: jest.fn(),
  },
  Settings: {
    initializeSDK: jest.fn(),
  },
}))

const accessTokenMock = AccessToken.getCurrentAccessToken as jest.Mock
const authenticationTokenMock =
  AuthenticationToken.getAuthenticationTokenIOS as jest.Mock
const loginMock = LoginManager.logInWithPermissions as jest.Mock
const previousEnabled = process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED
const previousAppId = process.env.EXPO_PUBLIC_META_APP_ID
// jest-expo резолвит платформенные модули с defaultPlatform=ios, поэтому
// Android-ветку приходится включать явной подменой Platform.OS — иначе
// «зелёный native-тест» доказывает только iOS.
const originalOS = Platform.OS
const setPlatform = (os: typeof Platform.OS) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
const nativeRandomMock = nativeRandomValues as unknown as jest.Mock
// Hermes на устройстве не отдаёт `globalThis.crypto`; Node в jest отдаёт,
// поэтому ветку устройства приходится включать снятием глобали. Nonce считается
// синхронно, поэтому обёртка тоже синхронная.
const withoutWebCrypto = (run: () => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: undefined,
    configurable: true,
  })
  try {
    run()
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor)
    else delete (globalThis as { crypto?: unknown }).crypto
  }
}

describe('FacebookSignInButton native', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // clearAllMocks не снимает реализацию, поэтому нативный источник энтропии
    // возвращается к настоящему CSPRNG перед каждым тестом.
    nativeRandomMock.mockImplementation((array: Uint8Array) => {
      require('node:crypto').webcrypto.getRandomValues(array)
      return array
    })
    setPlatform('ios')
    process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = 'true'
    process.env.EXPO_PUBLIC_META_APP_ID = '123456789'
    loginMock.mockResolvedValue({
      isCancelled: false,
      grantedPermissions: ['public_profile', 'email'],
    })
    accessTokenMock.mockResolvedValue({
      accessToken: 'native-facebook-access-token',
      permissions: ['public_profile', 'email'],
    })
    authenticationTokenMock.mockImplementation(async () => ({
      authenticationToken: 'limited-login-oidc-token',
      nonce: loginMock.mock.calls.at(-1)?.[2],
      graphDomain: 'facebook',
    }))
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    })
  })

  afterAll(() => {
    if (typeof previousEnabled === 'undefined')
      delete process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED
    else process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = previousEnabled
    if (typeof previousAppId === 'undefined')
      delete process.env.EXPO_PUBLIC_META_APP_ID
    else process.env.EXPO_PUBLIC_META_APP_ID = previousAppId
  })

  it('uses the complete permission set only for initial sign-in', () => {
    expect(getFacebookNativePermissions('sign_in')).toEqual([
      'public_profile',
      'email',
    ])
    expect(getFacebookNativePermissions('rerequest_email')).toEqual(['email'])
  })

  it('normalizes a native access token without persisting provider state', () => {
    expect(
      getFacebookNativeCredential(' token ', [
        'public_profile',
        'email',
        'email',
      ]),
    ).toEqual({
      kind: 'access_token',
      accessToken: 'token',
      grantedScopes: ['public_profile', 'email'],
      emailPermissionGranted: true,
    })
    expect(getFacebookNativeCredential('', ['email'])).toBeNull()
  })

  it('generates a unique unpredictable nonce per attempt', () => {
    const first = createFacebookLoginNonce()
    const second = createFacebookLoginNonce()

    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(second).not.toBe(first)
  })

  // Регрессия: на устройстве бандл исполняет Hermes, и `globalThis.crypto` там
  // нет вовсе. Опора только на Web Crypto оставляла кнопку Facebook на iPhone
  // мёртвой — nonce пустой, диалог Meta не открывается ни разу, — а в jest
  // (Node отдаёт Web Crypto) такой код проходил зелёным.
  it('generates the nonce without Web Crypto, as the device runtime does', () => {
    withoutWebCrypto(() => {
      const first = createFacebookLoginNonce()
      const second = createFacebookLoginNonce()

      expect(first).toMatch(/^[0-9a-f]{32}$/)
      expect(second).not.toBe(first)
    })
    expect(nativeRandomMock).toHaveBeenCalledTimes(2)
  })

  it('never starts an iPhone attempt when no entropy source answers', async () => {
    // Заглушённый нативный модуль отдаёт нулевой буфер: константный nonce
    // хуже отсутствия входа, попытка не начинается.
    nativeRandomMock.mockImplementation((array: Uint8Array) => array)
    const onError = jest.fn()
    const onSuccess = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={onError} />,
    )
    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))

    withoutWebCrypto(() => {
      expect(createFacebookLoginNonce()).toBe('')
      fireEvent.press(screen.getByTestId('facebook-sign-in-button'))
    })
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))

    expect(loginMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('binds the limited-login token to the nonce of the same attempt', () => {
    expect(
      getFacebookLimitedCredential(' oidc ', 'nonce-1', 'nonce-1', ['email']),
    ).toEqual({
      kind: 'authentication_token',
      authenticationToken: 'oidc',
      nonce: 'nonce-1',
      grantedScopes: ['email'],
      emailPermissionGranted: true,
    })
    // Токен из другой (или прошлой) попытки принимать нельзя.
    expect(
      getFacebookLimitedCredential('oidc', 'nonce-1', 'nonce-0', ['email']),
    ).toBeNull()
    expect(getFacebookLimitedCredential('', 'nonce-1', 'nonce-1', [])).toBeNull()
    expect(getFacebookLimitedCredential('oidc', '', '', [])).toBeNull()
    // Пустой набор разрешений в Limited Login — «неизвестно», решение о
    // дополнении email принимает сервер, а не кнопка.
    expect(
      getFacebookLimitedCredential('oidc', 'nonce-1', undefined, undefined),
    ).toMatchObject({ emailPermissionGranted: true, grantedScopes: [] })
  })

  it('signs in on iPhone through Limited Login and returns the OIDC token', async () => {
    const onSuccess = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={jest.fn()} />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    const [permissions, tracking, nonce] = loginMock.mock.calls[0]
    expect(permissions).toEqual(['public_profile', 'email'])
    expect(tracking).toBe('limited')
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(onSuccess).toHaveBeenCalledWith({
      kind: 'authentication_token',
      authenticationToken: 'limited-login-oidc-token',
      nonce,
      grantedScopes: ['public_profile', 'email'],
      emailPermissionGranted: true,
    })
    // Классический access token в limited-режиме недоступен и не запрашивается.
    expect(accessTokenMock).not.toHaveBeenCalled()
  })

  it('uses a fresh nonce for every iPhone attempt', async () => {
    const screen = render(
      <FacebookSignInButton onSuccess={jest.fn()} onError={jest.fn()} />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))
    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))
    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(2))

    expect(loginMock.mock.calls[1][2]).not.toBe(loginMock.mock.calls[0][2])
  })

  it('reports an error when the iPhone attempt yields no authentication token', async () => {
    authenticationTokenMock.mockResolvedValue(null)
    const onSuccess = jest.fn()
    const onError = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={onError} />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('rejects an authentication token issued for another nonce', async () => {
    authenticationTokenMock.mockResolvedValue({
      authenticationToken: 'stale-oidc-token',
      nonce: 'nonce-from-a-previous-attempt',
      graphDomain: 'facebook',
    })
    const onSuccess = jest.fn()
    const onError = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={onError} />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('re-requests only the email permission on iPhone and keeps Limited Login', async () => {
    const onSuccess = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} mode="rerequest_email" />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(loginMock.mock.calls[0][0]).toEqual(['email'])
    expect(loginMock.mock.calls[0][1]).toBe('limited')
  })

  it('initializes the SDK and returns a fresh access token on Android', async () => {
    setPlatform('android')
    const onSuccess = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={jest.fn()} />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    expect(LoginManager.setLoginBehavior).toHaveBeenCalledWith(
      'native_with_fallback',
    )
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({
        kind: 'access_token',
        accessToken: 'native-facebook-access-token',
        grantedScopes: ['public_profile', 'email'],
        emailPermissionGranted: true,
      }),
    )
    expect(loginMock).toHaveBeenCalledWith(['public_profile', 'email'])
    expect(authenticationTokenMock).not.toHaveBeenCalled()
  })

  it('uses the shared social button geometry for its native touch target', async () => {
    const screen = render(
      <FacebookSignInButton onSuccess={jest.fn()} onError={jest.fn()} />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    const button = screen.UNSAFE_getByType(Pressable)
    const resolvedStyle = button.props.style({ pressed: true })

    expect(StyleSheet.flatten(resolvedStyle)).toMatchObject({
      minHeight: SOCIAL_AUTH_BUTTON_GEOMETRY.minHeight,
      borderRadius: SOCIAL_AUTH_BUTTON_GEOMETRY.borderRadius,
      opacity: SOCIAL_AUTH_BUTTON_GEOMETRY.pressedOpacity,
      transform: [{ scale: SOCIAL_AUTH_BUTTON_GEOMETRY.pressedScale }],
    })
  })

  it('stays unavailable without app id and never initializes or reports success', () => {
    process.env.EXPO_PUBLIC_META_APP_ID = ''
    const onSuccess = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={jest.fn()} />,
    )
    const button = screen.getByTestId('facebook-sign-in-button')

    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    })
    expect(Settings.initializeSDK).not.toHaveBeenCalled()

    fireEvent.press(button)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('falls back to unavailable when the native SDK cannot initialize', async () => {
    ;(Settings.initializeSDK as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native module unavailable')
    })
    const onSuccess = jest.fn()
    const onError = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} onError={onError} />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('facebook-sign-in-button').props.accessibilityState,
      ).toEqual({ disabled: true, busy: false }),
    )
    expect(
      screen.getByText('Вход через Facebook временно недоступен'),
    ).toBeTruthy()
    expect(onError).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    expect(onSuccess).not.toHaveBeenCalled()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('treats a cancelled SDK dialog as a no-op', async () => {
    loginMock.mockResolvedValue({ isCancelled: true })
    const onSuccess = jest.fn()
    const onCancel = jest.fn()
    const screen = render(
      <FacebookSignInButton
        onSuccess={onSuccess}
        onCancel={onCancel}
        onError={jest.fn()}
      />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(authenticationTokenMock).not.toHaveBeenCalled()
    expect(accessTokenMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('reports a missing email permission to the shared completion flow on Android', async () => {
    setPlatform('android')
    accessTokenMock.mockResolvedValue({
      accessToken: 'native-facebook-access-token',
      permissions: ['public_profile'],
    })
    const onSuccess = jest.fn()
    const screen = render(
      <FacebookSignInButton onSuccess={onSuccess} mode="rerequest_email" />,
    )

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({
        kind: 'access_token',
        accessToken: 'native-facebook-access-token',
        grantedScopes: ['public_profile'],
        emailPermissionGranted: false,
      }),
    )
    expect(loginMock).toHaveBeenCalledWith(['email'])
  })

  it('reports a missing email permission from a limited-login result', async () => {
    loginMock.mockResolvedValue({
      isCancelled: false,
      grantedPermissions: ['public_profile'],
    })
    const onSuccess = jest.fn()
    const screen = render(<FacebookSignInButton onSuccess={onSuccess} />)

    await waitFor(() => expect(Settings.initializeSDK).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByTestId('facebook-sign-in-button'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      kind: 'authentication_token',
      grantedScopes: ['public_profile'],
      emailPermissionGranted: false,
    })
  })
})
