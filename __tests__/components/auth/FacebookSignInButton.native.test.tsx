import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { AccessToken, LoginManager, Settings } from 'react-native-fbsdk-next'

import FacebookSignInButton, {
  getFacebookNativeCredential,
  getFacebookNativePermissions,
} from '@/components/auth/FacebookSignInButton.native'

jest.mock('react-native-fbsdk-next', () => ({
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
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
const loginMock = LoginManager.logInWithPermissions as jest.Mock
const previousEnabled = process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED
const previousAppId = process.env.EXPO_PUBLIC_META_APP_ID

describe('FacebookSignInButton native', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
      accessToken: 'token',
      grantedScopes: ['public_profile', 'email'],
      emailPermissionGranted: true,
    })
    expect(getFacebookNativeCredential('', ['email'])).toBeNull()
  })

  it('initializes the SDK and returns a fresh access token', async () => {
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
        accessToken: 'native-facebook-access-token',
        grantedScopes: ['public_profile', 'email'],
        emailPermissionGranted: true,
      }),
    )
    expect(loginMock).toHaveBeenCalledWith(['public_profile', 'email'])
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
    expect(accessTokenMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('reports a missing email permission to the shared completion flow', async () => {
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
        accessToken: 'native-facebook-access-token',
        grantedScopes: ['public_profile'],
        emailPermissionGranted: false,
      }),
    )
    expect(loginMock).toHaveBeenCalledWith(['email'])
  })
})
