/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render } from '@testing-library/react-native';

import FacebookSignInButton, { getFacebookSdkLocale } from '@/components/auth/FacebookSignInButton.web';
import type { SupportedLocale } from '@/i18n';

const mockLocaleState: { locale: SupportedLocale; isHydrated: boolean } = {
    locale: 'ru',
    isHydrated: false,
};

jest.mock('@/hooks/useHydrationReady', () => ({
    useHydrationReady: () => true,
}));

jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        info: '#000000',
        textOnPrimary: '#ffffff',
    }),
}));

jest.mock('@/i18n/LocaleProvider', () => ({
    useLocale: () => mockLocaleState,
}));

jest.mock('@/i18n', () => ({
    translate: (key: string) => key,
}));

const SDK_ID = 'facebook-jssdk';
const sdkSrcFor = (locale: SupportedLocale) =>
    `https://connect.facebook.net/${getFacebookSdkLocale(locale)}/sdk.js`;
const readSdkSrc = () => document.getElementById(SDK_ID)?.getAttribute('src') ?? null;

describe('FacebookSignInButton.web Facebook JS SDK locale (#1975)', () => {
    const previousEnabled = process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED;
    const previousAppId = process.env.EXPO_PUBLIC_META_APP_ID;

    beforeEach(() => {
        process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = 'true';
        process.env.EXPO_PUBLIC_META_APP_ID = '1234567890';
        mockLocaleState.locale = 'ru';
        mockLocaleState.isHydrated = false;
        document.getElementById(SDK_ID)?.remove();
        delete window.FB;
        delete window.fbAsyncInit;
    });

    afterEach(() => {
        if (typeof previousEnabled === 'undefined') {
            delete process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED;
        } else {
            process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = previousEnabled;
        }
        if (typeof previousAppId === 'undefined') {
            delete process.env.EXPO_PUBLIC_META_APP_ID;
        } else {
            process.env.EXPO_PUBLIC_META_APP_ID = previousAppId;
        }
        document.getElementById(SDK_ID)?.remove();
        delete window.FB;
        delete window.fbAsyncInit;
    });

    it('does not insert facebook-jssdk until locale is resolved', () => {
        render(<FacebookSignInButton onSuccess={jest.fn()} />);
        expect(readSdkSrc()).toBeNull();
    });

    it('loads en_US after a late locale resolution instead of keeping ru_RU', () => {
        const { rerender } = render(<FacebookSignInButton onSuccess={jest.fn()} />);
        expect(readSdkSrc()).toBeNull();

        mockLocaleState.locale = 'en';
        mockLocaleState.isHydrated = true;
        rerender(<FacebookSignInButton onSuccess={jest.fn()} />);

        expect(readSdkSrc()).toBe(sdkSrcFor('en'));
        expect(readSdkSrc()).not.toContain('/ru_RU/');
    });

    it.each([
        ['ru', 'ru_RU'],
        ['be', 'be_BY'],
        ['uk', 'uk_UA'],
        ['pl', 'pl_PL'],
        ['en', 'en_US'],
    ] as const)('maps locale %s to Facebook SDK %s', (locale, fbLocale) => {
        mockLocaleState.locale = locale;
        mockLocaleState.isHydrated = true;
        render(<FacebookSignInButton onSuccess={jest.fn()} />);
        expect(readSdkSrc()).toBe(`https://connect.facebook.net/${fbLocale}/sdk.js`);
    });

    it('rewrites src when locale changes after the first insert', () => {
        mockLocaleState.isHydrated = true;
        mockLocaleState.locale = 'ru';
        const { rerender } = render(<FacebookSignInButton onSuccess={jest.fn()} />);
        expect(readSdkSrc()).toBe(sdkSrcFor('ru'));

        mockLocaleState.locale = 'en';
        rerender(<FacebookSignInButton onSuccess={jest.fn()} />);

        expect(readSdkSrc()).toBe(sdkSrcFor('en'));
        expect(document.querySelectorAll(`#${SDK_ID}`)).toHaveLength(1);
        expect(window.FB).toBeUndefined();
    });

    it('still opens the Facebook login flow after a locale-correct load', () => {
        mockLocaleState.isHydrated = true;
        mockLocaleState.locale = 'pl';
        const onSuccess = jest.fn();
        const screen = render(<FacebookSignInButton onSuccess={onSuccess} />);
        const script = document.getElementById(SDK_ID) as HTMLScriptElement;
        expect(script.getAttribute('src')).toBe(sdkSrcFor('pl'));

        const login = jest.fn(
            (callback: (response: {
                status: string;
                authResponse: { accessToken: string; grantedScopes: string };
            }) => void) => {
                callback({
                    status: 'connected',
                    authResponse: { accessToken: 'token', grantedScopes: 'public_profile,email' },
                });
            },
        );
        window.FB = { init: jest.fn(), login };
        act(() => {
            script.dispatchEvent(new Event('load'));
        });

        fireEvent.press(screen.getByTestId('facebook-sign-in-button'));
        expect(login).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'token' }));
    });
});
