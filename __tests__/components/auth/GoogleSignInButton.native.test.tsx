import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.native';

const WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = 'android-client.apps.googleusercontent.com';
const IOS_CLIENT_ID = 'ios-client.apps.googleusercontent.com';

const ENV_KEYS = [
    'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
] as const;

const originalPlatform = Platform.OS;
const originalEnv = ENV_KEYS.reduce<Record<string, string | undefined>>((acc, key) => {
    acc[key] = process.env[key];
    return acc;
}, {});

const useIdTokenAuthRequestMock = Google.useIdTokenAuthRequest as jest.Mock;

function resetGoogleEnv() {
    for (const key of ENV_KEYS) {
        const originalValue = originalEnv[key];
        if (typeof originalValue === 'undefined') {
            delete process.env[key];
        } else {
            process.env[key] = originalValue;
        }
    }
}

describe('GoogleSignInButton native config', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetGoogleEnv();
        useIdTokenAuthRequestMock.mockReturnValue([{}, null, jest.fn(async () => ({ type: 'dismiss' }))]);
        (Platform.OS as any) = 'android';
    });

    afterEach(() => {
        (Platform.OS as any) = originalPlatform;
        resetGoogleEnv();
    });

    it('does not reuse the web client id as the Android client id', () => {
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;

        const { getByLabelText, getByText } = render(
            <GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />
        );

        expect(getByText('Google Sign-In не настроен')).toBeTruthy();
        expect(getByLabelText('Google Sign-In не настроен для мобильного приложения').props.pointerEvents).toBe('none');
        expect(useIdTokenAuthRequestMock).not.toHaveBeenCalled();
    });

    it('passes the explicit Android client id to expo-auth-session', () => {
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ANDROID_CLIENT_ID;

        const { getByText } = render(<GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />);

        expect(getByText('Войти через Google')).toBeTruthy();
        expect(useIdTokenAuthRequestMock).toHaveBeenCalledTimes(1);
        expect(useIdTokenAuthRequestMock.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                webClientId: WEB_CLIENT_ID,
                androidClientId: ANDROID_CLIENT_ID,
                iosClientId: undefined,
            })
        );
    });

    it('does not reuse the web client id as the iOS client id', () => {
        (Platform.OS as any) = 'ios';
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;

        render(<GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />);

        expect(useIdTokenAuthRequestMock).not.toHaveBeenCalled();
    });

    it('passes the explicit iOS client id to expo-auth-session', () => {
        (Platform.OS as any) = 'ios';
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = IOS_CLIENT_ID;

        render(<GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />);

        expect(useIdTokenAuthRequestMock).toHaveBeenCalledTimes(1);
        expect(useIdTokenAuthRequestMock.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                webClientId: WEB_CLIENT_ID,
                androidClientId: undefined,
                iosClientId: IOS_CLIENT_ID,
            })
        );
    });
});
