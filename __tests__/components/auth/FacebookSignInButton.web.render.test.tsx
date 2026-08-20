/**
 * @jest-environment jsdom
 */

import { fireEvent, render } from '@testing-library/react-native';

import FacebookSignInButton from '@/components/auth/FacebookSignInButton.web';

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
    useLocale: () => ({ locale: 'ru' }),
}));

jest.mock('@/i18n', () => ({
    translate: (key: string) => key,
}));

describe('FacebookSignInButton.web unavailable state', () => {
    const previousEnabled = process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED;
    const previousAppId = process.env.EXPO_PUBLIC_META_APP_ID;

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
        document.getElementById('facebook-jssdk')?.remove();
        delete window.FB;
        delete window.fbAsyncInit;
        jest.clearAllMocks();
    });

    it('does not load the SDK or report success when rollout is enabled without app id', () => {
        process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED = 'true';
        process.env.EXPO_PUBLIC_META_APP_ID = '';
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const screen = render(
            <FacebookSignInButton onSuccess={onSuccess} onError={onError} />,
        );
        const button = screen.getByTestId('facebook-sign-in-button');

        expect(button.props.accessibilityState).toEqual({
            disabled: true,
            busy: false,
        });
        expect(screen.getByText('authStatic:facebook.unavailable')).toBeTruthy();
        expect(document.getElementById('facebook-jssdk')).toBeNull();

        fireEvent.press(button);

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });
});
