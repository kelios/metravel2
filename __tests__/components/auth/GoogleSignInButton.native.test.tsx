import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton.native';

const WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = 'android-client.apps.googleusercontent.com';
const IOS_CLIENT_ID = 'ios-client.apps.googleusercontent.com';
const mockGoogleIdToken = 'native-google-id-token';

jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(async () => true),
        signIn: jest.fn(async () => ({
            type: 'success',
            data: { idToken: mockGoogleIdToken },
        })),
        getTokens: jest.fn(async () => ({ idToken: mockGoogleIdToken, accessToken: 'access-token' })),
    },
    isCancelledResponse: (response: { type?: string }) => response.type === 'cancelled',
    isErrorWithCode: (error: unknown): error is { code: string } =>
        typeof error === 'object' && error !== null && 'code' in error,
    isSuccessResponse: (response: { type?: string }) => response.type === 'success',
    statusCodes: {
        IN_PROGRESS: 'IN_PROGRESS',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
        SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    },
}));

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

const googleSigninMock = GoogleSignin as unknown as {
    configure: jest.Mock;
    hasPlayServices: jest.Mock;
    signIn: jest.Mock;
    getTokens: jest.Mock;
};

describe('GoogleSignInButton native config', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetGoogleEnv();
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
        expect(googleSigninMock.configure).not.toHaveBeenCalled();
    });

    it('does not start native Google Sign-In without the web client id needed for id_token', () => {
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ANDROID_CLIENT_ID;

        const { getByText } = render(
            <GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />
        );

        expect(getByText('Google Sign-In не настроен')).toBeTruthy();
        expect(googleSigninMock.configure).not.toHaveBeenCalled();
    });

    it('configures native Google Sign-In with the web client id after requiring Android client id', async () => {
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ANDROID_CLIENT_ID;

        const { getByText } = render(<GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />);

        expect(getByText('Войти через Google')).toBeTruthy();
        await waitFor(() => expect(googleSigninMock.configure).toHaveBeenCalledTimes(1));
        expect(googleSigninMock.configure).toHaveBeenCalledWith({
            webClientId: WEB_CLIENT_ID,
            offlineAccess: false,
        });
        expect(googleSigninMock.configure.mock.calls[0][0]).not.toHaveProperty('androidClientId');
    });

    it('returns the native Google id_token on press', async () => {
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ANDROID_CLIENT_ID;
        const onSuccess = jest.fn();

        const { getByText } = render(<GoogleSignInButton onSuccess={onSuccess} onError={jest.fn()} />);
        fireEvent.press(getByText('Войти через Google'));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(mockGoogleIdToken));
        expect(googleSigninMock.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
        expect(googleSigninMock.signIn).toHaveBeenCalledTimes(1);
    });

    it('does not reuse the web client id as the iOS client id', () => {
        (Platform.OS as any) = 'ios';
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;

        render(<GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />);

        expect(googleSigninMock.configure).not.toHaveBeenCalled();
    });

    it('configures native Google Sign-In with the explicit iOS client id', async () => {
        (Platform.OS as any) = 'ios';
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = WEB_CLIENT_ID;
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = IOS_CLIENT_ID;

        render(<GoogleSignInButton onSuccess={jest.fn()} onError={jest.fn()} />);

        await waitFor(() => expect(googleSigninMock.configure).toHaveBeenCalledTimes(1));
        expect(googleSigninMock.configure).toHaveBeenCalledWith({
            webClientId: WEB_CLIENT_ID,
            iosClientId: IOS_CLIENT_ID,
            offlineAccess: false,
        });
    });
});
