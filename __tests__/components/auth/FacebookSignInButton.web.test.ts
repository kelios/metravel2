import {
  getFacebookCredential,
  getFacebookLoginOptions,
  getFacebookSdkLocale,
  isFacebookLoginEnabled,
} from '@/components/auth/FacebookSignInButton.web';

describe('FacebookSignInButton web contract', () => {
  const previousFlag = process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED;

  afterEach(() => {
    process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = previousFlag;
  });

  it('stays hidden until the backend-backed rollout flag is enabled', () => {
    process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = 'false';
    expect(isFacebookLoginEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = 'true';
    expect(isFacebookLoginEnabled()).toBe(true);
  });

  it('returns a credential only for a connected Facebook response', () => {
    expect(getFacebookCredential({
      status: 'connected',
      authResponse: {
        accessToken: '  short-lived-token  ',
        grantedScopes: 'public_profile,email',
      },
    })).toEqual({
      accessToken: 'short-lived-token',
      grantedScopes: ['public_profile', 'email'],
      emailPermissionGranted: true,
    });
    expect(getFacebookCredential({ status: 'not_authorized' })).toBeNull();
    expect(getFacebookCredential({ status: 'connected', authResponse: {} })).toBeNull();
  });

  it('detects a missing email scope without discarding the fresh credential', () => {
    expect(getFacebookCredential({
      status: 'connected',
      authResponse: {
        accessToken: 'short-lived-token',
        grantedScopes: ['public_profile'],
      },
    })).toEqual({
      accessToken: 'short-lived-token',
      grantedScopes: ['public_profile'],
      emailPermissionGranted: false,
    });
  });

  it('adds auth_type=rerequest only for an explicit email-permission retry', () => {
    expect(getFacebookLoginOptions('sign_in')).toEqual({
      scope: 'public_profile,email',
      return_scopes: true,
    });
    expect(getFacebookLoginOptions('rerequest_email')).toEqual({
      scope: 'public_profile,email',
      return_scopes: true,
      auth_type: 'rerequest',
    });
  });

  it.each([
    ['ru', 'ru_RU'],
    ['be', 'be_BY'],
    ['uk', 'uk_UA'],
    ['pl', 'pl_PL'],
    ['en', 'en_US'],
  ] as const)('maps %s to the Facebook SDK locale %s', (locale, expected) => {
    expect(getFacebookSdkLocale(locale)).toBe(expected);
  });
});
