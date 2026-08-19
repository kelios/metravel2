import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import AppleSignInButton, {
    isAppleSignInCancellation,
    toAppleCredentialPayload,
} from '@/components/auth/AppleSignInButton.native';

// Префикс `mock` обязателен: babel-plugin-jest-hoist поднимает фабрику
// `jest.mock` выше объявлений и пускает внутрь только такие имена.
const mockIsAvailableAsync = jest.fn(async () => true);
const mockSignInAsync = jest.fn();

jest.mock('expo-apple-authentication', () => {
    const { Pressable } = require('react-native');
    return {
        isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...(args as [])),
        signInAsync: (...args: unknown[]) => mockSignInAsync(...(args as [])),
        AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
            <Pressable testID="native-apple-button" onPress={onPress} />
        ),
        AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
        AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
        AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    };
});

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ isDark: false }),
}));

jest.mock('@/i18n', () => ({
    translate: (key: string) => key,
}));

const originalPlatform = Platform.OS;

const appleCredential = {
    identityToken: 'apple-identity-token',
    authorizationCode: 'one-time-code',
    fullName: { givenName: 'Apple', familyName: 'User' },
};

beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockSignInAsync.mockResolvedValue(appleCredential);
    (Platform.OS as any) = 'ios';
});

afterEach(() => {
    (Platform.OS as any) = originalPlatform;
});

describe('toAppleCredentialPayload', () => {
    it('переносит имя только когда Apple его прислала', () => {
        expect(toAppleCredentialPayload(appleCredential as any)).toEqual({
            identityToken: 'apple-identity-token',
            authorizationCode: 'one-time-code',
            givenName: 'Apple',
            familyName: 'User',
        });
    });

    it('на повторном входе отдаёт пустые имя и код', () => {
        expect(
            toAppleCredentialPayload({
                identityToken: 'apple-identity-token',
                authorizationCode: null,
                fullName: null,
            } as any),
        ).toEqual({
            identityToken: 'apple-identity-token',
            authorizationCode: null,
            givenName: null,
            familyName: null,
        });
    });

    it('без identity token не отдаёт payload', () => {
        expect(
            toAppleCredentialPayload({
                identityToken: '   ',
                authorizationCode: 'one-time-code',
                fullName: null,
            } as any),
        ).toBeNull();
    });
});

describe('isAppleSignInCancellation', () => {
    it('различает отмену и настоящую ошибку', () => {
        expect(isAppleSignInCancellation({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
        expect(isAppleSignInCancellation({ code: 'ERR_REQUEST_FAILED' })).toBe(false);
        expect(isAppleSignInCancellation(new Error('boom'))).toBe(false);
    });
});

describe('AppleSignInButton native', () => {
    it('ничего не рисует, пока Apple-вход недоступен', async () => {
        mockIsAvailableAsync.mockResolvedValue(false);
        const screen = render(<AppleSignInButton onSuccess={jest.fn()} />);

        await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
        expect(screen.queryByTestId('apple-sign-in-button')).toBeNull();
    });

    it('не трогает Apple SDK на не-iOS платформе', async () => {
        (Platform.OS as any) = 'android';
        const screen = render(<AppleSignInButton onSuccess={jest.fn()} />);

        expect(mockIsAvailableAsync).not.toHaveBeenCalled();
        expect(screen.queryByTestId('apple-sign-in-button')).toBeNull();
    });

    it('отдаёт credential наверх', async () => {
        const onSuccess = jest.fn();
        const screen = render(<AppleSignInButton onSuccess={onSuccess} />);

        const button = await screen.findByTestId('native-apple-button');
        fireEvent.press(button);

        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({
            identityToken: 'apple-identity-token',
            authorizationCode: 'one-time-code',
            givenName: 'Apple',
            familyName: 'User',
        }));
        expect(mockSignInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1] });
    });

    it('отмена пользователем не считается ошибкой', async () => {
        mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
        const onError = jest.fn();
        const onCancel = jest.fn();
        const screen = render(
            <AppleSignInButton onSuccess={jest.fn()} onError={onError} onCancel={onCancel} />,
        );

        fireEvent.press(await screen.findByTestId('native-apple-button'));

        await waitFor(() => expect(onCancel).toHaveBeenCalled());
        expect(onError).not.toHaveBeenCalled();
    });

    it('настоящая ошибка провайдера уходит в onError', async () => {
        mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_FAILED' });
        const onSuccess = jest.fn();
        const onError = jest.fn();
        const screen = render(<AppleSignInButton onSuccess={onSuccess} onError={onError} />);

        fireEvent.press(await screen.findByTestId('native-apple-button'));

        await waitFor(() => expect(onError).toHaveBeenCalledWith('authStatic:apple.signInFailed'));
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('credential без identity token не превращается в успех', async () => {
        mockSignInAsync.mockResolvedValue({ ...appleCredential, identityToken: null });
        const onSuccess = jest.fn();
        const onError = jest.fn();
        const screen = render(<AppleSignInButton onSuccess={onSuccess} onError={onError} />);

        fireEvent.press(await screen.findByTestId('native-apple-button'));

        await waitFor(() => expect(onError).toHaveBeenCalledWith('authStatic:apple.signInFailed'));
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('disabled не запускает Apple-вход', async () => {
        const onSuccess = jest.fn();
        const screen = render(<AppleSignInButton onSuccess={onSuccess} disabled />);

        fireEvent.press(await screen.findByTestId('native-apple-button'));

        await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
        expect(mockSignInAsync).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });
});
